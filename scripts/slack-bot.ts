/**
 * その日の記事が公開されたら Slack に投稿する常駐ワーカー（Docker で動かす場合）。
 * Vercel では常駐できないので、代わりに Cron（/api/cron/slack）が同じ処理を呼ぶ。
 *
 *   bun scripts/slack-bot.ts           # 常駐（5分ごとに確認）
 *   bun scripts/slack-bot.ts --once    # 1回だけ確認して終了
 *   bun scripts/slack-bot.ts --test    # 設定確認用のテスト投稿だけして終了
 *
 * サンプル記事の「公開のお知らせ」を試しに投稿するなら scripts/slack-test.ts を使う。
 *
 * 必要な環境変数: DATABASE_URL, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID
 * 任意: ORIGIN（カレンダーへのリンク用）, SLACK_POST_HOUR（この時刻(JST)より前は投稿しない。既定 8）
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { notifyPublished, postMessage, slackConfigFrom } from '../src/lib/server/slack.ts';
import { SLACK_TEMPLATES } from '../src/lib/server/slack-templates.ts';

const INTERVAL_MS = 5 * 60_000;

const config = slackConfigFrom(process.env);
const args = new Set(process.argv.slice(2));

if (!config) {
	console.log('[slack] SLACK_BOT_TOKEN / SLACK_CHANNEL_ID が未設定なので、Slack 投稿は無効です。');
	// コンテナが再起動を繰り返さないよう、常駐モードでは何もせず待つ。
	if (args.has('--once') || args.has('--test')) process.exit(0);
	await new Promise(() => {});
	throw new Error('unreachable');
}

if (args.has('--test')) {
	await postMessage(config, { text: SLACK_TEMPLATES.test });
	console.log('[slack] テスト投稿しました');
	process.exit(0);
}

const client = postgres(process.env.DATABASE_URL ?? '', { max: 2, prepare: false });
const db = drizzle(client);

if (args.has('--once')) {
	await notifyPublished(db, config);
	await client.end();
	process.exit(0);
}

console.log(`[slack] 起動しました（${config.postHour}時(JST)以降、5分ごとに確認）`);
for (;;) {
	try {
		await notifyPublished(db, config);
	} catch (err) {
		console.error('[slack]', err);
	}
	await Bun.sleep(INTERVAL_MS);
}
