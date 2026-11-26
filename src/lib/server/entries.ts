import { dev } from '$app/env';
import { error, fail, type Cookies } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import {
	CAL_COOKIE,
	CAL_COOKIE_MAX_AGE,
	CALENDAR_YEAR,
	calName,
	CALENDARS,
	DAYS,
	dayOffset,
	dayStartMs,
	genreOf,
	GENRES,
	parseCal,
	todayInJst,
	validateEntry,
	type PublicEntry
} from '#lib/calendar.ts';
import { db } from '#lib/server/db/index.ts';
import { entry, user } from '#lib/server/db/schema.ts';
import { pruneUploads, uploadIdsOf } from '#lib/server/uploads.ts';
import { notifySlack } from '#lib/server/notify.ts';

/**
 * 「今日」の決定。開発中だけ `?today=2026-12-10` で日付を差し替えて、
 * 開催中・開催前・終了後の見た目を確認できる。
 */
export function resolveToday(url: URL): string {
	const override = url.searchParams.get('today');
	if (dev && override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
	return todayInJst();
}

/** `?cal=2` でカレンダー 2。無ければカレンダー 1。範囲外なら 404。 */
export function calOf(url: URL): number {
	const cal = parseCal(url.searchParams.get('cal'));
	if (cal === null) error(404, 'そんなカレンダーはありません');
	return cal;
}

/**
 * トップ・カレンダーページで見せるカレンダー。`?cal=` があればそれを使って覚え直し、
 * 無ければ前回見たカレンダー（cookie）、それも無ければカレンダー 1。
 */
export function viewCalOf(url: URL, cookies: Cookies): number {
	if (url.searchParams.has('cal')) {
		const cal = calOf(url);
		cookies.set(CAL_COOKIE, String(cal), { path: '/', maxAge: CAL_COOKIE_MAX_AGE, httpOnly: false, sameSite: 'lax' });
		return cal;
	}
	return parseCal(cookies.get(CAL_COOKIE)) ?? 1;
}

/** 読めるようになった時刻。URL 登録時刻と公開日 0 時の遅い方。 */
function publishedAtOf(day: number, url: string | null, postedAt: Date | null, today: string) {
	if (!url || dayOffset(day, today) > 0) return null;
	const posted = postedAt?.getTime() ?? dayStartMs(day);
	return new Date(Math.max(posted, dayStartMs(day))).toISOString();
}

/** 今年の登録を、閲覧者向けに加工して返す。 */
export async function loadEntries(viewerId: string | undefined, today: string) {
	const rows = await db
		.select({
			cal: entry.cal,
			day: entry.day,
			title: entry.title,
			url: entry.url,
			genre: entry.genre,
			postedAt: entry.postedAt,
			author: user.name,
			image: user.image,
			authorId: entry.userId
		})
		.from(entry)
		.innerJoin(user, eq(entry.userId, user.id))
		.where(eq(entry.year, CALENDAR_YEAR))
		.orderBy(entry.cal, entry.day);

	return rows.map((row): PublicEntry => {
		const mine = row.authorId === viewerId;
		const visible = mine || dayOffset(row.day, today) <= 0;
		return {
			cal: row.cal,
			day: row.day,
			title: row.title,
			// 公開日前のURLは本人以外には送らない。
			url: visible ? row.url : null,
			hasUrl: !!row.url,
			author: row.author,
			image: row.image ?? null,
			publishedAt: publishedAtOf(row.day, row.url, row.postedAt, today),
			genre: genreOf(row.genre)?.key ?? null,
			mine
		};
	});
}

const DEMO_NAMES = ['あおい', 'はると', 'みお', 'そうた', 'ゆい', 'れん', 'ひなた', 'こはる', 'いつき', 'さくら', 'りく', 'つむぎ'];
const DEMO_TITLES = [
	'神山の山で LoRa を飛ばしてみた',
	'はじめての Rust で自作 OS',
	'寮のごはんを画像分類した話',
	'Svelte 5 の runes を半年使った感想',
	'鮎喰川の水位を可視化する',
	'3D プリンタで作る部室の小物',
	'高専1年目にやってよかったこと',
	'Raspberry Pi で温室を自動化',
	'デザインの授業で学んだ余白の話',
	'競プロ緑になるまでの記録',
	'神山のすだちを ML で選別したい',
	'Blender で冬の神山を描く'
];
const DEMO_PLATFORMS = ['https://zenn.dev/x/articles/', 'https://qiita.com/x/items/', 'https://note.com/x/n/'];

/**
 * 開発中だけ `?demo=25` のように付けると、DB を使わず n 日分のダミー記事で表示する。
 * 25 を超えるとカレンダー 2 に続く（`?demo=30` ならカレンダー 1 が満枠、カレンダー 2 に 5 枠）。
 * `?demo=25&today=2026-12-25` でコンプリート演出を確認できる。
 */
export function demoEntries(url: URL, today: string): PublicEntry[] | null {
	const raw = url.searchParams.get('demo');
	if (!dev || !raw || !/^\d{1,2}$/.test(raw)) return null;
	const count = Math.min(DAYS * CALENDARS, Number(raw));

	return Array.from({ length: count }, (_, i): PublicEntry => {
		const cal = Math.floor(i / DAYS) + 1;
		const day = (i % DAYS) + 1;
		const link = `${DEMO_PLATFORMS[i % 3]}demo-${day}`;
		// 一部は前倒しで書き終わっている、という想定で投稿時刻をずらす。
		const postedAt = new Date(dayStartMs(day) + ((i * 7) % 20) * 3_600_000 - (i % 4 === 0 ? 3 * 86_400_000 : 0));
		return {
			cal,
			day,
			title: DEMO_TITLES[i % DEMO_TITLES.length],
			url: dayOffset(day, today) <= 0 ? link : null,
			hasUrl: true,
			author: DEMO_NAMES[(i * 5) % DEMO_NAMES.length],
			image: null,
			publishedAt: publishedAtOf(day, link, postedAt, today),
			genre: GENRES[(i * 3) % GENRES.length].key,
			mine: false
		};
	});
}

/**
 * 予約・更新。空き枠なら INSERT、自分の枠なら UPDATE、他人の枠なら何もしない。
 * 同時に2人が押しても unique 制約と setWhere でどちらか1人だけが通る。
 */
export async function saveEntry(userId: string, cal: number, day: number, form: FormData) {
	const rawTitle = String(form.get('title') ?? '');
	const rawUrl = String(form.get('url') ?? '');
	const rawGenre = String(form.get('genre') ?? '');
	const input = validateEntry(rawTitle, rawUrl, rawGenre, day, cal);
	if (!input.ok) {
		return fail(400, { message: input.message, cal, day, title: rawTitle, url: rawUrl, genre: rawGenre });
	}

	const saved = await db
		.insert(entry)
		.values({
			year: CALENDAR_YEAR,
			cal,
			day,
			userId,
			title: input.title,
			url: input.url,
			genre: input.genre,
			postedAt: input.url ? new Date() : null
		})
		.onConflictDoUpdate({
			target: [entry.year, entry.cal, entry.day],
			set: {
				title: input.title,
				url: input.url,
				genre: input.genre,
				// 初めて URL が入ったときだけ時刻を記録。URL の差し替えでは変えない。
				postedAt: input.url ? sql`coalesce(${entry.postedAt}, now())` : null,
				updatedAt: new Date()
			},
			setWhere: eq(entry.userId, userId)
		})
		.returning({ id: entry.id });

	if (saved.length === 0) {
		return fail(409, {
			message: `${calName(cal)} のこの日はちょうど他の人が予約しました。別の日を選んでください。`,
			cal,
			day,
			title: rawTitle,
			url: rawUrl,
			genre: rawGenre
		});
	}
	// 公開日を過ぎてから URL が登録されたら、Cron を待たずにすぐ Slack に投稿する。
	// サーバーレスでは応答後に処理が止まることがあるので、ここで待つ（失敗しても保存は成功扱い）。
	if (input.url && dayOffset(day, todayInJst()) <= 0) {
		await notifySlack().catch((err) => console.error('[slack]', err));
	}
	return { saved: true as const, cal, day, reserved: !input.url };
}

/** 自分の枠だけを取り消す。本文に入れていた画像・ファイルも消す。 */
export async function cancelEntry(userId: string, cal: number, day: number) {
	const gone = await db
		.delete(entry)
		.where(
			and(
				eq(entry.year, CALENDAR_YEAR),
				eq(entry.cal, cal),
				eq(entry.day, day),
				eq(entry.userId, userId)
			)
		)
		.returning({ body: entry.body });
	await pruneUploads(userId, gone.flatMap((r) => uploadIdsOf(r.body)));
}
