/**
 * エディタからの画像・ファイルのアップロード。サーバー（`/api/upload`）とブラウザで共有する。
 * 上げたものは `/uploads/{id}/{名前}` で配信され、本文にはこのパスがそのまま入る。
 */

/** 1ファイルの上限。Vercel の関数は本文が 4.5MB までなので、それより少し小さくする。 */
export const UPLOAD_MAX = 4 * 1024 * 1024;
/** 1人が上げられる合計。 */
export const UPLOAD_QUOTA = 200 * 1024 * 1024;

/** 受け付ける種類。HTML など、開くとスクリプトが動きうるものは入れない。 */
export const UPLOAD_TYPES: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/svg+xml': 'svg',
	'application/pdf': 'pdf',
	'application/zip': 'zip',
	'text/plain': 'txt',
	'text/csv': 'csv',
	'text/markdown': 'md',
	'application/msword': 'doc',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
	'application/vnd.ms-excel': 'xls',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
	'application/vnd.ms-powerpoint': 'ppt',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};
const BY_EXT = Object.fromEntries(Object.entries(UPLOAD_TYPES).map(([m, e]) => [e, m]));
Object.assign(BY_EXT, { jpeg: 'image/jpeg', markdown: 'text/markdown' });

/** ブラウザが種類を付けてこない（Finder の .md など）ときは拡張子から決める。 */
export function mimeOf(name: string, type: string) {
	if (type && UPLOAD_TYPES[type]) return type;
	const ext = name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? '';
	return BY_EXT[ext] || '';
}

/** 本文の中で、アップロードしたファイルを指すパス。 */
export const RE_UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9_-]+\/[^\s/?#]+$/;

/** URL に入れても困らないファイル名にする（拡張子は残す。ファイルブロックの記法が拡張子を見るため）。 */
export function safeName(name: string, mime: string) {
	const ext = UPLOAD_TYPES[mime] ?? 'bin';
	let base = name.replace(/\.[^.]*$/, '').normalize('NFC');
	base = base.replace(/[\s/\\?#%()[\]<>"'`|*:;!&=+$,{}^~]+/g, '-').replace(/^-+|-+$/g, '');
	return `${(base || 'file').slice(0, 60)}.${ext}`;
}

export const isImageMime = (m: string) => m.startsWith('image/');

// ───── ブラウザ側 ─────

/** これより大きい写真は、長い辺をこの長さに縮める。 */
const MAX_SIDE = 2000;

/**
 * 大きな写真は縮めてから上げる（スマホの写真は 4MB を超えがち）。
 * GIF（動きが消える）・SVG はそのまま。縮めても小さくならなければ元のまま。
 */
async function shrink(file: File): Promise<File> {
	if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
	let bmp: ImageBitmap;
	try {
		bmp = await createImageBitmap(file);
	} catch {
		return file;
	}
	const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
	if (scale === 1 && file.size <= 1024 * 1024) {
		bmp.close();
		return file;
	}
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bmp.width * scale);
	canvas.height = Math.round(bmp.height * scale);
	canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
	bmp.close();
	const enc = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.86));
	// WebP で書き出せないブラウザ（PNG が返ってくる）では JPEG にする。PNG はスクショなどの透過を残すため WebP を優先。
	let blob = await enc('image/webp');
	if (!blob || blob.type !== 'image/webp') blob = await enc('image/jpeg');
	if (!blob || blob.size >= file.size) return file;
	const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
	return new File([blob], file.name.replace(/\.[^.]*$/, '') + '.' + ext, { type: blob.type });
}

export type Uploaded = { url: string; name: string; image: boolean };

/** 1ファイルを上げる。失敗したら、画面にそのまま出せる日本語のメッセージで throw する。 */
export async function uploadFile(file: File): Promise<Uploaded> {
	const mime = mimeOf(file.name, file.type);
	if (!mime) throw new Error(`「${file.name}」はアップロードできない種類のファイルです`);
	const f = isImageMime(mime) ? await shrink(file) : file;
	if (f.size > UPLOAD_MAX) throw new Error(`「${file.name}」が大きすぎます（4MB まで）`);
	const body = new FormData();
	body.set('file', f, f.name);
	let res: Response;
	try {
		res = await fetch('/api/upload', { method: 'POST', body });
	} catch {
		throw new Error('アップロードできませんでした。通信状況を確認してください');
	}
	const data = await res.json().catch(() => null);
	if (!res.ok || !data?.url) throw new Error(data?.message || 'アップロードできませんでした');
	return { url: data.url, name: file.name, image: isImageMime(mime) };
}

/** ドラッグ・貼り付けで受け取った Markdown は、添付せずに本文として読み込む。 */
export const isTextImport = (f: File) => /\.(md|markdown)$/i.test(f.name);

/** 貼り付け・ドロップされたファイルを取り出す（文字だけなら空）。 */
export function filesOf(dt: DataTransfer | null): File[] {
	if (!dt) return [];
	return Array.from(dt.files ?? []);
}
