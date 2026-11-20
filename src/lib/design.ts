import { CALENDAR_YEAR, DAYS, isLocked, phaseOf, type PublicEntry } from './calendar.ts';

/** アクセントカラー（コーラル）。 */
export const ACCENT = '#F06A55';

export type TileColor = 'coral' | 'pine' | 'mint' | 'paper';

/**
 * カレンダーごとのタイルの並び。カレンダー・参加登録・記事一覧で同じ色を使う。
 * `c` は 1〜25 日の色、`s` はベントーグリッドで大きく見せる日の形（6 列 × ちょうど埋まる行数になるよう組んである）。
 * カレンダーが増えたら順に使い回す。
 */
const LAYOUTS: { c: TileColor[]; s: Record<number, string> }[] = [
	{
		c: [
			'coral', 'pine', 'mint', 'mint', 'coral', 'mint', 'coral', 'coral', 'paper', 'pine',
			'pine', 'mint', 'coral', 'mint', 'coral', 'pine', 'mint', 'paper', 'pine', 'mint',
			'paper', 'pine', 'mint', 'paper', 'coral'
		],
		s: { 2: 'w2', 4: 'h2', 8: 'w2', 10: 'big', 12: 'h2', 16: 'w2', 18: 'h2', 19: 'w2', 25: 'x4' }
	},
	{
		c: [
			'mint', 'pine', 'mint', 'coral', 'coral', 'pine', 'coral', 'mint', 'pine', 'mint',
			'pine', 'coral', 'mint', 'coral', 'pine', 'mint', 'pine', 'coral', 'mint', 'pine',
			'coral', 'mint', 'pine', 'coral', 'pine'
		],
		// H  H  01 02 02 03
		// H  H  04 05 06 03
		// 07 08 08 05 09 10
		// 07 08 08 11 12 10
		// 13 14 15 15 16 17
		// 18 14 19 20 16 21
		// 18 22 23 23 24 25
		s: { 2: 'w2', 3: 'h2', 5: 'h2', 7: 'h2', 8: 'big', 10: 'h2', 14: 'h2', 15: 'w2', 16: 'h2', 18: 'h2', 23: 'w2' }
	}
];
const layoutOf = (cal: number) => LAYOUTS[(cal - 1) % LAYOUTS.length];

export function colorOf(day: number, cal = 1): TileColor {
	return layoutOf(cal).c[day - 1];
}

/** モーダルなど、クラスではなく色の値が要るところ用。 */
export function colorValues(c: TileColor): { bg: string; fg: string } {
	switch (c) {
		case 'pine':
			return { bg: '#0F3B3A', fg: '#F3EEE6' };
		case 'mint':
			return { bg: '#CFE3D3', fg: '#0F3B3A' };
		case 'coral':
			return { bg: ACCENT, fg: '#1B1B1B' };
		default:
			return { bg: '#FFFFFF', fg: '#0F3B3A' };
	}
}

/** ベントーグリッドで大きく見せる日。 */
export function shapeOf(day: number, cal = 1): string {
	return layoutOf(cal).s[day] ?? '';
}

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export function weekdayEn(day: number): string {
	return WD_EN[new Date(Date.UTC(CALENDAR_YEAR, 11, day)).getUTCDay()];
}

export const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 未JOIN / 予約済み（URL未登録） / 登録済み（URLあり・公開日前） / 公開済み（URLあり・公開日以降）。
 * 登録済みでもリンク自体は公開日まで開けない。
 */
export type SlotStatus = 'open' | 'res' | 'reg' | 'done';
export const SLOT_STATUSES: SlotStatus[] = ['open', 'res', 'reg', 'done'];
export function statusOf(entry: PublicEntry | undefined, today: string): SlotStatus {
	if (!entry) return 'open';
	if (!entry.hasUrl) return 'res';
	return isLocked(entry.day, today) ? 'reg' : 'done';
}
export const STATUS_LABEL: Record<SlotStatus, string> = {
	open: '未JOIN',
	res: '予約済み',
	reg: '登録済み',
	done: '公開済み'
};
/** 1つのカレンダー分の entries を渡す。 */
export function statusCounts(entries: PublicEntry[], today: string): Record<SlotStatus, number> {
	const byDay = new Map(entries.map((e) => [e.day, e]));
	const c: Record<SlotStatus, number> = { open: 0, res: 0, reg: 0, done: 0 };
	for (let d = 1; d <= DAYS; d++) c[statusOf(byDay.get(d), today)]++;
	return c;
}

/** ヒーローの大きな数字。開催前は残り日数、開催中は何日目か、終了後は 25。 */
export function heroStatus(today: string) {
	const phase = phaseOf(today);
	if (phase.kind === 'before') {
		return { label: 'STARTS IN', num: pad(phase.daysToStart), sub: '日後に開幕', pre: '開幕まで あと', post: '日', todayDay: 0 };
	}
	if (phase.kind === 'running') {
		return { label: 'NOW OPEN', num: pad(phase.day), sub: '日目を公開中', pre: 'DAY', post: '公開中', todayDay: phase.day };
	}
	return { label: 'FINISHED', num: '25', sub: '日間ありがとうございました', pre: '', post: '日間ありがとうございました', todayDay: 26 };
}
