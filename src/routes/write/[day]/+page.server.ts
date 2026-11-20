import { CALENDAR_YEAR, DAYS, withCal } from '#lib/calendar.ts';
import { calOf } from '#lib/server/entries.ts';
import { loadDraft, myDays, savePost } from '#lib/server/posts.ts';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function parseDay(raw: string): number {
	const day = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
	if (!Number.isInteger(day) || day < 1 || day > DAYS) error(404, 'そんな日はありません');
	return day;
}

/** フォームの送信先（`?/save` など）ではなく、エディタのページに戻す。 */
function loginRedirect(url: URL, cal: number) {
	return redirect(303, `/login?redirectTo=${encodeURIComponent(withCal(url.pathname, cal))}`);
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const day = parseDay(params.day);
	const cal = calOf(url);
	if (!locals.user) return redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	const draft = await loadDraft(locals.user.id, cal, day);
	if (!draft) error(403, 'この日はあなたの担当ではありません');
	return { year: CALENDAR_YEAR, draft, days: await myDays(locals.user.id) };
};

export const actions: Actions = {
	save: async ({ request, params, locals, url }) => {
		const day = parseDay(params.day);
		const cal = calOf(url);
		if (!locals.user) return loginRedirect(url, cal);
		return savePost(locals.user.id, cal, day, await request.formData(), false);
	},
	publish: async ({ request, params, locals, url }) => {
		const day = parseDay(params.day);
		const cal = calOf(url);
		if (!locals.user) return loginRedirect(url, cal);
		return savePost(locals.user.id, cal, day, await request.formData(), true);
	}
};
