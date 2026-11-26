import { randomBytes } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { upload } from '#lib/server/db/schema.ts';
import { mimeOf, safeName, UPLOAD_MAX, UPLOAD_QUOTA } from '#lib/upload.ts';
import type { RequestHandler } from './$types';

/** エディタからの画像・ファイルのアップロード。ログインしている人だけ。 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'ログインしてください');
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		error(413, 'ファイルが大きすぎます（4MB まで）');
	}
	const file = form.get('file');
	if (!(file instanceof File) || !file.size) error(400, 'ファイルがありません');
	if (file.size > UPLOAD_MAX) error(413, 'ファイルが大きすぎます（4MB まで）');
	const mime = mimeOf(file.name, file.type);
	if (!mime) error(415, 'この種類のファイルはアップロードできません');

	const [{ used }] = await db
		.select({ used: sql<number>`coalesce(sum(${upload.size}), 0)::int` })
		.from(upload)
		.where(eq(upload.userId, locals.user.id));
	if (used + file.size > UPLOAD_QUOTA) error(413, 'アップロードできる容量（200MB）を超えました');

	const id = randomBytes(12).toString('base64url');
	const name = safeName(file.name, mime);
	await db.insert(upload).values({
		id,
		userId: locals.user.id,
		name,
		mime,
		size: file.size,
		data: Buffer.from(await file.arrayBuffer())
	});
	// safeName で記号・空白は落としてあるので、日本語のまま URL にする（Markdown で読みやすいように）。
	return json({ url: `/uploads/${id}/${name}` });
};
