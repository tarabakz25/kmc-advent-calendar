/** 開催年。次の年にやるときはここを変えるだけで、年ごとにデータが分かれる。 */
export const CALENDAR_YEAR = 2026;
/** 12月1日〜25日 */
export const DAYS = 25;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** JST の今日を `YYYY-MM-DD` で返す。サーバーの TZ に依存しない。 */
export function todayInJst(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

const DAY_MS = 86_400_000;

/** 12月 `day` 日が今日から見て何日後か。0 = 今日、負 = 過去。 */
export function dayOffset(day: number, today: string): number {
	const target = Date.UTC(CALENDAR_YEAR, 11, day);
	return Math.round((target - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** 公開日（12月 `day` 日 0 時 JST）より前か。前なら記事はまだ読めない。 */
export function isLocked(day: number, today: string): boolean {
	return dayOffset(day, today) > 0;
}

export function weekdayOf(day: number): string {
	return WEEKDAYS[new Date(Date.UTC(CALENDAR_YEAR, 11, day)).getUTCDay()];
}

export type Phase =
	| { kind: 'before'; daysToStart: number }
	| { kind: 'running'; day: number }
	| { kind: 'after' };

export function phaseOf(today: string): Phase {
	const toStart = dayOffset(1, today);
	if (toStart > 0) return { kind: 'before', daysToStart: toStart };
	if (dayOffset(DAYS, today) < 0) return { kind: 'after' };
	return { kind: 'running', day: -toStart + 1 };
}

/** 画面に渡す1日分の登録内容。メールアドレスなどは含めない。 */
export type PublicEntry = {
	day: number;
	title: string;
	/** 公開日前は本人以外には null（ネタバレ防止）。 */
	url: string | null;
	author: string;
	/** 著者のアイコン（Google のプロフィール画像）。 */
	image: string | null;
	/**
	 * 読めるようになった時刻（ISO）。URL 登録時刻と公開日の 0 時（JST）の遅い方。
	 * まだ読めない記事は null。タイムラインの並び順に使う。
	 */
	publishedAt: string | null;
	genre: Genre | null;
	mine: boolean;
};

/** 記事のジャンル。記事一覧の絞り込みと、カードのチップに使う。 */
export const GENRES = [
	{ key: 'tech', label: 'テクノロジー', color: '#3B82C4' },
	{ key: 'design', label: 'デザイン', color: '#F06A55' },
	{ key: 'entre', label: 'アントレプレナー', color: '#E8B04A' },
	{ key: 'other', label: 'その他', color: '#8A8274' }
] as const;
export type Genre = (typeof GENRES)[number]['key'];

export function genreOf(key: string | null | undefined) {
	return GENRES.find((g) => g.key === key) ?? null;
}

/** 12月 `day` 日 0:00（JST）の時刻。 */
export function dayStartMs(day: number): number {
	return Date.UTC(CALENDAR_YEAR, 11, day) - 9 * 3_600_000;
}

/** 25日分すべての記事が公開された状態。 */
export function isComplete(entries: PublicEntry[], today: string): boolean {
	return (
		entries.length === DAYS && entries.every((e) => stateOf(e, e.day, today) === 'published')
	);
}

/** 状態の導出。表示側はこれだけを見て出し分ける。 */
export type DayState = 'open' | 'reserved' | 'published';

export function stateOf(entry: PublicEntry | undefined, day: number, today: string): DayState {
	if (!entry) return 'open';
	return entry.url && dayOffset(day, today) <= 0 ? 'published' : 'reserved';
}

const PLATFORMS: [RegExp, string][] = [
	[/(^|\.)qiita\.com$/, 'Qiita'],
	[/(^|\.)zenn\.dev$/, 'Zenn'],
	[/(^|\.)note\.com$/, 'note'],
	[/(^|\.)hatenablog\.(com|jp)$|(^|\.)hatena\.ne\.jp$/, 'はてなブログ'],
	[/(^|\.)github\.(com|io)$/, 'GitHub'],
	[/(^|\.)medium\.com$/, 'Medium'],
	[/(^|\.)dev\.to$/, 'DEV'],
	[/(^|\.)notion\.(site|so)$/, 'Notion'],
	[/(^|\.)docs\.google\.com$/, 'Google Docs'],
	[/(^|\.)speakerdeck\.com$/, 'Speaker Deck'],
	[/(^|\.)slideshare\.net$/, 'SlideShare'],
	[/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'YouTube'],
	[/(^|\.)x\.com$|(^|\.)twitter\.com$/, 'X']
];

/** URLから掲載先メディア名を推測する。知らないサイトはホスト名をそのまま返す。 */
export function platformOf(url: string): string {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, '');
	} catch {
		return 'Link';
	}
}

export const TITLE_MAX = 80;
export const URL_MAX = 500;

export type EntryInput =
	| { ok: true; title: string; url: string | null; genre: Genre | null }
	| { ok: false; message: string };

/** 登録フォームの検証。`javascript:` などを弾くため http(s) だけを許す。 */
export function validateEntry(rawTitle: string, rawUrl: string, rawGenre = ''): EntryInput {
	const title = rawTitle.trim();
	const url = rawUrl.trim();
	const genre = genreOf(rawGenre.trim())?.key ?? null;

	if (!title) return { ok: false, message: 'タイトルを入力してください。' };
	if (title.length > TITLE_MAX) {
		return { ok: false, message: `タイトルは${TITLE_MAX}文字以内にしてください。` };
	}
	if (!url) return { ok: true, title, url: null, genre };

	if (url.length > URL_MAX) return { ok: false, message: 'URLが長すぎます。' };
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, message: 'URLの形式が正しくありません（https:// から入力してください）。' };
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		return { ok: false, message: 'URLは http:// か https:// で始まるものだけ登録できます。' };
	}
	return { ok: true, title, url: parsed.href, genre };
}

/** ログイン後の戻り先。同一オリジンの相対パスだけを許す（オープンリダイレクト対策）。 */
export function safeRedirect(target: unknown): string {
	return typeof target === 'string' && /^\/(?![/\\])/.test(target) ? target : '/';
}

/** ログインできるメールアドレスのドメイン（サブドメインも可）。 */
export const SCHOOL_EMAIL_DOMAIN = 'kamiyama.ac.jp';

export function isSchoolEmail(email: string): boolean {
	const match = /^[^\s@]+@([^\s@]+)$/.exec(email.trim().toLowerCase());
	if (!match) return false;
	const domain = match[1];
	return domain === SCHOOL_EMAIL_DOMAIN || domain.endsWith(`.${SCHOOL_EMAIL_DOMAIN}`);
}
