import { CALENDAR_YEAR, DAYS } from '#lib/calendar.ts';
import { resolveToday } from '#lib/server/entries.ts';
import { loadPost } from '#lib/server/posts.ts';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const day = /^\d{1,2}$/.test(params.day) ? Number(params.day) : NaN;
	if (!Number.isInteger(day) || day < 1 || day > DAYS) error(404, 'そんな日はありません');
	const post = await loadPost(day, locals.user?.id, resolveToday(url));
	// 公開日前・下書き・存在しない、を見分けられないよう、すべて同じ 404 にする。
	if (!post) error(404, 'この記事はまだ公開されていません');
	return { year: CALENDAR_YEAR, post };
};
