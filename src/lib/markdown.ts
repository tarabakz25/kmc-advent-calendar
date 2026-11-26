/**
 * サイト内で書く記事の Markdown。エディタ（GUI / Markdown）・プレビュー・記事ページで共有する。
 *
 * ブロック: 見出し1〜3・段落（中央 / 右寄せ）・箇条書き・番号付きリスト・引用（出典つき）・コード・
 * 画像・埋め込み（URL だけの行 → リンクカード）・ファイル（[名前.pdf](URL)）・目次（[toc]）・区切り線。
 * 行内: **太字** __太字__ *斜体* ~~取り消し線~~ `コード` [リンク](https://…)。
 *
 * `<p align="center">` は記法として読むだけで、HTML としては一切通さない。リンク・画像は http(s) だけ
 * （画像・ファイルは、エディタからアップロードした `/uploads/…` も可）。
 */

import { RE_UPLOAD_PATH } from './upload.ts';

export type BlockType =
	| 'p'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'ul'
	| 'ol'
	| 'quote'
	| 'code'
	| 'img'
	| 'embed'
	| 'file'
	| 'toc'
	| 'hr';

export type Align = '' | 'center' | 'right';

export type Block = {
	id: number;
	type: BlockType;
	/** 本文。画像ならキャプション（代替テキスト）、ファイルならファイル名。 */
	text: string;
	/** コードブロックの言語。 */
	lang: string;
	/** 画像・埋め込み・ファイルの URL。 */
	url: string;
	/** 引用の出典。 */
	cite: string;
	/** 段落の配置。 */
	align: Align;
};

/** 本文の上限（文字数）。 */
export const BODY_MAX = 100_000;

let nextId = 1;
export function blk(type: BlockType, text = '', extra: Partial<Block> = {}): Block {
	return { id: nextId++, type, text, lang: '', url: '', cite: '', align: '', ...extra };
}

const RE_FENCE = /^```\s*(\S*)/;
const RE_HEAD = /^(#{1,3})\s+(.*)$/;
const RE_HR = /^(-{3,}|\*{3,})\s*$/;
const RE_IMG = /^!\[([^\]]*)\]\(([^)\s]*)\)\s*$/;
const RE_QUOTE = /^>\s?/;
const RE_UL = /^\s*[-*+]\s+/;
const RE_OL = /^\s*\d+[.)]\s+/;
const RE_ALIGN = /^<p align="(center|right)">([\s\S]*)$/;
const RE_ALIGN_END = /<\/p>\s*$/;
const RE_EMBED = /^https?:\/\/\S+\s*$/;
const RE_FILE =
	/^\[([^\]]+)\]\(((?:https?:\/\/|\/uploads\/)[^)\s]+\.(?:pdf|docx?|xlsx?|pptx?|zip|txt|csv|key|pages|numbers|md))\)\s*$/i;
const RE_TOC = /^\[toc\]\s*$/i;
/** 引用の最後の行が「— 出典」なら出典として扱う。 */
const RE_CITE = /^(?:—|―|--)\s*(.+)$/;

function isStart(l: string) {
	return (
		RE_ALIGN.test(l) ||
		RE_EMBED.test(l) ||
		RE_FILE.test(l) ||
		RE_TOC.test(l) ||
		/^```/.test(l) ||
		/^#{1,3}\s+/.test(l) ||
		RE_QUOTE.test(l) ||
		RE_UL.test(l) ||
		RE_OL.test(l) ||
		RE_HR.test(l) ||
		RE_IMG.test(l)
	);
}

export function parse(md: string): Block[] {
	const lines = String(md || '')
		.replace(/\r/g, '')
		.split('\n');
	const out: Block[] = [];
	let i = 0;
	let m: RegExpMatchArray | null;
	while (i < lines.length) {
		const l = lines[i];
		if (/^\s*$/.test(l)) {
			i++;
			continue;
		}
		if ((m = l.match(RE_FENCE))) {
			const buf: string[] = [];
			i++;
			while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
			i++;
			out.push(blk('code', buf.join('\n'), { lang: m[1] || '' }));
			continue;
		}
		if ((m = l.match(RE_ALIGN))) {
			// 閉じタグまで。閉じ忘れても、空行で段落を終える（以降の本文を飲み込まない）。
			const buf = [m[2]];
			i++;
			while (!RE_ALIGN_END.test(buf[buf.length - 1]) && i < lines.length && !/^\s*$/.test(lines[i]))
				buf.push(lines[i++]);
			out.push(blk('p', buf.join('\n').replace(RE_ALIGN_END, ''), { align: m[1] as Align }));
			continue;
		}
		if (RE_EMBED.test(l)) {
			out.push(blk('embed', '', { url: l.trim() }));
			i++;
			continue;
		}
		if ((m = l.match(RE_FILE))) {
			out.push(blk('file', m[1], { url: m[2] }));
			i++;
			continue;
		}
		if (RE_TOC.test(l)) {
			out.push(blk('toc'));
			i++;
			continue;
		}
		if ((m = l.match(RE_HEAD))) {
			out.push(blk(`h${m[1].length}` as BlockType, m[2]));
			i++;
			continue;
		}
		if (RE_HR.test(l)) {
			out.push(blk('hr'));
			i++;
			continue;
		}
		if ((m = l.match(RE_IMG))) {
			out.push(blk('img', m[1], { url: m[2] }));
			i++;
			continue;
		}
		if (RE_QUOTE.test(l)) {
			const buf: string[] = [];
			while (i < lines.length && RE_QUOTE.test(lines[i]))
				buf.push(lines[i++].replace(RE_QUOTE, ''));
			let cite = '';
			if (buf.length > 1 && (m = buf[buf.length - 1].match(RE_CITE))) {
				cite = m[1];
				buf.pop();
			}
			out.push(blk('quote', buf.join('\n'), { cite }));
			continue;
		}
		if (RE_UL.test(l)) {
			while (i < lines.length && RE_UL.test(lines[i]))
				out.push(blk('ul', lines[i++].replace(RE_UL, '')));
			continue;
		}
		if (RE_OL.test(l)) {
			while (i < lines.length && RE_OL.test(lines[i]))
				out.push(blk('ol', lines[i++].replace(RE_OL, '')));
			continue;
		}
		const buf: string[] = [];
		do buf.push(lines[i++]);
		while (i < lines.length && !/^\s*$/.test(lines[i]) && !isStart(lines[i]));
		out.push(blk('p', buf.join('\n')));
	}
	return out;
}

export function serialize(blocks: Block[]): string {
	let out = '';
	let num = 0;
	blocks.forEach((b, i) => {
		const prev = blocks[i - 1];
		const t = b.text || '';
		const one = t.replace(/\n/g, ' ');
		const sameList = !!prev && prev.type === b.type && (b.type === 'ul' || b.type === 'ol');
		num = b.type === 'ol' ? (sameList ? num + 1 : 1) : 0;
		let line: string;
		switch (b.type) {
			case 'h1':
				line = `# ${one}`;
				break;
			case 'h2':
				line = `## ${one}`;
				break;
			case 'h3':
				line = `### ${one}`;
				break;
			case 'ul':
				line = `- ${one}`;
				break;
			case 'ol':
				line = `${num}. ${one}`;
				break;
			case 'quote':
				line =
					t
						.split('\n')
						.map((x) => `> ${x}`)
						.join('\n') + (b.cite ? `\n> — ${b.cite.replace(/\n/g, ' ')}` : '');
				break;
			case 'code':
				line = '```' + (b.lang || '') + '\n' + t + '\n```';
				break;
			case 'img':
				line = `![${t.replace(/[\]\n]/g, ' ')}](${b.url || ''})`;
				break;
			case 'embed':
				line = b.url || '';
				break;
			case 'file':
				line = `[${t.replace(/[\]\n]/g, ' ') || 'ファイル'}](${b.url || ''})`;
				break;
			case 'toc':
				line = '[toc]';
				break;
			case 'hr':
				line = '---';
				break;
			default:
				line = b.align ? `<p align="${b.align}">${t}</p>` : t;
		}
		out += (i === 0 ? '' : sameList ? '\n' : '\n\n') + line;
	});
	return out;
}

export type Seg = { text: string; cls: '' | 'i-b' | 'i-i' | 'i-s' | 'i-c'; href: string | null };

const isHttp = (u: string) => /^https?:\/\//i.test(u);
/** 画像・ファイルの URL として使えるか（http(s) か、アップロードしたファイル）。 */
export const isMediaUrl = (u: string) => isHttp(u) || RE_UPLOAD_PATH.test(u);

/** 行内の記法を分解する。リンクは http(s) のものだけを通す。 */
export function inline(text: string): Seg[] {
	const segs: Seg[] = [];
	// __太字__ は `__init__` のような識別子を巻き込まないよう、前後が英数字でないときだけ。
	const re =
		/(`[^`]+`)|(\*\*[^*]+\*\*)|((?<![\p{L}\p{N}_])__[^_]+__(?![\p{L}\p{N}_]))|(~~[^~]+~~)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/gu;
	let last = 0;
	let m: RegExpExecArray | null;
	const push = (t: string, cls: Seg['cls'] = '') => {
		if (t) segs.push({ text: t, cls, href: null });
	};
	while ((m = re.exec(text))) {
		push(text.slice(last, m.index));
		const tok = m[0];
		if (m[1]) push(tok.slice(1, -1), 'i-c');
		else if (m[2] || m[3]) push(tok.slice(2, -2), 'i-b');
		else if (m[4]) push(tok.slice(2, -2), 'i-s');
		else if (m[5]) push(tok.slice(1, -1), 'i-i');
		else {
			const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
			if (lm && isHttp(lm[2])) segs.push({ text: lm[1], cls: '', href: lm[2] });
			else push(tok);
		}
		last = m.index + tok.length;
	}
	push(text.slice(last));
	return segs;
}

export type TocItem = { anchor: string; text: string; level: 1 | 2 };

/** 表示用のブロック。連続するリスト項目は1つにまとめる。 */
export type ViewBlock =
	| { kind: 'h1' | 'h2' | 'h3'; segs: Seg[]; anchor: string }
	| { kind: 'p'; segs: Seg[]; align: Align }
	| { kind: 'quote'; segs: Seg[]; cite: string }
	| { kind: 'ul' | 'ol'; items: Seg[][] }
	| { kind: 'code'; text: string; lang: string }
	| { kind: 'img'; url: string | null; caption: string }
	| { kind: 'embed'; href: string | null; host: string }
	| { kind: 'file'; href: string | null; name: string; ext: string; host: string }
	| { kind: 'toc'; items: TocItem[] }
	| { kind: 'hr' };

export const plainOf = (t: string) =>
	t.replace(/[*_~`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

export function hostOf(u: string) {
	const m = String(u || '').match(/^https?:\/\/([^/?#]+)/i);
	return m ? m[1].replace(/^www\./, '') : '';
}
export function extOf(u: string) {
	const m = String(u || '').match(/\.([a-z0-9]{1,5})(?:[?#].*)?$/i);
	return m ? m[1].toUpperCase() : 'FILE';
}

/** 見出しから目次を作る。h1・h2 が第1階層、h3 が第2階層。 */
export function tocOf(
	blocks: Block[],
	prefix = 'sec-'
): { toc: TocItem[]; anchorOf: Map<number, string> } {
	const anchorOf = new Map<number, string>();
	const toc: TocItem[] = [];
	for (const b of blocks) {
		if (!/^h[123]$/.test(b.type) || !b.text.trim()) continue;
		const anchor = `${prefix}${toc.length + 1}`;
		anchorOf.set(b.id, anchor);
		toc.push({ anchor, text: plainOf(b.text), level: b.type === 'h3' ? 2 : 1 });
	}
	// h3 しかなければ、それを第1階層として扱う。
	if (!toc.some((x) => x.level === 1)) for (const x of toc) x.level = 1;
	return { toc, anchorOf };
}

/**
 * 表示用に組み立てる。`prefix` は見出しの id の頭。
 * エディタのプレビューと記事ページで id が重ならないよう、呼ぶ側で変える。
 */
export function toView(blocks: Block[], prefix = 'sec-'): { view: ViewBlock[]; toc: TocItem[] } {
	const { toc, anchorOf } = tocOf(blocks, prefix);
	const view: ViewBlock[] = [];
	for (const b of blocks) {
		const t = b.text || '';
		const last = view[view.length - 1];
		const url = isHttp(b.url || '') ? b.url : null;
		const media = isMediaUrl(b.url || '') ? b.url : null;
		switch (b.type) {
			case 'ul':
			case 'ol':
				if (!t.trim()) break;
				if (last && last.kind === b.type) last.items.push(inline(t));
				else view.push({ kind: b.type, items: [inline(t)] });
				break;
			case 'h1':
			case 'h2':
			case 'h3':
				view.push({ kind: b.type, segs: inline(t), anchor: anchorOf.get(b.id) ?? '' });
				break;
			case 'p':
				if (t.trim()) view.push({ kind: 'p', segs: inline(t), align: b.align || '' });
				break;
			case 'quote':
				view.push({ kind: 'quote', segs: inline(t), cite: b.cite || '' });
				break;
			case 'code':
				view.push({ kind: 'code', text: t, lang: b.lang || '' });
				break;
			case 'img':
				view.push({ kind: 'img', url: media, caption: t });
				break;
			case 'embed':
				view.push({
					kind: 'embed',
					href: url && /^\S+$/.test(url) ? url : null,
					host: hostOf(b.url)
				});
				break;
			case 'file':
				view.push({
					kind: 'file',
					href: media,
					name: t || 'ファイル',
					ext: extOf(b.url),
					host: hostOf(b.url)
				});
				break;
			case 'toc':
				view.push({ kind: 'toc', items: toc });
				break;
			case 'hr':
				view.push({ kind: 'hr' });
				break;
		}
	}
	return { view, toc };
}

/** 文字数（記法を除いたおおよその値）と読了目安（分）。 */
export function statsOf(md: string) {
	const chars = md
		.replace(/```[^\n]*/g, '')
		.replace(/<\/?p[^>]*>/g, '')
		.replace(/\[toc\]/gi, '')
		.replace(/[#>*`~\-[\]()!_]/g, '')
		.replace(/\s/g, '').length;
	return { chars, minutes: Math.max(1, Math.ceil(chars / 500)) };
}
