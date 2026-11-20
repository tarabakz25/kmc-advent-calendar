import { CAL_LIST, CALENDAR_YEAR, DAYS, parseCal } from '#lib/calendar.ts';
import { calOf, loadEntries, resolveToday, saveEntry } from '#lib/server/entries.ts';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function loginRedirect(url: URL) {
	return redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) return loginRedirect(url);

	const today = resolveToday(url);
	const entries = await loadEntries(locals.user.id, today);
	/** カレンダーごとの、埋まっている日 → 書く人。 */
	const taken: Record<number, Record<number, string>> = Object.fromEntries(
		CAL_LIST.map((c) => [c, {}])
	);
	for (const e of entries) if (taken[e.cal]) taken[e.cal][e.day] = e.author;

	// カレンダーの指定がなければ、まだ空きのある最初のカレンダーを開く。
	const firstOpen = CAL_LIST.find((c) => Object.keys(taken[c]).length < DAYS) ?? 1;
	const cal = url.searchParams.has('cal') ? calOf(url) : firstOpen;

	// カレンダーの空き枠から来たときは、その日を選んだ状態で始める。
	const raw = Number(url.searchParams.get('day'));
	const day = Number.isInteger(raw) && raw >= 1 && raw <= DAYS && !taken[cal][raw] ? raw : null;

	return { year: CALENDAR_YEAR, taken, cal, day, name: locals.user.name };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user) return loginRedirect(url);
		const form = await request.formData();
		const day = Number(form.get('day'));
		const cal = parseCal(String(form.get('cal') ?? ''));
		if (!Number.isInteger(day) || day < 1 || day > DAYS) {
			return fail(400, { message: '日付を選んでください。' });
		}
		if (cal === null) return fail(400, { message: 'カレンダーを選んでください。' });
		return saveEntry(locals.user.id, cal, day, form);
	}
};
