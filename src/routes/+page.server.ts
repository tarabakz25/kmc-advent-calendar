import { CALENDAR_YEAR } from '#lib/calendar.ts';
import { demoEntries, loadEntries, resolveToday, viewCalOf } from '#lib/server/entries.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const today = resolveToday(url);
	const entries = demoEntries(url, today) ?? (await loadEntries(locals.user?.id, today));
	return { year: CALENDAR_YEAR, today, entries, cal: viewCalOf(url, cookies) };
};
