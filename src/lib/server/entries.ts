import { dev } from '$app/env';
import { fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import {
	CALENDAR_YEAR,
	DAYS,
	dayOffset,
	dayStartMs,
	genreOf,
	GENRES,
	todayInJst,
	validateEntry,
	type PublicEntry
} from '#lib/calendar.ts';
import { db } from '#lib/server/db/index.ts';
import { entry, user } from '#lib/server/db/schema.ts';
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
		.orderBy(entry.day);

	return rows.map((row): PublicEntry => {
		const mine = row.authorId === viewerId;
		const visible = mine || dayOffset(row.day, today) <= 0;
		return {
			day: row.day,
			title: row.title,
			// 公開日前のURLは本人以外には送らない。
			url: visible ? row.url : null,
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
 * `?demo=25&today=2026-12-25` でコンプリート演出を確認できる。
 */
export function demoEntries(url: URL, today: string): PublicEntry[] | null {
	const raw = url.searchParams.get('demo');
	if (!dev || !raw || !/^\d{1,2}$/.test(raw)) return null;
	const count = Math.min(DAYS, Number(raw));

	return Array.from({ length: count }, (_, i): PublicEntry => {
		const day = i + 1;
		const link = `${DEMO_PLATFORMS[i % 3]}demo-${day}`;
		// 一部は前倒しで書き終わっている、という想定で投稿時刻をずらす。
		const postedAt = new Date(dayStartMs(day) + ((i * 7) % 20) * 3_600_000 - (i % 4 === 0 ? 3 * 86_400_000 : 0));
		return {
			day,
			title: DEMO_TITLES[i % DEMO_TITLES.length],
			url: dayOffset(day, today) <= 0 ? link : null,
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
export async function saveEntry(userId: string, day: number, form: FormData) {
	const rawTitle = String(form.get('title') ?? '');
	const rawUrl = String(form.get('url') ?? '');
	const rawGenre = String(form.get('genre') ?? '');
	const input = validateEntry(rawTitle, rawUrl, rawGenre);
	if (!input.ok) {
		return fail(400, { message: input.message, day, title: rawTitle, url: rawUrl, genre: rawGenre });
	}

	const saved = await db
		.insert(entry)
		.values({
			year: CALENDAR_YEAR,
			day,
			userId,
			title: input.title,
			url: input.url,
			genre: input.genre,
			postedAt: input.url ? new Date() : null
		})
		.onConflictDoUpdate({
			target: [entry.year, entry.day],
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
			message: 'この日はちょうど他の人が予約しました。別の日を選んでください。',
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
	return { saved: true as const, day, reserved: !input.url };
}

/** 自分の枠だけを取り消す。 */
export async function cancelEntry(userId: string, day: number) {
	await db
		.delete(entry)
		.where(and(eq(entry.year, CALENDAR_YEAR), eq(entry.day, day), eq(entry.userId, userId)));
}
