import { redirect } from '@sveltejs/kit';
import { CALENDAR_YEAR } from '#lib/calendar.ts';
import { isReportOpen, reportStats } from '#lib/report.ts';
import { demoEntries, loadEntries, resolveToday } from '#lib/server/entries.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const today = resolveToday(url);
	// 12月26日になるまでは公開しない。直接開かれたらトップへ戻す。
	if (!isReportOpen(today)) redirect(303, `/${url.search}`);

	const entries = demoEntries(url, today) ?? (await loadEntries(locals.user?.id, today));
	return { year: CALENDAR_YEAR, stats: reportStats(entries, today) };
};
