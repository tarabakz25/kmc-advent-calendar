import { CALENDAR_YEAR, DAYS } from '#lib/calendar.ts';
import { loadDraft, myDays, savePost } from '#lib/server/posts.ts';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function parseDay(raw: string): number {
	const day = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
	if (!Number.isInteger(day) || day < 1 || day > DAYS) error(404, 'そんな日はありません');
	return day;
}

function loginRedirect(url: URL) {
	return redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const day = parseDay(params.day);
	if (!locals.user) return loginRedirect(url);
	const draft = await loadDraft(locals.user.id, day);
	if (!draft) error(403, 'この日はあなたの担当ではありません');
	return { year: CALENDAR_YEAR, draft, days: await myDays(locals.user.id) };
};

export const actions: Actions = {
	save: async ({ request, params, locals, url }) => {
		const day = parseDay(params.day);
		if (!locals.user) return loginRedirect(url);
		return savePost(locals.user.id, day, await request.formData(), false);
	},
	publish: async ({ request, params, locals, url }) => {
		const day = parseDay(params.day);
		if (!locals.user) return loginRedirect(url);
		return savePost(locals.user.id, day, await request.formData(), true);
	}
};
