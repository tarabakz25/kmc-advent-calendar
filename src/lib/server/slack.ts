/**
 * その日の記事が公開されたら Slack に投稿する処理。
 *
 * - Vercel: Cron（/api/cron/slack）と、URL が登録されたとき（saveEntry）に呼ばれる。
 * - Docker: scripts/slack-bot.ts が常駐して 5 分ごとに呼ぶ。
 *
 * $app/* に依存させないこと（scripts/slack-bot.ts から Bun で直接読み込むため）。
 */
import { and, asc, eq, isNotNull, isNull, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
	CALENDAR_YEAR,
	dayOffset,
	genreOf,
	platformOf,
	todayInJst,
	weekdayOf
} from '../calendar.ts';
import { entry, user } from './db/schema.ts';

export type SlackConfig = {
	token: string;
	channel: string;
	/** カレンダーへのリンク用（末尾の / なし）。 */
	origin?: string;
	/** この時刻(JST)より前は投稿しない。 */
	postHour: number;
};

/** 環境変数から設定を作る。トークンかチャンネルがなければ null（Slack 連携は無効）。 */
export function slackConfigFrom(env: Record<string, string | undefined>): SlackConfig | null {
	const get = (name: string) => env[name]?.trim() || undefined;
	const token = get('SLACK_BOT_TOKEN');
	const channel = get('SLACK_CHANNEL_ID');
	if (!token || !channel) return null;
	return {
		token,
		channel,
		origin: get('ORIGIN')?.replace(/\/$/, ''),
		postHour: Number(get('SLACK_POST_HOUR') ?? 8)
	};
}

export async function postMessage(config: SlackConfig, body: Record<string, unknown>) {
	const res = await fetch('https://slack.com/api/chat.postMessage', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.token}`,
			'Content-Type': 'application/json; charset=utf-8'
		},
		body: JSON.stringify({ channel: config.channel, ...body })
	});
	const json = (await res.json()) as { ok: boolean; error?: string };
	if (!json.ok) throw new Error(`Slack API error: ${json.error ?? res.status}`);
}

/** Slack の mrkdwn で意味を持つ文字をエスケープする。 */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Article = { day: number; title: string; url: string; author: string; genre: string | null };

function messageOf(a: Article, origin?: string) {
	const date = `12月${a.day}日(${weekdayOf(a.day)})`;
	const meta = [`by ${escape(a.author)}`, genreOf(a.genre)?.label, platformOf(a.url)]
		.filter(Boolean)
		.join('  ·  ');
	const headline = `:christmas_tree: KMC Advent Calendar ${CALENDAR_YEAR}　${date} の記事が公開されました！`;

	return {
		text: `${headline}\n${a.title} ${a.url}`,
		unfurl_links: true,
		blocks: [
			{ type: 'section', text: { type: 'mrkdwn', text: `*${headline}*` } },
			{
				type: 'section',
				text: { type: 'mrkdwn', text: `*<${a.url}|${escape(a.title)}>*\n${meta}` }
			},
			...(origin
				? [
						{
							type: 'context',
							elements: [{ type: 'mrkdwn', text: `<${origin}/calendar|カレンダーを見る>` }]
						}
					]
				: [])
		]
	};
}

/**
 * 公開日を迎えていて、まだ投稿していない記事を投稿する。投稿した件数を返す。
 * 二重投稿は entry.slack_notified_at で防ぐ（同時に呼ばれても1回だけ）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyPublished(db: PostgresJsDatabase<any>, config: SlackConfig) {
	const now = new Date();
	const today = todayInJst(now);
	const hour = Number(
		new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Tokyo',
			hour: 'numeric',
			hourCycle: 'h23'
		}).format(now)
	);
	if (hour < config.postHour) return 0;

	// 今日まで（12月の何日目まで）が公開済みか。12月より前なら 0 以下になって何も選ばれない。
	const lastDay = 1 - dayOffset(1, today);
	if (lastDay < 1) return 0;

	const rows = await db
		.select({
			id: entry.id,
			day: entry.day,
			title: entry.title,
			url: entry.url,
			genre: entry.genre,
			author: user.name
		})
		.from(entry)
		.innerJoin(user, eq(entry.userId, user.id))
		.where(
			and(
				eq(entry.year, CALENDAR_YEAR),
				lte(entry.day, lastDay),
				isNotNull(entry.url),
				isNull(entry.slackNotifiedAt)
			)
		)
		.orderBy(asc(entry.day));

	let posted = 0;
	for (const row of rows) {
		// 先に「投稿済み」を取ってから投稿する。取れなければ他のプロセスが投稿済み。
		const claimed = await db
			.update(entry)
			.set({ slackNotifiedAt: new Date() })
			.where(and(eq(entry.id, row.id), isNull(entry.slackNotifiedAt)))
			.returning({ id: entry.id });
		if (claimed.length === 0) continue;

		try {
			await postMessage(config, messageOf({ ...row, url: row.url! }, config.origin));
			console.log(`[slack] 12/${row.day}「${row.title}」を投稿しました`);
			posted++;
		} catch (err) {
			// 失敗したら戻して、次の確認で再挑戦する。
			await db.update(entry).set({ slackNotifiedAt: null }).where(eq(entry.id, row.id));
			throw err;
		}
	}
	return posted;
}
