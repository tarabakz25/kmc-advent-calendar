import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { entry, upload } from '#lib/server/db/schema.ts';

/** 本文の中で使っているアップロードの ID。 */
export function uploadIdsOf(md: string | null | undefined): string[] {
	return [
		...new Set(Array.from(String(md ?? '').matchAll(/\/uploads\/([A-Za-z0-9_-]+)\//g), (m) => m[1]))
	];
}

/** 一度も保存されなかったアップロードを消すまでの猶予（別のタブで書きかけの記事の画像を消さないため）。 */
const ORPHAN_GRACE = sql`now() - interval '1 day'`;

/**
 * どの記事の本文からも使われていない、この人のアップロードを消す。
 * - `removed`: いま本文から消えた ID。保存した時点ですぐ消す。
 * - それ以外は、上げてから1日たっても、どこにも使われていなければ消す（貼ったけど保存しなかったもの）。
 *
 * ほかの人の記事に URL が貼られていれば残す。記事の保存・枠の取り消しのあとに呼ぶ。
 */
export async function pruneUploads(userId: string, removed: string[] = []) {
	try {
		await db
			.delete(upload)
			.where(
				and(
					eq(upload.userId, userId),
					or(
						removed.length ? inArray(upload.id, removed) : sql`false`,
						lt(upload.createdAt, ORPHAN_GRACE)
					),
					sql`not exists (select 1 from ${entry} where strpos(${entry.body}, '/uploads/' || ${upload.id} || '/') > 0)`
				)
			);
	} catch (err) {
		// 掃除に失敗しても、保存そのものは成功扱いにする。
		console.error('[uploads] prune failed', err);
	}
}
