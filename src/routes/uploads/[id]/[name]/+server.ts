import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { upload } from '#lib/server/db/schema.ts';
import { isImageMime } from '#lib/upload.ts';
import type { RequestHandler } from './$types';

/**
 * アップロードしたファイルの配信。中身は変わらないので長くキャッシュさせる。
 * SVG などを直接開かれてもスクリプトが動かないよう、CSP の sandbox を付ける（PDF は除く）。
 */
export const GET: RequestHandler = async ({ params }) => {
	if (!/^[A-Za-z0-9_-]{8,32}$/.test(params.id)) error(404, '見つかりません');
	const [row] = await db
		.select({ name: upload.name, mime: upload.mime, data: upload.data })
		.from(upload)
		.where(eq(upload.id, params.id));
	if (!row) error(404, '見つかりません');
	const inline =
		isImageMime(row.mime) || row.mime === 'application/pdf' || row.mime.startsWith('text/');
	return new Response(new Uint8Array(row.data), {
		headers: {
			'content-type': row.mime.startsWith('text/') ? `${row.mime}; charset=utf-8` : row.mime,
			'content-length': String(row.data.length),
			'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
			'cache-control': 'public, max-age=31536000, immutable',
			// PDF に sandbox を付けると Chrome の PDF ビューアが開けなくなるので、PDF だけ外す。
			...(row.mime === 'application/pdf'
				? {}
				: { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" }),
			'x-content-type-options': 'nosniff'
		}
	});
};
