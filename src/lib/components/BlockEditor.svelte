<script lang="ts">
	import { tick } from 'svelte';
	import {
		blk,
		extOf,
		hostOf,
		tocOf,
		type Align,
		type Block,
		type BlockType
	} from '#lib/markdown.ts';

	/**
	 * Notion 風のブロックエディタ。1ブロック = 1つの入力欄。
	 * 「/」でブロックを挿入、「# 」「- 」「> 」などの Markdown 記法を打つとその場で変換する。
	 */
	let { blocks, onchange }: { blocks: Block[]; onchange: (next: Block[]) => void } = $props();

	type Slash = { id: number; q: string; idx: number; up: boolean; max: number };
	type Menu = { id: number; up: boolean; max: number };

	let slash = $state<Slash | null>(null);
	let menu = $state<Menu | null>(null);
	let drag = $state<number | null>(null);
	let drop = $state<{ i: number; after: boolean } | null>(null);

	const els = new Map<number, HTMLTextAreaElement | HTMLInputElement>();

	// [種類, 名前, アイコン, 説明, 検索語]
	const DEFS: [BlockType, string, string, string, string][] = [
		['p', 'テキスト', 'Aa', 'ふつうの文章', 'p text tekisuto honbun'],
		['h2', '大見出し', 'H2', '「## 」でも変換', 'h2 h1 heading oomidashi midashi'],
		['h3', '小見出し', 'H3', '「### 」でも変換', 'h3 heading komidashi midashi'],
		['ul', '箇条書きリスト', '•', '「- 」でも変換', 'ul list bullet risuto kajougaki'],
		['ol', '番号付きリスト', '1.', '「1. 」でも変換', 'ol list number risuto bangou'],
		['quote', '引用', '“', '「> 」でも変換 · 出典つき', 'quote inyou'],
		['code', 'コード', '</>', '「```」でも変換', 'code kodo'],
		['img', '画像', 'IMG', 'URLから画像を表示', 'img image gazou picture'],
		['embed', '埋め込み', 'URL', 'リンクをカードで表示', 'embed link url umekomi card'],
		['file', 'ファイル', 'PDF', 'PDFなどのファイルを添付', 'file pdf fairu'],
		['toc', '目次', 'TOC', '見出しから目次を作る', 'toc mokuji contents'],
		['hr', '区切り線', '—', '「---」でも変換', 'hr divider line kugiri']
	];
	const TYPE_LABEL: Record<BlockType, string> = {
		h1: '見出し1',
		h2: '見出し2',
		h3: '見出し3',
		p: '段落',
		ul: '箇条書き',
		ol: '番号リスト',
		quote: '引用',
		code: 'コード',
		img: '画像',
		embed: '埋め込み',
		file: 'ファイル',
		toc: '目次',
		hr: '区切り線'
	};
	const GT: Record<BlockType, string> = {
		p: '3px',
		ul: '3px',
		ol: '3px',
		quote: '3px',
		h1: '9px',
		h2: '7px',
		h3: '5px',
		code: '8px',
		img: '8px',
		hr: '10px',
		embed: '10px',
		file: '10px',
		toc: '12px'
	};
	const PH: Partial<Record<BlockType, string>> = {
		p: '「/」でコマンドを入力',
		h1: '見出し',
		h2: '大見出し',
		h3: '小見出し',
		ul: 'リスト',
		ol: 'リスト',
		quote: '引用'
	};

	const isTextType = (t: BlockType) => ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'quote'].includes(t);
	const isHttp = (u: string) => /^https?:\/\//i.test(u);
	/** 入力欄が1つ（URL など）で、Enter で次の段落へ進むブロック。 */
	const isCardType = (t: BlockType) => t === 'img' || t === 'embed' || t === 'file';

	/** 目次ブロックに出す見出し。 */
	const heads = $derived(tocOf(blocks).toc);

	const ALIGNS: [Align, string, string][] = [
		['', '左寄せ', 'M4 6h16M4 10h10M4 14h16M4 18h10'],
		['center', '中央寄せ', 'M4 6h16M7 10h10M4 14h16M7 18h10'],
		['right', '右寄せ', 'M4 6h16M10 10h10M4 14h16M10 18h10']
	];

	function slashList(q: string) {
		q = q.toLowerCase();
		return DEFS.filter((t) => !q || t[1].toLowerCase().includes(q) || t[4].includes(q));
	}

	/** 番号付きリストの通し番号。 */
	const olNums = $derived.by(() => {
		let n = 0;
		return blocks.map(
			(b, i) => (n = b.type === 'ol' ? (blocks[i - 1]?.type === 'ol' ? n + 1 : 1) : 0)
		);
	});

	// ───── 要素の登録と高さ合わせ ─────

	function fit(el: HTMLElement) {
		if (el.tagName !== 'TEXTAREA') return;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}

	function reg(el: HTMLTextAreaElement | HTMLInputElement, id: number) {
		els.set(id, el);
		fit(el);
		return {
			destroy() {
				if (els.get(id) === el) els.delete(id);
			}
		};
	}

	$effect(() => {
		// 中身が変わるたびに、全ブロックの高さを合わせ直す（ドラッグ移動や貼り付けのあとも崩れないように）。
		void blocks;
		tick().then(() => els.forEach(fit));
	});

	async function focusLater(id: number, pos = -1) {
		await tick();
		const el = els.get(id);
		if (!el) return;
		el.focus();
		const p = pos < 0 ? el.value.length : Math.min(pos, el.value.length);
		try {
			el.setSelectionRange(p, p);
		} catch {
			// type=url の input は選択範囲を持てない
		}
		fit(el);
	}

	/** 画面の下に余裕がなければ、メニューを上向きに開く。 */
	function placeFor(el: Element, want: number) {
		const r = el.getBoundingClientRect();
		const box = el.closest('.scroll');
		const br = box ? box.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
		const below = br.bottom - r.bottom - 12;
		const above = r.top - br.top - 12;
		if (below < want && above > below)
			return { up: true, max: Math.round(Math.min(want, Math.max(140, above))) };
		return { up: false, max: Math.round(Math.min(want, Math.max(140, below))) };
	}

	// ───── ブロックの操作 ─────

	function set(next: Block[], focus?: [number, number]) {
		onchange(next);
		if (focus) focusLater(...focus);
	}

	function patch(i: number, p: Partial<Block>, focus?: [number, number]) {
		const next = blocks.slice();
		next[i] = { ...next[i], ...p };
		set(next, focus);
	}

	function convert(
		i: number,
		type: BlockType,
		text: string,
		caret: number,
		more: Partial<Block> = {}
	) {
		slash = null;
		menu = null;
		const b = blocks[i];
		if (type === 'hr' || type === 'toc') {
			// 区切り線・目次は入力欄を持たないので、続きを書くための段落を下に足す。
			const next = blocks.slice();
			const nb = blk('p');
			next[i] = { ...blk(type), id: b.id };
			next.splice(i + 1, 0, nb);
			set(next, [nb.id, 0]);
			return;
		}
		patch(i, { type, text, ...more }, [b.id, caret]);
	}

	function pick(i: number, type: BlockType) {
		if (!blocks[i]) return;
		if (type === 'code') convert(i, 'code', '', 0, { lang: '' });
		else if (type === 'img' || type === 'embed' || type === 'file')
			convert(i, type, '', 0, { url: '' });
		else convert(i, type, '', 0);
	}

	function onText(i: number, e: Event) {
		const el = e.currentTarget as HTMLTextAreaElement;
		const b = blocks[i];
		const v = el.value;
		const caret = el.selectionStart ?? v.length;
		fit(el);
		if (b.type !== 'code') {
			let m: RegExpMatchArray | null;
			if (b.type === 'p') {
				if ((m = v.match(/^(#{1,3}) ([\s\S]*)$/)))
					return convert(i, `h${m[1].length}` as BlockType, m[2], caret - m[1].length - 1);
				if ((m = v.match(/^[-*+] ([\s\S]*)$/))) return convert(i, 'ul', m[1], caret - 2);
				if ((m = v.match(/^1[.)] ([\s\S]*)$/))) return convert(i, 'ol', m[1], caret - 3);
				if ((m = v.match(/^> ([\s\S]*)$/))) return convert(i, 'quote', m[1], caret - 2);
				if ((m = v.match(/^```(\S*)$/))) return convert(i, 'code', '', 0, { lang: m[1] });
				if (/^---$/.test(v)) return convert(i, 'hr', '', 0);
				// 空の段落に URL だけを貼ったら、埋め込みカードにする。
				if (b.text === '' && /^https?:\/\/\S+$/.test(v))
					return convert(i, 'embed', '', -1, { url: v });
			}
			if (/^\/\S*$/.test(v)) {
				const q = v.slice(1);
				const same = slash && slash.id === b.id;
				const pl = same ? { up: slash!.up, max: slash!.max } : placeFor(el, 300);
				slash = { id: b.id, q, idx: same && slash!.q === q ? slash!.idx : 0, ...pl };
				patch(i, { text: v });
				return;
			}
			if (slash?.id === b.id) slash = null;
		}
		patch(i, { text: v });
	}

	/** 前後の、入力欄を持つブロックへ移る。 */
	function focusNear(i: number, dir: 1 | -1, pos: number) {
		for (let j = i + dir; j >= 0 && j < blocks.length; j += dir) {
			if (els.has(blocks[j].id)) {
				focusLater(blocks[j].id, pos);
				return true;
			}
		}
		return false;
	}

	function onKey(i: number, e: KeyboardEvent) {
		const b = blocks[i];
		const el = e.currentTarget as HTMLTextAreaElement | HTMLInputElement;
		if (e.isComposing || e.keyCode === 229) return;

		const sl = slash && slash.id === b.id ? slash : null;
		if (sl) {
			const items = slashList(sl.q);
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				if (!items.length) return;
				const d = e.key === 'ArrowDown' ? 1 : -1;
				slash = { ...sl, idx: (sl.idx + d + items.length) % items.length };
				return;
			}
			if (e.key === 'Enter') {
				e.preventDefault();
				if (items.length) pick(i, items[Math.min(sl.idx, items.length - 1)][0]);
				else slash = null;
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				slash = null;
				return;
			}
		}
		if (e.key === 'Escape') {
			menu = null;
			return;
		}

		const a = el.selectionStart ?? 0;
		const z = el.selectionEnd ?? 0;

		// ⌘/Ctrl + B・I・K、⌘/Ctrl + Shift + X で選んだ文字を囲む。
		if ((e.metaKey || e.ctrlKey) && isTextType(b.type)) {
			const k = e.key.toLowerCase();
			const w: [string, string, string] | null =
				k === 'b'
					? ['**', '**', '太字']
					: k === 'i'
						? ['*', '*', '斜体']
						: k === 'k'
							? ['[', '](https://)', 'リンク']
							: k === 'x' && e.shiftKey
								? ['~~', '~~', '取り消し線']
								: null;
			if (w) {
				e.preventDefault();
				const picked = b.text.slice(a, z) || w[2];
				const p0 = a + w[0].length;
				patch(i, { text: b.text.slice(0, a) + w[0] + picked + w[1] + b.text.slice(z) });
				tick().then(() => {
					const e2 = els.get(b.id);
					e2?.focus();
					e2?.setSelectionRange(p0, p0 + picked.length);
				});
				return;
			}
		}

		if (b.type === 'code') {
			if (e.key === 'Tab') {
				e.preventDefault();
				patch(i, { text: b.text.slice(0, a) + '  ' + b.text.slice(z) }, [b.id, a + 2]);
			} else if (e.key === 'Backspace' && a === 0 && z === 0 && b.text === '') {
				e.preventDefault();
				convert(i, 'p', '', 0, { lang: '' });
			}
			return;
		}

		if (isCardType(b.type)) {
			if (e.key === 'Enter') {
				e.preventDefault();
				const next = blocks.slice();
				const nb = blk('p');
				next.splice(i + 1, 0, nb);
				set(next, [nb.id, 0]);
			} else if (e.key === 'Backspace' && el.value === '' && !b.url && !b.text) {
				e.preventDefault();
				const next = blocks.slice();
				next.splice(i, 1);
				const prev = i > 0 ? next[i - 1] : null;
				set(next.length ? next : [blk('p')], prev ? [prev.id, -1] : undefined);
			}
			return;
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const txt = b.text || '';
			// 空のリスト項目で Enter を押したらリストを抜ける。
			if ((b.type === 'ul' || b.type === 'ol' || b.type === 'quote') && txt === '') {
				convert(i, 'p', '', 0);
				return;
			}
			const next = blocks.slice();
			next[i] = { ...b, text: txt.slice(0, a) };
			const nb = blk(b.type === 'ul' || b.type === 'ol' ? b.type : 'p', txt.slice(z));
			next.splice(i + 1, 0, nb);
			slash = null;
			set(next, [nb.id, 0]);
			return;
		}

		if (e.key === 'Backspace' && a === 0 && z === 0) {
			if (b.type !== 'p') {
				e.preventDefault();
				convert(i, 'p', b.text, 0);
				return;
			}
			if (i > 0) {
				e.preventDefault();
				const prev = blocks[i - 1];
				const next = blocks.slice();
				if (prev.type === 'hr' || prev.type === 'toc' || (isCardType(prev.type) && !prev.url)) {
					next.splice(i - 1, 1);
					set(next, [b.id, 0]);
				} else if (isTextType(prev.type)) {
					// 前のブロックにつなげる。
					const pos = (prev.text || '').length;
					next[i - 1] = { ...prev, text: (prev.text || '') + (b.text || '') };
					next.splice(i, 1);
					set(next, [prev.id, pos]);
				} else if (b.text === '') {
					next.splice(i, 1);
					set(next, [prev.id, -1]);
				} else {
					focusNear(i, -1, -1);
				}
				return;
			}
		}

		if (e.key === 'ArrowUp' && a === z && b.text.lastIndexOf('\n', a - 1) < 0) {
			if (focusNear(i, -1, -1)) e.preventDefault();
			return;
		}
		if (e.key === 'ArrowDown' && a === z && b.text.indexOf('\n', a) < 0) {
			if (focusNear(i, 1, 0)) e.preventDefault();
		}
	}

	function onFocus(id: number) {
		if (slash && slash.id !== id) slash = null;
		if (menu && menu.id !== id) menu = null;
	}

	function move(from: number, to: number) {
		if (to < 0 || to >= blocks.length) return;
		const next = blocks.slice();
		const [x] = next.splice(from, 1);
		next.splice(to, 0, x);
		menu = null;
		drag = null;
		drop = null;
		set(next);
	}

	function plus(i: number, e: MouseEvent) {
		const next = blocks.slice();
		const nb = blk('p', '/');
		next.splice(i + 1, 0, nb);
		const pl = placeFor(e.currentTarget as Element, 300);
		slash = { id: nb.id, q: '', idx: 0, ...pl };
		menu = null;
		set(next, [nb.id, 1]);
	}

	function toggleMenu(id: number, e: MouseEvent) {
		const pl = placeFor(e.currentTarget as Element, 340);
		menu = menu?.id === id ? null : { id, ...pl };
		slash = null;
	}

	function dup(i: number) {
		const next = blocks.slice();
		next.splice(i + 1, 0, { ...blocks[i], id: blk('p').id });
		menu = null;
		set(next);
	}

	function del(i: number) {
		const next = blocks.slice();
		next.splice(i, 1);
		menu = null;
		set(next.length ? next : [blk('p')]);
	}

	function convertTo(i: number, type: BlockType) {
		const b = blocks[i];
		const keep =
			isTextType(type) && isTextType(b.type)
				? b.text
				: type === 'img' || type === 'embed' || type === 'hr' || type === 'toc'
					? ''
					: b.text;
		convert(
			i,
			type,
			keep,
			-1,
			type === 'code' ? { lang: b.lang || '' } : isCardType(type) ? { url: b.url || '' } : {}
		);
	}

	function onDragOver(i: number, e: DragEvent) {
		if (drag == null) return;
		e.preventDefault();
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const after = e.clientY > r.top + r.height / 2;
		if (!drop || drop.i !== i || drop.after !== after) drop = { i, after };
	}

	function onDrop(i: number, e: DragEvent) {
		if (drag == null) return;
		e.preventDefault();
		const from = blocks.findIndex((x) => x.id === drag);
		if (from < 0) {
			drag = drop = null;
			return;
		}
		let to = drop?.after ? i + 1 : i;
		if (from < to) to--;
		if (to === from) {
			drag = drop = null;
			return;
		}
		move(from, to);
	}

	function addEnd() {
		const last = blocks[blocks.length - 1];
		if (last && last.type === 'p' && !last.text) {
			focusLater(last.id, 0);
			return;
		}
		const nb = blk('p');
		set([...blocks, nb], [nb.id, 0]);
	}
</script>

<div class="nd scroll">
	<div class="nd-in">
		{#each blocks as b, i (b.id)}
			{@const sl = slash && slash.id === b.id ? slash : null}
			{@const items = sl ? slashList(sl.q) : []}
			{@const head = b.type === 'h1' || b.type === 'h2' || b.type === 'h3'}
			{@const okImg = b.type === 'img' && isHttp(b.url || '')}
			<div
				class="nb nb-t-{b.type}"
				class:nb-first={i === 0}
				class:nb-dt={drop?.i === i && !drop.after}
				class:nb-db={drop?.i === i && drop.after}
				class:nb-dragging={drag === b.id}
				class:nb-active={menu?.id === b.id || !!sl}
				style="--gt: {GT[b.type]}"
				role="group"
				ondragover={(e) => onDragOver(i, e)}
				ondrop={(e) => onDrop(i, e)}
			>
				<div class="nb-gut">
					<button class="nb-g" aria-label="下にブロックを追加" onclick={(e) => plus(i, e)}>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg
						>
					</button>
					<button
						class="nb-g nb-drag"
						aria-label="ブロックメニュー（ドラッグで移動）"
						aria-haspopup="menu"
						aria-expanded={menu?.id === b.id}
						draggable="true"
						ondragstart={(e) => {
							try {
								e.dataTransfer!.effectAllowed = 'move';
								e.dataTransfer!.setData('text/plain', '');
							} catch {
								// 古いブラウザ
							}
							drag = b.id;
							drop = null;
							menu = null;
							slash = null;
						}}
						ondragend={() => ((drag = null), (drop = null))}
						onclick={(e) => toggleMenu(b.id, e)}
					>
						<svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor" aria-hidden="true"
							><circle cx="4" cy="4" r="1.5"></circle><circle cx="10" cy="4" r="1.5"
							></circle><circle cx="4" cy="9" r="1.5"></circle><circle cx="10" cy="9" r="1.5"
							></circle><circle cx="4" cy="14" r="1.5"></circle><circle cx="10" cy="14" r="1.5"
							></circle></svg
						>
					</button>
				</div>

				<div class="nb-body">
					{#if isTextType(b.type)}
						<div class="nb-line" class:nb-q={b.type === 'quote'}>
							{#if b.type === 'ul' || b.type === 'ol'}<span class="nb-mk" aria-hidden="true"
									>{b.type === 'ul' ? '•' : `${olNums[i]}.`}</span
								>{/if}
							<textarea
								class="nb-in {head ? `nb-${b.type}` : 'nb-p'}"
								class:nb-al-center={b.type === 'p' && b.align === 'center'}
								class:nb-al-right={b.type === 'p' && b.align === 'right'}
								rows="1"
								aria-label={TYPE_LABEL[b.type]}
								placeholder={PH[b.type] ?? ''}
								value={b.text}
								oninput={(e) => onText(i, e)}
								onkeydown={(e) => onKey(i, e)}
								onfocus={() => onFocus(b.id)}
								use:reg={b.id}></textarea>
							{#if b.type === 'quote'}
								<input
									class="nb-cite"
									type="text"
									aria-label="出典"
									placeholder="出典（任意）"
									value={b.cite}
									oninput={(e) => patch(i, { cite: e.currentTarget.value })}
								/>
							{/if}
						</div>
					{:else if b.type === 'code'}
						<div class="nb-code">
							<input
								class="nb-lang"
								type="text"
								aria-label="言語"
								placeholder="言語を入力"
								value={b.lang}
								oninput={(e) => patch(i, { lang: e.currentTarget.value.replace(/\s/g, '') })}
							/>
							<textarea
								class="nb-in nb-ct"
								rows="1"
								aria-label="コード"
								placeholder="コードを入力"
								spellcheck="false"
								value={b.text}
								oninput={(e) => onText(i, e)}
								onkeydown={(e) => onKey(i, e)}
								onfocus={() => onFocus(b.id)}
								use:reg={b.id}></textarea>
						</div>
					{:else if b.type === 'img'}
						<figure class="nb-img">
							{#if okImg}
								<img src={b.url} alt={b.text} />
								<input
									class="nb-cap"
									type="text"
									aria-label="キャプション"
									placeholder="キャプションを追加"
									value={b.text}
									oninput={(e) => patch(i, { text: e.currentTarget.value })}
									onkeydown={(e) => onKey(i, e)}
									onfocus={() => onFocus(b.id)}
									use:reg={b.id}
								/>
								<input
									class="nb-url nb-url2"
									type="url"
									aria-label="画像URL"
									value={b.url}
									onchange={(e) => patch(i, { url: e.currentTarget.value.trim() })}
								/>
							{:else}
								<div class="nb-imgph">
									<svg
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.8"
										aria-hidden="true"
										><rect x="3" y="4.5" width="18" height="15" rx="2"></rect><circle
											cx="8.5"
											cy="9.5"
											r="1.6"
										></circle><path d="M21 16l-5-5-9 8.5"></path></svg
									>
									<input
										class="nb-url"
										type="url"
										aria-label="画像URL"
										placeholder="画像URLを貼り付け（https://…）"
										value={b.url}
										onchange={(e) => patch(i, { url: e.currentTarget.value.trim() })}
										onkeydown={(e) => onKey(i, e)}
										onfocus={() => onFocus(b.id)}
										use:reg={b.id}
									/>
								</div>
							{/if}
						</figure>
					{:else if b.type === 'embed'}
						<div class="nb-card">
							<span class="nb-card-ic" aria-hidden="true"
								><svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									><circle cx="12" cy="12" r="9"></circle><path
										d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"
									></path></svg
								></span
							>
							<span class="nb-card-b">
								<input
									class="nb-url"
									type="url"
									aria-label="埋め込むURL"
									placeholder="URLを貼り付けるとカードで表示（https://…）"
									value={b.url}
									onchange={(e) => patch(i, { url: e.currentTarget.value.trim() })}
									onkeydown={(e) => onKey(i, e)}
									onfocus={() => onFocus(b.id)}
									use:reg={b.id}
								/>
								{#if /^https?:\/\/\S+$/.test(b.url)}<span class="nb-card-h">{hostOf(b.url)}</span
									>{/if}
							</span>
						</div>
					{:else if b.type === 'file'}
						<div class="nb-card">
							<span class="nb-card-ext" aria-hidden="true">{extOf(b.url)}</span>
							<span class="nb-card-b">
								<input
									class="nb-url nb-fname"
									type="text"
									aria-label="ファイル名"
									placeholder="ファイル名（例：資料.pdf）"
									value={b.text}
									oninput={(e) => patch(i, { text: e.currentTarget.value })}
									onkeydown={(e) => onKey(i, e)}
									onfocus={() => onFocus(b.id)}
									use:reg={b.id}
								/>
								<input
									class="nb-url nb-furl"
									type="url"
									aria-label="ファイルのURL"
									placeholder="ファイルのURL（https://…/資料.pdf）"
									value={b.url}
									onchange={(e) => patch(i, { url: e.currentTarget.value.trim() })}
									onkeydown={(e) => onKey(i, e)}
								/>
							</span>
						</div>
					{:else if b.type === 'toc'}
						<div class="nb-toc">
							<span class="nb-toc-t">目次</span>
							{#if !heads.length}<span class="nb-toc-e"
									>見出しを追加すると、ここに目次が表示されます</span
								>{/if}
							<ol>
								{#each heads as t (t.anchor)}<li class:toc-2={t.level === 2}>{t.text}</li>{/each}
							</ol>
						</div>
					{:else if b.type === 'hr'}
						<div class="nb-hr" aria-hidden="true"><span></span></div>
					{/if}

					{#if sl}
						<div
							class="nmenu"
							class:nmenu-up={sl.up}
							role="listbox"
							aria-label="ブロックを挿入"
							style="--mh: {sl.max}px"
						>
							<div class="nm-h">ブロック</div>
							{#each items as it, k (it[0])}
								{@const on = k === Math.min(sl.idx, items.length - 1)}
								<button
									class="nm-i"
									class:nm-on={on}
									role="option"
									aria-selected={on}
									tabindex="-1"
									onmousedown={(e) => {
										e.preventDefault();
										pick(i, it[0]);
									}}
									><span class="nm-ic" aria-hidden="true">{it[2]}</span><span class="nm-t"
										><span class="nm-l">{it[1]}</span><span class="nm-d">{it[3]}</span></span
									></button
								>
							{/each}
							{#if !items.length}<div class="nm-none">該当するブロックがありません</div>{/if}
						</div>
					{/if}

					{#if menu?.id === b.id}
						<button class="nback" aria-label="メニューを閉じる" onclick={() => (menu = null)}
						></button>
						<div
							class="nmenu nmenu-act"
							class:nmenu-up={menu.up}
							role="menu"
							aria-label="ブロックの操作"
							style="--mh: {menu.max}px"
						>
							<button
								class="nm-a"
								role="menuitem"
								disabled={i === 0}
								onclick={() => move(i, i - 1)}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"></path></svg
								>上へ移動
							</button>
							<button
								class="nm-a"
								role="menuitem"
								disabled={i === blocks.length - 1}
								onclick={() => move(i, i + 1)}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"></path></svg
								>下へ移動
							</button>
							<button class="nm-a" role="menuitem" onclick={() => dup(i)}>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									aria-hidden="true"
									><rect x="8" y="8" width="12" height="12" rx="2"></rect><path
										d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"
									></path></svg
								>複製
							</button>
							<button class="nm-a nm-del" role="menuitem" onclick={() => del(i)}>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									aria-hidden="true"><path d="M4 7h16M10 7V4.5h4V7M6.5 7l1 13h9l1-13"></path></svg
								>削除
							</button>
							<div class="nm-sep" aria-hidden="true"></div>
							{#if b.type === 'p'}
								<div class="nm-h">配置</div>
								<div class="nm-al">
									{#each ALIGNS as [al, label, d] (label)}
										{@const on = (b.align || '') === al}
										<button
											class="nm-alb"
											class:nm-alb-on={on}
											role="menuitemradio"
											aria-checked={on}
											aria-label={label}
											onclick={() => {
												menu = null;
												patch(i, { align: al });
											}}
											><svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												aria-hidden="true"><path {d}></path></svg
											></button
										>
									{/each}
								</div>
								<div class="nm-sep" aria-hidden="true"></div>
							{/if}
							<div class="nm-h">ブロックの種類を変更</div>
							<div class="nm-conv">
								{#each DEFS as t (t[0])}
									<button class="nm-a" role="menuitem" onclick={() => convertTo(i, t[0])}
										><span class="nm-ic nm-ic-s" aria-hidden="true">{t[2]}</span>{t[1]}</button
									>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/each}
		<button class="nd-add" onclick={addEnd}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg
			>クリックしてブロックを追加
		</button>
	</div>
</div>

<style>
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	@media (max-width: 900px) {
		.scroll {
			overflow: visible;
		}
	}
	.nd {
		padding: 32px 28px 48px 4px;
	}
	.nd-in {
		max-width: 720px;
		margin: 0 auto;
	}
	.nb {
		position: relative;
		display: flex;
		align-items: flex-start;
		margin: 2px 0;
		border-radius: 4px;
	}
	.nb-first {
		margin-top: 0;
	}
	.nb-t-h1 {
		margin-top: 26px;
	}
	.nb-t-h2 {
		margin-top: 20px;
	}
	.nb-t-h3 {
		margin-top: 14px;
	}
	.nb-t-code,
	.nb-t-img,
	.nb-t-quote {
		margin-top: 8px;
		margin-bottom: 8px;
	}
	.nb-gut {
		flex: none;
		width: 54px;
		display: flex;
		justify-content: flex-end;
		padding: var(--gt, 3px) 4px 0 0;
		opacity: 0;
		transition: opacity 0.12s;
	}
	.nb:hover .nb-gut,
	.nb-active .nb-gut,
	.nb-gut:focus-within {
		opacity: 1;
	}
	@media (hover: none) {
		.nb-gut {
			opacity: 1;
		}
	}
	.nb-g {
		width: 24px;
		height: 28px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: #9b9384;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}
	.nb-g:hover {
		background: #efebe4;
		color: #3d372e;
	}
	.nb-drag {
		cursor: grab;
	}
	.nb-drag:active {
		cursor: grabbing;
	}
	.nb-body {
		flex: 1;
		min-width: 0;
		position: relative;
	}
	.nb-line {
		display: flex;
		align-items: flex-start;
		gap: 2px;
	}
	.nb-q {
		border-left: 3px solid #1e1b17;
		padding-left: 14px;
	}
	.nb-mk {
		flex: none;
		min-width: 24px;
		text-align: center;
		font-size: 16px;
		line-height: 1.7;
		padding: 3px 0;
		color: #1e1b17;
	}
	.nb-in {
		display: block;
		width: 100%;
		font: inherit;
		color: #1e1b17;
		background: transparent;
		border: 0;
		outline: none;
		resize: none;
		overflow: hidden;
		padding: 3px 2px;
		margin: 0;
		min-height: 0;
	}
	.nb-in::placeholder {
		color: #a39a8b;
	}
	.nb-in:not(:focus)::placeholder {
		color: transparent;
	}
	.nb-p {
		font-size: 16px;
		line-height: 1.7;
	}
	.nb-h1 {
		font-size: 30px;
		font-weight: 900;
		line-height: 1.3;
		color: var(--color-pine);
	}
	.nb-h2 {
		font-size: 23px;
		font-weight: 900;
		line-height: 1.35;
		color: var(--color-pine);
	}
	.nb-h3 {
		font-size: 19px;
		font-weight: 700;
		line-height: 1.4;
		color: var(--color-pine);
	}
	.nb-code {
		position: relative;
		background: #f4f1eb;
		border-radius: 6px;
		padding: 30px 16px 14px;
	}
	.nb-lang {
		position: absolute;
		top: 6px;
		left: 10px;
		width: 140px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		color: #6b6458;
		background: transparent;
		border: 0;
		border-radius: 4px;
		padding: 3px 6px;
		outline: none;
	}
	.nb-lang:hover,
	.nb-lang:focus {
		background: #eae4da;
	}
	.nb-ct {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 14px;
		line-height: 1.7;
		white-space: pre;
		overflow-x: auto;
		tab-size: 2;
	}
	.nb-img {
		margin: 0;
	}
	.nb-img img {
		display: block;
		max-width: 100%;
		border-radius: 4px;
	}
	.nb-imgph {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		border-radius: 6px;
		background: #f4f1eb;
		color: #6b6458;
	}
	.nb-url {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-size: 14px;
		color: #1e1b17;
		background: transparent;
		border: 0;
		outline: none;
		min-height: 28px;
	}
	.nb-url::placeholder {
		color: #8a8274;
	}
	.nb-url2 {
		display: block;
		width: 100%;
		margin-top: 4px;
		font-size: 12px;
		color: #6b6458;
		opacity: 0;
		transition: opacity 0.12s;
	}
	.nb-img:hover .nb-url2,
	.nb-url2:focus {
		opacity: 1;
	}
	.nb-cap {
		display: block;
		width: 100%;
		margin-top: 6px;
		font: inherit;
		font-size: 13px;
		color: #6b6458;
		background: transparent;
		border: 0;
		outline: none;
		text-align: center;
		padding: 2px;
	}
	.nb-cap::placeholder {
		color: #b5ad9f;
	}
	.nb-al-center {
		text-align: center;
	}
	.nb-al-right {
		text-align: right;
	}
	.nb-q {
		flex-direction: column;
		align-items: stretch;
		gap: 0;
	}
	.nb-cite {
		display: block;
		width: 100%;
		font: inherit;
		font-size: 13px;
		color: #6b6458;
		background: transparent;
		border: 0;
		outline: none;
		padding: 2px 2px 4px;
	}
	.nb-cite::placeholder {
		color: #b5ad9f;
	}
	/* 出典が空のときは、そのブロックを編集している間だけ欄を見せる */
	.nb-cite:placeholder-shown {
		opacity: 0;
		height: 0;
		padding: 0;
		transition: opacity 0.15s;
	}
	.nb:focus-within .nb-cite:placeholder-shown {
		opacity: 1;
		height: auto;
		padding: 2px 2px 4px;
	}
	.nb-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 8px;
		background: #fff;
		box-shadow: inset 0 0 0 1px #e2dbcf;
	}
	.nb-card:focus-within {
		box-shadow: inset 0 0 0 1.5px var(--color-pine);
	}
	.nb-card-ic,
	.nb-card-ext {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.nb-card-ic {
		background: var(--color-cream);
		color: var(--color-pine);
	}
	.nb-card-ext {
		background: var(--color-pine);
		color: var(--color-cream);
		font-family: var(--font-display);
		font-size: 10.5px;
		font-weight: 700;
	}
	.nb-card-b {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nb-card-h {
		font-size: 12px;
		color: #6b6458;
	}
	.nb-fname {
		font-weight: 700;
	}
	.nb-furl {
		font-size: 12px;
		color: #6b6458;
	}
	.nb-toc {
		padding: 14px 18px;
		border-radius: 8px;
		background: #f7f3ec;
		font-size: 14px;
	}
	.nb-toc-t {
		display: block;
		font-weight: 900;
		color: var(--color-pine);
		margin-bottom: 4px;
	}
	.nb-toc-e {
		font-size: 13px;
		color: #8a8274;
	}
	.nb-toc ol {
		list-style: none;
		margin: 0;
		padding: 0;
		color: #3d372e;
	}
	.nb-toc li {
		line-height: 1.7;
	}
	.nb-toc .toc-2 {
		padding-left: 1.2em;
		font-size: 13px;
	}
	.nm-al {
		display: flex;
		gap: 4px;
		padding: 2px 6px 4px;
	}
	.nm-alb {
		width: 36px;
		height: 30px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: #3d372e;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.nm-alb:hover {
		background: #f1ede6;
	}
	.nm-alb-on,
	.nm-alb-on:hover {
		background: var(--color-pine);
		color: var(--color-cream);
	}
	.nb-hr {
		padding: 12px 2px;
	}
	.nb-hr span {
		display: block;
		height: 1px;
		background: var(--color-line);
	}
	.nb-dt::before,
	.nb-db::after {
		content: '';
		position: absolute;
		left: 54px;
		right: 0;
		height: 3px;
		border-radius: 2px;
		background: #7fa7e0;
	}
	.nb-dt::before {
		top: -3px;
	}
	.nb-db::after {
		bottom: -3px;
	}
	.nb-dragging {
		opacity: 0.4;
	}
	.nmenu {
		position: absolute;
		left: 0;
		top: 100%;
		margin-top: 4px;
		z-index: 30;
		width: 260px;
		max-height: min(300px, var(--mh, 300px));
		overflow-y: auto;
		overscroll-behavior: contain;
		background: #fff;
		border-radius: 8px;
		box-shadow:
			0 0 0 1px rgb(15 15 15 / 0.07),
			0 10px 28px -8px rgb(15 15 15 / 0.28);
		padding: 4px;
	}
	.nmenu-up {
		top: auto;
		bottom: 100%;
		margin-top: 0;
		margin-bottom: 4px;
	}
	.nmenu-act {
		top: 30px;
		left: -6px;
		width: 224px;
		max-height: min(340px, var(--mh, 340px));
	}
	.nmenu-act.nmenu-up {
		top: auto;
		bottom: calc(100% - 2px);
	}
	.nm-h {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #6b6458;
		padding: 6px 8px 3px;
	}
	.nm-i {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border: 0;
		background: transparent;
		border-radius: 6px;
		padding: 3px 6px;
		min-height: 36px;
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: var(--color-ink);
	}
	.nm-i:hover,
	.nm-on {
		background: #f1ede6;
	}
	.nm-ic {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 5px;
		background: #fff;
		box-shadow: inset 0 0 0 1px #e2dbcf;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: 11.5px;
		font-weight: 700;
		color: #3d372e;
	}
	.nm-ic-s {
		width: 20px;
		height: 20px;
		font-size: 9.5px;
		border-radius: 4px;
	}
	.nm-t {
		display: flex;
		flex-direction: column;
		line-height: 1.35;
	}
	.nm-l {
		font-size: 13px;
		font-weight: 500;
	}
	.nm-d {
		font-size: 11px;
		color: #6b6458;
	}
	.nm-none {
		padding: 10px 8px;
		font-size: 13px;
		color: #6b6458;
	}
	.nm-a {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border: 0;
		background: transparent;
		border-radius: 6px;
		padding: 0 8px;
		min-height: 32px;
		text-align: left;
		cursor: pointer;
		font: inherit;
		font-size: 13px;
		color: var(--color-ink);
	}
	.nm-a svg {
		width: 14px;
		height: 14px;
		flex: none;
	}
	.nm-conv {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 2px;
	}
	.nm-conv .nm-a {
		font-size: 12px;
		padding: 0 6px;
		gap: 6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.nm-a:hover {
		background: #f1ede6;
	}
	.nm-a:disabled {
		opacity: 0.35;
		cursor: default;
		background: transparent;
	}
	.nm-del {
		color: var(--color-warn);
	}
	.nm-sep {
		height: 1px;
		background: #eee9e1;
		margin: 4px;
	}
	.nback {
		position: fixed;
		inset: 0;
		z-index: 25;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: default;
	}
	.nd-add {
		display: flex;
		align-items: center;
		gap: 8px;
		width: calc(100% - 54px);
		margin: 10px 0 0 54px;
		min-height: 44px;
		padding: 0 4px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: #a39a8b;
		font: inherit;
		font-size: 14px;
		cursor: text;
		text-align: left;
	}
	.nd-add:hover {
		color: var(--color-muted);
		background: #faf8f4;
	}
</style>
