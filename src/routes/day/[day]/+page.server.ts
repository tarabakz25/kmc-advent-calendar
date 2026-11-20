import { CALENDAR_YEAR, DAYS, dayOffset, withCal } from '#lib/calendar.ts';
import { calOf, cancelEntry, loadEntries, resolveToday, saveEntry } from '#lib/server/entries.ts';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function parseDay(raw: string): number {
	const day = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
	if (!Number.isInteger(day) || day < 1 || day > DAYS) error(404, 'そんな日はありません');
	return day;
}

/** フォームの送信先（`?/save` など）ではなく、その日のページに戻す。 */
function loginRedirect(url: URL, cal: number) {
	return redirect(303, `/login?redirectTo=${encodeURIComponent(withCal(url.pathname, cal))}`);
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const day = parseDay(params.day);
	const cal = calOf(url);
	const today = resolveToday(url);
	const entries = await loadEntries(locals.user?.id, today);

	return {
		year: CALENDAR_YEAR,
		cal,
		day,
		today,
		isFuture: dayOffset(day, today) > 0,
		entry: entries.find((e) => e.cal === cal && e.day === day) ?? null,
		loggedIn: Boolean(locals.user)
	};
};

export const actions: Actions = {
	/** 予約も更新も同じ操作。他人の枠は絶対に書き換えない。カレンダーのモーダルからも呼ばれる。 */
	save: async ({ request, params, locals, url }) => {
		const day = parseDay(params.day);
		const cal = calOf(url);
		if (!locals.user) return loginRedirect(url, cal);
		return saveEntry(locals.user.id, cal, day, await request.formData());
	},

	cancel: async ({ params, locals, url }) => {
		const day = parseDay(params.day);
		const cal = calOf(url);
		if (!locals.user) return loginRedirect(url, cal);
		await cancelEntry(locals.user.id, cal, day);
		return redirect(303, withCal('/calendar', cal));
	}
};
