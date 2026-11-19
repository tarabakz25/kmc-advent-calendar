/**
 * Slack に投稿する処理。
 *
 * - notifyPublished: その日の記事が公開されたらチャンネルに投稿する。
 * - notifyDaily: 毎朝チャンネルに「開始まであと N 日」「明日は〇〇さん」と空き枠の募集を投稿する。
 * - notifyReminders: 担当日の3日前・前日に URL が未登録なら本人に DM する。
 * - notifyComplete: 最終日の翌日以降、全日程の記事が出揃ったらチャンネルに投稿する。
 *
 * - Vercel: Cron（/api/cron/slack）が notifyAll を、URL が登録されたとき（saveEntry）に notifyPublished を呼ぶ。
 * - Docker: scripts/slack-bot.ts が常駐して 5 分ごとに notifyAll を呼ぶ。
 *
 * $app/* に依存させないこと（scripts/slack-bot.ts から Bun で直接読み込むため）。
 */
import { and, asc, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
	absoluteUrl,
	CALENDAR_YEAR,
	DAYS,
	dayOffset,
	genreOf,
	phaseOf,
	platformOf,
	todayInJst,
	weekdayOf
} from '../calendar.ts';
import { entry, slackLog, user } from './db/schema.ts';
import { SLACK_TEMPLATES } from './slack-templates.ts';

export type SlackConfig = {
	token: string;
	channel: string;
	/** カレンダーへのリンク用（末尾の / なし）。 */
	origin?: string;
	/** この時刻(JST)より前は投稿しない。 */
	postHour: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PostgresJsDatabase<any>;

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

class SlackApiError extends Error {
	constructor(
		readonly method: string,
		readonly code: string
	) {
		super(`Slack API error (${method}): ${code}`);
	}
}

/**
 * Slack Web API を呼ぶ。`form` を true にすると x-www-form-urlencoded で送る
 * （users.lookupByEmail など JSON を受け付けないメソッド用）。
 */
async function slackApi<T = Record<string, unknown>>(
	config: SlackConfig,
	method: string,
	body: Record<string, unknown>,
	{ form = false } = {}
): Promise<T> {
	const res = await fetch(`https://slack.com/api/${method}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.token}`,
			'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json; charset=utf-8'
		},
		body: form
			? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]))
			: JSON.stringify(body)
	});
	const json = (await res.json()) as { ok: boolean; error?: string } & T;
	if (!json.ok) throw new SlackApiError(method, json.error ?? String(res.status));
	return json;
}

/** チャンネルに投稿する。body に channel を入れればそちらに投稿する。 */
export async function postMessage(config: SlackConfig, body: Record<string, unknown>) {
	const res = await slackApi<{ ts: string; channel: string }>(config, 'chat.postMessage', {
		channel: config.channel,
		...body
	});
	return { ts: res.ts, channel: res.channel };
}

/** スレッドに続けて投稿するメッセージを持てるメッセージ。 */
export type ThreadedMessage = Record<string, unknown> & { thread?: Record<string, unknown>[] };

/**
 * メッセージを投稿し、`thread` があればそのスレッドに続けて投稿する。
 * 親の投稿に失敗したら例外を投げる。スレッドへの投稿の失敗はログに出すだけ
 * （親はもう投稿済みなので、やり直すと親が二重になる）。
 */
export async function postWithThread(config: SlackConfig, message: ThreadedMessage) {
	const { thread = [], ...body } = message;
	const parent = await postMessage(config, body);
	for (const reply of thread) {
		try {
			await postMessage(config, { ...reply, channel: parent.channel, thread_ts: parent.ts });
		} catch (err) {
			console.error('[slack] スレッドへの投稿に失敗しました', err);
		}
	}
	return parent;
}

/** メールアドレスから Slack のユーザーID を探す。見つからなければ null。 */
export async function lookupSlackUser(config: SlackConfig, email: string) {
	try {
		const res = await slackApi<{ user: { id: string } }>(
			config,
			'users.lookupByEmail',
			{ email },
			{ form: true }
		);
		return res.user.id;
	} catch (err) {
		if (err instanceof SlackApiError && err.code === 'users_not_found') return null;
		throw err;
	}
}

/** ユーザーに DM を送る。 */
export async function sendDirectMessage(
	config: SlackConfig,
	userId: string,
	body: Record<string, unknown>
) {
	const res = await slackApi<{ channel: { id: string } }>(config, 'conversations.open', {
		users: userId
	});
	await postMessage(config, { ...body, channel: res.channel.id });
}

/** Slack の mrkdwn で意味を持つ文字をエスケープする。 */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** テンプレートの `{名前}` を vars の値で置き換える。知らない名前はそのまま残す。 */
export function fill(template: string, vars: Record<string, string>) {
	return template.replace(/\{(\w+)\}/g, (m, key: string) => vars[key] ?? m);
}

export type Article = {
	day: number;
	title: string;
	url: string;
	author: string;
	genre: string | null;
};

/** 公開のお知らせメッセージ（chat.postMessage の body）を作る。文面は slack-templates.ts。 */
export function messageOf(a: Article, origin?: string) {
	const t = SLACK_TEMPLATES.published;
	const raw: Record<string, string> = {
		year: String(CALENDAR_YEAR),
		day: String(a.day),
		weekday: weekdayOf(a.day),
		title: a.title,
		// サイト内の記事（/posts/N）は絶対 URL にしないと Slack でリンクにならない。
		url: absoluteUrl(a.url, origin),
		author: a.author,
		genre: genreOf(a.genre)?.label ?? '',
		platform: platformOf(a.url),
		calendar: origin ? `${origin}/calendar` : ''
	};
	// mrkdwn に埋め込む値はエスケープする（URL はリンク記法の中で使うのでそのまま）。
	const md = Object.fromEntries(
		Object.entries(raw).map(([k, v]) => [k, k === 'url' || k === 'calendar' ? v : escape(v)])
	);

	const headline = fill(t.headline, md);
	// 値が空の項目（ジャンル未選択など）は、置き換え前後で文字が残っていても省く。
	const meta = t.meta
		.filter((item) => [...item.matchAll(/\{(\w+)\}/g)].every(([, key]) => raw[key]))
		.map((item) => fill(item, md))
		.join(t.separator);

	return {
		text: fill(t.fallback, { ...raw, headline: fill(t.headline, raw) }),
		unfurl_links: true,
		blocks: [
			{ type: 'section', text: { type: 'mrkdwn', text: `*${headline}*` } },
			{
				type: 'section',
				text: { type: 'mrkdwn', text: `*${fill(t.title, md)}*${meta ? `\n${meta}` : ''}` }
			},
			...(raw.calendar && t.footer
				? [{ type: 'context', elements: [{ type: 'mrkdwn', text: fill(t.footer, md) }] }]
				: [])
		]
	};
}

/** 投稿してよい時刻（JST で postHour 時以降）か。 */
function isPostTime(config: SlackConfig, now: Date) {
	const hour = Number(
		new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Tokyo',
			hour: 'numeric',
			hourCycle: 'h23'
		}).format(now)
	);
	return hour >= config.postHour;
}

/**
 * 公開日を迎えていて、まだ投稿していない記事を投稿する。投稿した件数を返す。
 * 二重投稿は entry.slack_notified_at で防ぐ（同時に呼ばれても1回だけ）。
 */
export async function notifyPublished(db: Db, config: SlackConfig, now = new Date()) {
	const today = todayInJst(now);
	if (!isPostTime(config, now)) return 0;

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

/** 開始の何日前に「開始まであと N 日」を投稿するか。 */
export const COUNTDOWN_DAYS_BEFORE = [5, 1] as const;

/** 日付を `12/3(木)` の形にする。 */
const shortDate = (day: number) => `12/${day}(${weekdayOf(day)})`;

/** 明日の予告やカウントダウンに使う、予約済みの枠。 */
export type Reservation = { day: number; title: string; author: string };

/**
 * 毎朝の日次メッセージを作る。投稿しない日（カウントダウン前・最終日以降）は null。
 * - 開始前: 開始まであと N 日（COUNTDOWN_DAYS_BEFORE の日だけ）
 * - 期間中（最終日の前日まで）: 明日の予告
 * どちらも、今日以降で空いている日があれば募集を添える。
 */
export function dailyMessageOf(reservations: Reservation[], today: string, origin?: string) {
	const t = SLACK_TEMPLATES.daily;
	const phase = phaseOf(today);
	const base = { year: String(CALENDAR_YEAR), calendar: origin ? `${origin}/calendar` : '' };

	let headline: string;
	if (phase.kind === 'before') {
		if (!(COUNTDOWN_DAYS_BEFORE as readonly number[]).includes(phase.daysToStart)) return null;
		headline = fill(phase.daysToStart === 1 ? t.countdownTomorrow : t.countdown, {
			...base,
			daysLeft: String(phase.daysToStart)
		});
	} else if (phase.kind === 'running' && phase.day < DAYS) {
		const day = phase.day + 1;
		const r = reservations.find((r) => r.day === day);
		const vars = { ...base, day: String(day), weekday: weekdayOf(day) };
		headline = r
			? fill(t.tomorrow, { ...vars, title: escape(r.title), author: escape(r.author) })
			: fill(t.tomorrowOpen, vars);
	} else {
		return null;
	}

	const taken = new Set(reservations.map((r) => r.day));
	const open = Array.from({ length: DAYS }, (_, i) => i + 1).filter(
		(day) => !taken.has(day) && dayOffset(day, today) > 0
	);
	const slots = open.length
		? fill(t.openSlots, { count: String(open.length), days: open.map(shortDate).join('、') })
		: phase.kind === 'before'
			? t.full
			: '';

	return {
		text: [headline, slots].filter(Boolean).join('\n'),
		blocks: [
			// 見出しは公開のお知らせと同じく、1行まるごと太字にする（全角文字の直前・直後の * は効かないため）。
			{ type: 'section', text: { type: 'mrkdwn', text: `*${headline}*` } },
			...(slots ? [{ type: 'section', text: { type: 'mrkdwn', text: slots } }] : []),
			...(base.calendar
				? [{ type: 'context', elements: [{ type: 'mrkdwn', text: fill(t.footer, base) }] }]
				: [])
		]
	};
}

/** URL 未登録のリマインドの対象。 */
export type Reminder = { day: number; title: string; author: string; daysLeft: number };

/** URL 未登録のリマインドを作る。DM でもチャンネルでも同じ文面。 */
export function reminderMessageOf(r: Reminder, origin?: string) {
	const t = SLACK_TEMPLATES.reminder;
	const page = origin ? `${origin}/day/${r.day}` : '';
	const vars = {
		year: String(CALENDAR_YEAR),
		day: String(r.day),
		weekday: weekdayOf(r.day),
		title: escape(r.title),
		author: escape(r.author),
		when: r.daysLeft === 1 ? '明日' : `${r.daysLeft}日後`,
		page
	};
	const text = fill(t.text, vars);
	return {
		text,
		blocks: [
			{ type: 'section', text: { type: 'mrkdwn', text } },
			...(page
				? [{ type: 'context', elements: [{ type: 'mrkdwn', text: fill(t.footer, vars) }] }]
				: [])
		]
	};
}

/** コンプリートのお知らせに載せる記事。 */
export type CompletedArticle = { day: number; title: string; url: string; author: string };

/** 記事の一覧を1ブロックに何行まで入れるか（section の文字数上限 3000 を超えないように）。 */
const ITEMS_PER_BLOCK = 5;

/** 全日程の記事が出揃ったときのお知らせを作る。 */
export function completeMessageOf(articles: CompletedArticle[], origin?: string) {
	const t = SLACK_TEMPLATES.complete;
	const vars = {
		year: String(CALENDAR_YEAR),
		count: String(articles.length),
		authors: String(new Set(articles.map((a) => a.author)).size),
		articles: origin ? `${origin}/articles` : ''
	};
	const items = [...articles]
		.sort((a, b) => a.day - b.day)
		.map((a) =>
			fill(t.item, {
				day: String(a.day),
				title: escape(a.title),
				url: absoluteUrl(a.url, origin),
				author: escape(a.author)
			})
		);
	const chunks = Array.from({ length: Math.ceil(items.length / ITEMS_PER_BLOCK) }, (_, i) =>
		items.slice(i * ITEMS_PER_BLOCK, (i + 1) * ITEMS_PER_BLOCK)
	);
	const headline = fill(t.headline, vars);
	return {
		text: headline,
		blocks: [
			{ type: 'section', text: { type: 'mrkdwn', text: `*${headline}*` } },
			{ type: 'section', text: { type: 'mrkdwn', text: fill(t.thanks, vars) } },
			{
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: [t.threadHint, vars.articles ? fill(t.footer, vars) : '']
							.filter(Boolean)
							.join('　')
					}
				]
			}
		],
		// 記事の一覧はスレッドに流す。
		thread: [
			{
				text: fill(t.listHeader, vars),
				// 25 件のリンクがすべて展開されると長くなりすぎるので展開しない。
				unfurl_links: false,
				unfurl_media: false,
				blocks: [
					{ type: 'section', text: { type: 'mrkdwn', text: `*${fill(t.listHeader, vars)}*` } },
					...chunks.map((lines) => ({
						type: 'section',
						text: { type: 'mrkdwn', text: lines.join('\n') }
					}))
				]
			}
		]
	} satisfies ThreadedMessage;
}

/** 担当日の何日前にリマインドするか。 */
export const REMIND_DAYS_BEFORE = [3, 1] as const;

/** slack_log に key を記録する。すでにあれば false（他のプロセスが送信済み）。 */
async function claim(db: Db, key: string) {
	const rows = await db
		.insert(slackLog)
		.values({ key })
		.onConflictDoNothing()
		.returning({ key: slackLog.key });
	return rows.length > 0;
}

/** 送信に失敗したときに記録を消して、次の確認で再挑戦できるようにする。 */
async function unclaim(db: Db, key: string) {
	await db.delete(slackLog).where(eq(slackLog.key, key));
}

/** 今日の日次メッセージを（まだなら）チャンネルに投稿する。投稿したら true。 */
export async function notifyDaily(db: Db, config: SlackConfig, now = new Date()) {
	if (!isPostTime(config, now)) return false;
	const today = todayInJst(now);

	const reservations = await db
		.select({ day: entry.day, title: entry.title, author: user.name })
		.from(entry)
		.innerJoin(user, eq(entry.userId, user.id))
		.where(eq(entry.year, CALENDAR_YEAR));

	const message = dailyMessageOf(reservations, today, config.origin);
	if (!message) return false;

	const key = `daily:${today}`;
	if (!(await claim(db, key))) return false;
	try {
		await postMessage(config, message);
		console.log(`[slack] ${today} の日次メッセージを投稿しました`);
		return true;
	} catch (err) {
		await unclaim(db, key);
		throw err;
	}
}

/**
 * 担当日の3日前・前日になっても URL が未登録の人に DM する。送った件数を返す。
 * Slack のユーザーが見つからない人は、チャンネルに名前だけで投稿する。
 */
export async function notifyReminders(db: Db, config: SlackConfig, now = new Date()) {
	if (!isPostTime(config, now)) return 0;
	const today = todayInJst(now);

	// dayOffset(day, today) === n になる day を求める。
	const base = dayOffset(1, today);
	const targets = new Map(
		REMIND_DAYS_BEFORE.map((n) => [n - base + 1, n] as const).filter(
			([day]) => day >= 1 && day <= DAYS
		)
	);
	if (targets.size === 0) return 0;

	const rows = await db
		.select({
			id: entry.id,
			day: entry.day,
			title: entry.title,
			author: user.name,
			email: user.email
		})
		.from(entry)
		.innerJoin(user, eq(entry.userId, user.id))
		.where(
			and(eq(entry.year, CALENDAR_YEAR), inArray(entry.day, [...targets.keys()]), isNull(entry.url))
		)
		.orderBy(asc(entry.day));

	let sent = 0;
	for (const row of rows) {
		const daysLeft = targets.get(row.day)!;
		const key = `remind:${row.id}:${daysLeft}`;
		if (!(await claim(db, key))) continue;

		try {
			const reminder = { ...row, daysLeft };
			const slackUser = await lookupSlackUser(config, row.email);
			if (slackUser) {
				await sendDirectMessage(config, slackUser, reminderMessageOf(reminder, config.origin));
			} else {
				await postMessage(config, reminderMessageOf(reminder, config.origin));
			}
			console.log(
				`[slack] 12/${row.day} の ${row.author} さんにリマインドしました（${daysLeft}日前${slackUser ? '・DM' : '・チャンネル'}）`
			);
			sent++;
		} catch (err) {
			// 1人分の失敗で他の人へのリマインドを止めない。記録を戻して次の確認で再挑戦する。
			await unclaim(db, key);
			console.error(`[slack] 12/${row.day} のリマインドに失敗しました`, err);
		}
	}
	return sent;
}

/**
 * 最終日の翌日以降、全日程の記事の URL が揃っていたらコンプリートのお知らせを投稿する。投稿したら true。
 * 最終日の後に URL が登録されて揃った場合も、その後の確認で投稿する。
 */
export async function notifyComplete(db: Db, config: SlackConfig, now = new Date()) {
	if (!isPostTime(config, now)) return false;
	const today = todayInJst(now);
	if (dayOffset(DAYS, today) >= 0) return false;

	const rows = await db
		.select({ day: entry.day, title: entry.title, url: entry.url, author: user.name })
		.from(entry)
		.innerJoin(user, eq(entry.userId, user.id))
		.where(and(eq(entry.year, CALENDAR_YEAR), isNotNull(entry.url)));
	if (rows.length < DAYS) return false;

	const key = `complete:${CALENDAR_YEAR}`;
	if (!(await claim(db, key))) return false;
	try {
		await postWithThread(
			config,
			completeMessageOf(
				rows.map((r) => ({ ...r, url: r.url! })),
				config.origin
			)
		);
		console.log(`[slack] コンプリートのお知らせを投稿しました`);
		return true;
	} catch (err) {
		await unclaim(db, key);
		throw err;
	}
}

/** 公開のお知らせ・日次メッセージ・リマインド・コンプリートをまとめて実行する。1つ失敗しても他は続ける。 */
export async function notifyAll(db: Db, config: SlackConfig, now = new Date()) {
	const run = async <T>(name: string, fn: () => Promise<T>) => {
		try {
			return await fn();
		} catch (err) {
			console.error(`[slack] ${name}`, err);
			return null;
		}
	};
	return {
		published: await run('published', () => notifyPublished(db, config, now)),
		daily: await run('daily', () => notifyDaily(db, config, now)),
		reminders: await run('reminders', () => notifyReminders(db, config, now)),
		complete: await run('complete', () => notifyComplete(db, config, now))
	};
}
