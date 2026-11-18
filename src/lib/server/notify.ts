import {
	ORIGIN,
	SLACK_BOT_TOKEN,
	SLACK_CHANNEL_ID,
	SLACK_POST_HOUR
} from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { notifyPublished, slackConfigFrom } from '#lib/server/slack.ts';

const config = slackConfigFrom({ ORIGIN, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID, SLACK_POST_HOUR });

/** 公開済みでまだ Slack に投稿していない記事を投稿する。Slack 未設定なら何もしない。 */
export async function notifySlack() {
	if (!config) return 0;
	return notifyPublished(db, config);
}
