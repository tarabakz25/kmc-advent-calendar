import { fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import {
	CALENDAR_YEAR,
	dayOffset,
	genreOf,
	isPostPath,
	postPath,
	TITLE_MAX,
	todayInJst
} from '#lib/calendar.ts';
import { BODY_MAX } from '#lib/markdown.ts';
import { db } from '#lib/server/db/index.ts';
import { entry, user } from '#lib/server/db/schema.ts';
import { notifySlack } from '#lib/server/notify.ts';

/**
 * サイト内の記事の状態。
 * - new: まだ本文を保存していない
 * - draft: 下書き（本文はあるが、記事URLはこのページを指していない）
 * - submitted: 投稿済み（記事URLが `/posts/{day}`）
 */
export type PostStatus = 'new' | 'draft' | 'submitted';

function statusOf(body: string | null, url: string | null, day: number): PostStatus {
	if (url === postPath(day)) return 'submitted';
	return body === null ? 'new' : 'draft';
}

/** 1日分の記事を、著者名つきで取る。 */
async function find(day: number) {
	const [row] = await db
		.select({
			day: entry.day,
			title: entry.title,
			url: entry.url,
			genre: entry.genre,
			body: entry.body,
			postedAt: entry.postedAt,
			userId: entry.userId,
			author: user.name,
			image: user.image
		})
		.from(entry)
		.innerJoin(user, eq(entry.userId, user.id))
		.where(and(eq(entry.year, CALENDAR_YEAR), eq(entry.day, day)));
	return row ?? null;
}

/** エディタ用。自分の枠でなければ null。 */
export async function loadDraft(userId: string, day: number) {
	const row = await find(day);
	if (!row || row.userId !== userId) return null;
	return {
		day,
		title: row.title,
		genre: genreOf(row.genre)?.key ?? null,
		body: row.body ?? '',
		status: statusOf(row.body, row.url, day),
		/** 外部メディアの URL が登録済みなら、投稿するとこのページに置き換わることを知らせる。 */
		externalUrl: row.url && !isPostPath(row.url) ? row.url : null,
		author: row.author,
		image: row.image ?? null
	};
}

/**
 * 記事ページ用。公開済みなら誰でも、本人なら公開日前や下書きでも読める。
 * 読めないときは null（存在を知らせないよう、どれも 404 にする）。
 */
export async function loadPost(day: number, viewerId: string | undefined, today: string) {
	const row = await find(day);
	if (!row || row.body === null) return null;
	const mine = row.userId === viewerId;
	const status = statusOf(row.body, row.url, day);
	const locked = dayOffset(day, today) > 0;
	if (!mine && (status !== 'submitted' || locked)) return null;
	return {
		day,
		title: row.title,
		genre: genreOf(row.genre)?.key ?? null,
		body: row.body,
		author: row.author,
		image: row.image ?? null,
		mine,
		status,
		locked
	};
}

/** 自分の枠のサイト内記事の一覧（エディタへの入口用）。 */
export async function myDays(userId: string) {
	const rows = await db
		.select({ day: entry.day, url: entry.url, body: entry.body })
		.from(entry)
		.where(and(eq(entry.year, CALENDAR_YEAR), eq(entry.userId, userId)))
		.orderBy(entry.day);
	return rows.map((r) => ({ day: r.day, status: statusOf(r.body, r.url, r.day) }));
}

/**
 * 下書き保存・投稿。どちらもタイトル・ジャンル・本文を保存し、投稿のときだけ記事URLをこのページにする。
 * 他人の枠は where で弾く（更新件数 0 になる）。
 */
export async function savePost(userId: string, day: number, form: FormData, publish: boolean) {
	const title = String(form.get('title') ?? '').trim();
	const genre = genreOf(String(form.get('genre') ?? '').trim())?.key ?? null;
	const body = String(form.get('body') ?? '').replace(/\r\n?/g, '\n');

	if (title.length > TITLE_MAX)
		return fail(400, { message: `タイトルは${TITLE_MAX}文字以内にしてください。` });
	if (body.length > BODY_MAX)
		return fail(400, { message: `本文は${BODY_MAX.toLocaleString()}文字以内にしてください。` });
	if (publish) {
		if (!title) return fail(400, { message: 'タイトルを入力してください' });
		if (!body.trim()) return fail(400, { message: '本文が空です' });
	}

	const url = postPath(day);
	const saved = await db
		.update(entry)
		.set({
			// 下書きではタイトルが空でも本文を失わないよう、元のタイトルを残す。
			...(title ? { title } : {}),
			genre,
			body,
			...(publish ? { url, postedAt: sql`coalesce(${entry.postedAt}, now())` } : {}),
			updatedAt: new Date()
		})
		.where(and(eq(entry.year, CALENDAR_YEAR), eq(entry.day, day), eq(entry.userId, userId)))
		.returning({ url: entry.url });

	if (saved.length === 0) return fail(403, { message: 'この日はあなたの担当ではありません。' });

	// 公開日を過ぎてから投稿したら、Cron を待たずに Slack に流す（entries.ts の saveEntry と同じ）。
	if (publish && dayOffset(day, todayInJst()) <= 0) {
		await notifySlack().catch((err) => console.error('[slack]', err));
	}
	return { saved: true as const, status: statusOf(body, saved[0].url, day) };
}
