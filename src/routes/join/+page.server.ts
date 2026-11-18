import { CALENDAR_YEAR, DAYS } from '#lib/calendar.ts';
import { loadEntries, resolveToday, saveEntry } from '#lib/server/entries.ts';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function loginRedirect(url: URL) {
	return redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) return loginRedirect(url);

	const today = resolveToday(url);
	const entries = await loadEntries(locals.user.id, today);
	const taken = Object.fromEntries(entries.map((e) => [e.day, e.author]));

	// カレンダーの空き枠から来たときは、その日を選んだ状態で始める。
	const raw = Number(url.searchParams.get('day'));
	const day = Number.isInteger(raw) && raw >= 1 && raw <= DAYS && !taken[raw] ? raw : null;

	return { year: CALENDAR_YEAR, taken, day, name: locals.user.name };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user) return loginRedirect(url);
		const form = await request.formData();
		const day = Number(form.get('day'));
		if (!Number.isInteger(day) || day < 1 || day > DAYS) {
			return fail(400, { message: '日付を選んでください。' });
		}
		return saveEntry(locals.user.id, day, form);
	}
};
