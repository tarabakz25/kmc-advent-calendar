import { expect, test } from 'bun:test';
import { inline, parse, serialize, toView } from '../src/lib/markdown.ts';
import { mimeOf, safeName } from '../src/lib/upload.ts';

const strip = (md: string) => parse(md).map(({ id: _id, ...b }) => b);

test('parse → serialize で同じ Markdown に戻る', () => {
	const md = [
		'# 大見出し',
		'',
		'## はじめに',
		'',
		'ふつうの文章。\n2行目。',
		'',
		'- いち\n- に',
		'',
		'1. a\n2. b',
		'',
		'> 引用\n> 2行目',
		'',
		'```js\nconst a = 1;\n\nconsole.log(a);\n```',
		'',
		'![キャプション](https://example.com/a.png)',
		'',
		'---',
		'',
		'### 小見出し'
	].join('\n');
	expect(serialize(parse(md))).toBe(md);
	expect(strip(serialize(parse(md)))).toEqual(strip(md));
});

test('行内の記法。リンクは http(s) だけ', () => {
	expect(inline('a **b** *c* `d` [e](https://x.dev) [f](javascript:void0)')).toEqual([
		{ text: 'a ', cls: '', href: null },
		{ text: 'b', cls: 'i-b', href: null },
		{ text: ' ', cls: '', href: null },
		{ text: 'c', cls: 'i-i', href: null },
		{ text: ' ', cls: '', href: null },
		{ text: 'd', cls: 'i-c', href: null },
		{ text: ' ', cls: '', href: null },
		{ text: 'e', cls: '', href: 'https://x.dev' },
		{ text: ' ', cls: '', href: null },
		{ text: '[f](javascript:void0)', cls: '', href: null }
	]);
});

test('画像は http(s) 以外の URL を表示しない', () => {
	const { view } = toView(parse('![x](javascript:void0)\n\n![y](https://e.com/y.png)'));
	expect(view).toEqual([
		{ kind: 'img', url: null, caption: 'x' },
		{ kind: 'img', url: 'https://e.com/y.png', caption: 'y' }
	]);
});

test('連続するリストはまとめ、目次を作る', () => {
	const { view, toc } = toView(parse('## A\n\n- 1\n- 2\n\n## B\n\n### C'));
	expect(view[1]).toEqual({
		kind: 'ul',
		items: [[{ text: '1', cls: '', href: null }], [{ text: '2', cls: '', href: null }]]
	});
	expect(toc).toEqual([
		{ anchor: 'sec-1', text: 'A', level: 1 },
		{ anchor: 'sec-2', text: 'B', level: 1 },
		{ anchor: 'sec-3', text: 'C', level: 2 }
	]);
});

test('増えた記法も parse → serialize で戻る', () => {
	const md = [
		'[toc]',
		'',
		'<p align="center">中央寄せの一文</p>',
		'',
		'<p align="right">右寄せ</p>',
		'',
		'> 失敗した話も大歓迎です。\n> — KMC Advent Calendar 運営',
		'',
		'https://example.com/a',
		'',
		'[資料.pdf](https://example.com/files/doc.pdf)',
		'',
		'~~取り消し~~ と __太字__'
	].join('\n');
	expect(serialize(parse(md))).toBe(md);
	expect(parse(md).map((b) => b.type)).toEqual(['toc', 'p', 'p', 'quote', 'embed', 'file', 'p']);
	const q = parse(md)[3];
	expect([q.text, q.cite]).toEqual(['失敗した話も大歓迎です。', 'KMC Advent Calendar 運営']);
});

test('閉じ忘れた <p align> は空行で終わり、後ろの本文を飲み込まない', () => {
	const blocks = parse('<p align="center">閉じ忘れ\n\n## 次の見出し\n\n本文');
	expect(blocks.map((b) => [b.type, b.text, b.align])).toEqual([
		['p', '閉じ忘れ', 'center'],
		['h2', '次の見出し', ''],
		['p', '本文', '']
	]);
});

test('単語の途中の __ は太字にしない', () => {
	expect(inline('MAX__SIZE__LIMIT').map((s) => s.cls)).toEqual(['']);
	expect(inline('これは __太字__ です').map((s) => s.cls)).toEqual(['', 'i-b', '']);
	expect(inline('~~消す~~').map((s) => s.cls)).toEqual(['i-s']);
});

test('目次は h3 を第2階層にし、埋め込み・ファイルは http(s) だけ', () => {
	const { view } = toView(
		parse('[toc]\n\n## A\n\n### B\n\njavascript:void0\n\n[x.pdf](https://e.com/x.pdf)')
	);
	expect(view[0]).toEqual({
		kind: 'toc',
		items: [
			{ anchor: 'sec-1', text: 'A', level: 1 },
			{ anchor: 'sec-2', text: 'B', level: 2 }
		]
	});
	expect(view[3].kind).toBe('p');
	expect(view[4]).toEqual({
		kind: 'file',
		href: 'https://e.com/x.pdf',
		name: 'x.pdf',
		ext: 'PDF',
		host: 'e.com'
	});
});

test('アップロードした画像・ファイルの /uploads/ パスを表示に通す', () => {
	const md =
		'![図](/uploads/abcDEF123_-x/zu.webp)\n\n[資料.pdf](/uploads/abcDEF123_-x/shiryou.pdf)';
	const blocks = parse(md);
	expect(blocks.map((b) => b.type)).toEqual(['img', 'file']);
	expect(serialize(blocks)).toBe(md);
	const { view } = toView(blocks);
	expect(view[0]).toMatchObject({ kind: 'img', url: '/uploads/abcDEF123_-x/zu.webp' });
	expect(view[1]).toMatchObject({
		kind: 'file',
		href: '/uploads/abcDEF123_-x/shiryou.pdf',
		ext: 'PDF'
	});
});

test('http(s) でも /uploads/ でもない画像 URL は表示しない', () => {
	for (const url of [
		'javascript:alert`1`',
		'/etc/passwd',
		'//evil.example/x.png',
		'/uploads/../x.png'
	])
		expect(toView(parse(`![x](${url})`)).view[0]).toMatchObject({ kind: 'img', url: null });
});

test('アップロードするファイル名を URL に入れられる形にする', () => {
	expect(safeName('スクリーンショット 2026-11-26 12.00.png', 'image/png')).toBe(
		'スクリーンショット-2026-11-26-12.00.png'
	);
	expect(safeName('../../a?b#c.svg', 'image/svg+xml')).toBe('..-..-a-b-c.svg');
	expect(safeName('noext', 'application/pdf')).toBe('noext.pdf');
	expect(mimeOf('memo.md', '')).toBe('text/markdown');
	expect(mimeOf('page.html', 'text/html')).toBe('');
});
