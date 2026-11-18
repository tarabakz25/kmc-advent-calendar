/**
 * Slack 通知のテスト。サンプル記事の「公開のお知らせ」を、本番と同じテンプレートで投稿する。
 * DB には触らない（slack_notified_at も変えない）ので、何度実行してもよい。
 *
 *   bun run slack:test                     # サンプル記事で投稿
 *   bun run slack:test --dry-run           # 投稿せず、メッセージ(JSON)を表示するだけ
 *   bun run slack:test --day 12 --title "記事タイトル" --url https://... --author 名前 --genre tech
 *   bun run slack:test --genre none        # ジャンル未選択のときの見た目
 *   bun run slack:test --channel C0123456  # SLACK_CHANNEL_ID 以外のチャンネルに投稿
 *
 * 必要な環境変数: SLACK_BOT_TOKEN, SLACK_CHANNEL_ID（--dry-run なら不要）
 * 任意: ORIGIN（カレンダーへのリンク用）
 *
 * --dry-run の JSON は https://app.slack.com/block-kit-builder に貼ると見た目を確認できる。
 * 文面は src/lib/server/slack-templates.ts で変える。
 */
import { parseArgs } from 'node:util';
import { GENRES } from '../src/lib/calendar.ts';
import { messageOf, postMessage, slackConfigFrom } from '../src/lib/server/slack.ts';

const { values: opts } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		'dry-run': { type: 'boolean', default: false },
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

const message = messageOf(
	{ day, title: opts.title, url: opts.url, author: opts.author, genre },
	origin
);

if (opts['dry-run']) {
	console.log(JSON.stringify({ blocks: message.blocks }, null, 2));
	console.log(`\n通知の文面: ${message.text}`);
	process.exit(0);
}

if (!config) {
	console.error(
		'SLACK_BOT_TOKEN と SLACK_CHANNEL_ID を .env に設定してください（--dry-run なら不要）'
	);
	process.exit(1);
}

await postMessage(config, message);
console.log(
	`[slack] チャンネル ${config.channel} にテスト投稿しました: 12/${day}「${opts.title}」`
);
