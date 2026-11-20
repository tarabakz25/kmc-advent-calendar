import { withCal } from '#lib/calendar.ts';
import { myDays } from '#lib/server/posts.ts';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** 「記事を書く」の入口。自分の担当日のエディタへ。まだ担当日がなければ参加登録へ。 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) return redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	const days = await myDays(locals.user.id);
	// 複数日を担当しているなら、まだ投稿していない日を優先する。
	const target = days.find((d) => d.status !== 'submitted') ?? days[0];
	return redirect(
		303,
		target ? withCal(`/write/${target.day}`, target.cal, url.search) : `/join${url.search}`
	);
};
