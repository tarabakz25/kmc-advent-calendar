import { CALENDAR_YEAR, phaseOf, type PublicEntry } from './calendar.ts';

/** アクセントカラー（コーラル）。 */
export const ACCENT = '#F06A55';

/** 日ごとのタイルの色。カレンダー・参加登録・記事一覧で同じ色を使う。 */
const COLORS = [
	'coral', 'pine', 'mint', 'mint', 'coral', 'mint', 'coral', 'coral', 'paper', 'pine',
	'pine', 'mint', 'coral', 'mint', 'coral', 'pine', 'mint', 'paper', 'pine', 'mint',
	'paper', 'pine', 'mint', 'paper', 'coral'
] as const;
export type TileColor = (typeof COLORS)[number];

export function colorOf(day: number): TileColor {
	return COLORS[day - 1];
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
const SHAPES: Record<number, string> = { 2: 'w2', 4: 'h2', 8: 'w2', 10: 'big', 12: 'h2', 16: 'w2', 18: 'h2', 19: 'w2', 25: 'x4' };
export function shapeOf(day: number): string {
	return SHAPES[day] ?? '';
}

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export function weekdayEn(day: number): string {
	return WD_EN[new Date(Date.UTC(CALENDAR_YEAR, 11, day)).getUTCDay()];
}

export const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 空き / 予約済み / 登録済み（記事リンクあり）。
 * 他の人の URL は公開日まで届かない（loadEntries が null にする）ので、公開日前は「予約済み」に見える。
 */
export type SlotStatus = 'open' | 'res' | 'done';
export function statusOf(entry: PublicEntry | undefined): SlotStatus {
	if (!entry) return 'open';
	return entry.url ? 'done' : 'res';
}
export const STATUS_LABEL: Record<SlotStatus, string> = { open: '空き', res: '予約済み', done: '登録済み' };

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
