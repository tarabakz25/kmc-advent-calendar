/**
 * Slack 通知のテスト。サンプル記事の「公開のお知らせ」などを、本番と同じテンプレートで投稿する。
 * DB には触らない（slack_notified_at も slack_log も変えない）ので、何度実行してもよい。
 *
 *   bun run slack:test                     # サンプル記事で投稿
 *   bun run slack:test --dry-run           # 投稿せず、メッセージ(JSON)を表示するだけ
 *   bun run slack:test --day 12 --title "記事タイトル" --url https://... --author 名前 --genre tech
 *   bun run slack:test --genre none        # ジャンル未選択のときの見た目
 *   bun run slack:test --channel C0123456  # SLACK_CHANNEL_ID 以外のチャンネルに投稿
 *
 *   bun run slack:test --kind daily --today 2026-11-26     # その日の朝の日次メッセージ（サンプルの予約で）
 *   bun run slack:test --kind daily --today 2026-12-05
 *   bun run slack:test --kind reminder --days-left 3       # URL 未登録リマインド（DM の文面。チャンネルに投稿）
 *   bun run slack:test --kind full                         # 全枠が埋まったお知らせ（サンプル25枠）
 *   bun run slack:test --kind complete                     # コンプリートのお知らせ（サンプル25記事）
 *
 * 必要な環境変数: SLACK_BOT_TOKEN, SLACK_CHANNEL_ID（--dry-run なら不要）
 * 任意: ORIGIN（カレンダーへのリンク用）
 *
 * --dry-run の JSON は https://app.slack.com/block-kit-builder に貼ると見た目を確認できる。
 * 文面は src/lib/server/slack-templates.ts で変える。
 */
import { parseArgs } from 'node:util';
import { GENRES, todayInJst } from '../src/lib/calendar.ts';
import {
	completeMessageOf,
	dailyMessageOf,
	fullMessageOf,
	messageOf,
	postWithThread,
	reminderMessageOf,
	type ThreadedMessage,
	slackConfigFrom
} from '../src/lib/server/slack.ts';

const { values: opts } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		'dry-run': { type: 'boolean', default: false },
		kind: { type: 'string', default: 'published' },
		today: { type: 'string' },
		'days-left': { type: 'string', default: '1' },
		channel: { type: 'string' },
		day: { type: 'string', default: '3' },
		title: { type: 'string', default: '【テスト投稿】サンプル記事のタイトル' },
		url: { type: 'string', default: 'https://zenn.dev/example/articles/sample' },
		author: { type: 'string', default: 'KMC 太郎' },
		genre: { type: 'string', default: 'tech' }
	}
});

const day = Number(opts.day);
if (!Number.isInteger(day) || day < 1 || day > 25) {
	console.error('--day は 1〜25 の整数で指定してください');
	process.exit(1);
}
const genre = opts.genre === 'none' ? null : opts.genre;
if (genre !== null && !GENRES.some((g) => g.key === genre)) {
	console.error(`--genre は ${GENRES.map((g) => g.key).join(' / ')} のどれか（未選択は none）`);
	process.exit(1);
}

const env = { ...process.env, ...(opts.channel ? { SLACK_CHANNEL_ID: opts.channel } : {}) };
const config = slackConfigFrom(env);
const origin = config?.origin ?? (env.ORIGIN?.trim().replace(/\/$/, '') || undefined);

/** --kind daily 用のサンプル予約（奇数日だけ埋まっている）。 */
const sampleReservations = Array.from({ length: 25 }, (_, i) => i + 1)
	.filter((d) => d % 2 === 1)
	.map((d) => ({ day: d, title: `サンプル記事 ${d}`, author: `KMC ${d}郎` }));

let message: ThreadedMessage & { text: string; blocks: unknown[] };
if (opts.kind === 'published') {
	message = messageOf(
		{ day, title: opts.title, url: opts.url, author: opts.author, genre },
		origin
	);
} else if (opts.kind === 'daily') {
	const today = opts.today ?? todayInJst();
	const daily = dailyMessageOf(sampleReservations, today, origin);
	if (!daily) {
		console.error(
			`${today} は日次メッセージを投稿しない日です（開始の5日前・前日以外の開始前か、最終日以降）。--today で日付を指定してください`
		);
		process.exit(1);
	}
	message = daily;
} else if (opts.kind === 'reminder') {
	const daysLeft = Number(opts['days-left']);
	message = reminderMessageOf({ day, title: opts.title, author: opts.author, daysLeft }, origin);
} else if (opts.kind === 'full') {
	message = fullMessageOf(
		Array.from({ length: 25 }, (_, i) => ({
			day: i + 1,
			title: `サンプル記事 ${i + 1}`,
			author: `KMC ${(i % 20) + 1}郎`
		})),
		origin
	);
} else if (opts.kind === 'complete') {
	message = completeMessageOf(
		Array.from({ length: 25 }, (_, i) => ({
			day: i + 1,
			title: `サンプル記事 ${i + 1}`,
			url: `https://zenn.dev/example/articles/sample-${i + 1}`,
			author: `KMC ${(i % 20) + 1}郎`
		})),
		origin
	);
} else {
	console.error('--kind は published / daily / reminder / full / complete のどれか');
	process.exit(1);
}

if (opts['dry-run']) {
	console.log(JSON.stringify({ blocks: message.blocks }, null, 2));
	for (const reply of message.thread ?? []) {
		console.log('\n--- スレッド ---');
		console.log(JSON.stringify({ blocks: reply.blocks }, null, 2));
	}
	console.log(`\n通知の文面: ${message.text}`);
	process.exit(0);
}

if (!config) {
	console.error(
		'SLACK_BOT_TOKEN と SLACK_CHANNEL_ID を .env に設定してください（--dry-run なら不要）'
	);
	process.exit(1);
}

await postWithThread(config, message);
console.log(
	`[slack] チャンネル ${config.channel} にテスト投稿しました（${opts.kind}）: ${message.text.split('\n')[0]}`
);
