import { CRON_SECRET } from '$app/env/private';
import { notifySlackAll } from '#lib/server/notify.ts';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Vercel Cron から呼ばれる（vercel.json の crons）。公開日を迎えた記事のお知らせ、
 * 毎朝の日次メッセージ（カウントダウン・明日の予告・空き枠の募集）、URL 未登録のリマインドを送る。
 * Vercel は `Authorization: Bearer $CRON_SECRET` を付けて呼ぶので、それ以外は弾く。
 */
export const GET: RequestHandler = async ({ request }) => {
	if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
		error(401, 'Unauthorized');
	}
	return json(await notifySlackAll());
};
