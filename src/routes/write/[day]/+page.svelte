<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { deserialize } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { GENRES, genreOf, TITLE_MAX } from '#lib/calendar.ts';
	import { pad, weekdayEn } from '#lib/design.ts';
	import { blk, parse, serialize, statsOf, toView, type Block } from '#lib/markdown.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import BlockEditor from '#lib/components/BlockEditor.svelte';
	import Markdown from '#lib/components/Markdown.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// このページの入力はサーバーから受け取った値を出発点にして、以降は手元で持つ。
	// svelte-ignore state_referenced_locally
	const d = data.draft;
	// svelte-ignore state_referenced_locally
	const starter = `## はじめに\n\nこの記事は **KMC Advent Calendar ${data.year}** の ${d.day} 日目の記事です。\n\n## おわりに\n\n`;

	let title = $state(d.title);
	let genre = $state(d.genre ?? '');
	// まだ何も保存していない人には、書き出しのひな形を用意しておく。
	const initialMd = d.status === 'new' && !d.body ? starter : d.body;
	let md = $state(initialMd);
	let blocks = $state<Block[]>(parse(initialMd));
	let status = $state(d.status);
	let mode = $state<'gui' | 'md'>('gui');
	let preview = $state(true);
	let busy = $state(false);
	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	let ta = $state<HTMLTextAreaElement>();
	/** Markdown モードの「挿入」メニューと、記法一覧。 */
	let insOpen = $state(false);
	let helpOpen = $state(false);
	let headerH = $state(84);

	/** 最後に保存した内容。これと違えば「未保存の変更あり」。 */
	// ひな形のままなら、離れるときに確認しない。
	let savedSnap = $state(JSON.stringify([d.title, d.genre ?? '', initialMd]));
	const dirty = $derived(JSON.stringify([title, genre, md]) !== savedSnap);

	const g = $derived(genreOf(genre));
	const stats = $derived(statsOf(md));
	// プレビューの見出しの id は、記事ページ（sec-）と重ならないように別の頭にする。
	const pv = $derived(toView(blocks, 'pv-h-'));
	const STATUS = {
		new: ['未保存', true],
		draft: ['下書き', true],
		submitted: ['投稿済み', false]
	} as const;
	const q = $derived(page.url.search);

	function setBlocks(next: Block[]) {
		blocks = next;
		md = serialize(next);
	}
	function setMd(next: string) {
		md = next;
		blocks = parse(next);
	}

	function flash(msg: string) {
		clearTimeout(toastTimer);
		toast = msg;
		toastTimer = setTimeout(() => (toast = ''), 2400);
	}

	async function send(action: 'save' | 'publish') {
		if (busy) return;
		if (action === 'publish') {
			if (!title.trim()) return flash('タイトルを入力してください');
			if (!md.trim()) return flash('本文が空です');
		}
		busy = true;
		const body = new FormData();
		body.set('title', title);
		body.set('genre', genre);
		body.set('body', md);
		const snap = JSON.stringify([title, genre, md]);
		try {
			const res = await fetch(`?/${action}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await res.text());
			if (result.type === 'success') {
				savedSnap = snap;
				status = (result.data?.status as typeof status) ?? status;
				flash(
					action === 'publish' ? `12/${d.day} の記事として投稿しました` : '下書きを保存しました'
				);
			} else if (result.type === 'failure') {
				flash(String(result.data?.message ?? '保存できませんでした'));
			} else if (result.type === 'redirect') {
				// ログインが切れていた
				await goto(result.location);
			} else {
				flash('保存できませんでした。時間をおいてもう一度お試しください');
			}
		} catch {
			flash('保存できませんでした。通信状況を確認してください');
		} finally {
			busy = false;
		}
	}

	async function copyMd() {
		try {
			await navigator.clipboard.writeText(`# ${title || 'タイトル未設定'}\n\n${md}`);
			flash('Markdown をコピーしました');
		} catch {
			flash('コピーできませんでした');
		}
	}

	// ───── Markdown モードのツールバー ─────

	async function setMdSel(next: string, a?: number, b?: number) {
		setMd(next);
		if (a == null || !ta) return;
		await tick();
		ta.focus();
		ta.setSelectionRange(a, b ?? a);
	}
	function sel() {
		return ta ? { s: ta.selectionStart, e: ta.selectionEnd } : { s: md.length, e: md.length };
	}
	function wrap(before: string, after: string, ph: string) {
		const c = sel();
		const picked = md.slice(c.s, c.e) || ph;
		const a = c.s + before.length;
		setMdSel(md.slice(0, c.s) + before + picked + after + md.slice(c.e), a, a + picked.length);
	}
	function prefix(kind: string) {
		const c = sel();
		const ls = md.lastIndexOf('\n', c.s - 1) + 1;
		let le = md.indexOf('\n', c.e);
		if (le < 0) le = md.length;
		const body = md
			.slice(ls, le)
			.split('\n')
			.map((l, i) => {
				const bare = l.replace(/^(#{1,6}\s+|>\s?|\s*[-*+]\s+|\s*\d+[.)]\s+)/, '');
				return kind === 'ol' ? `${i + 1}. ${bare}` : kind + bare;
			})
			.join('\n');
		setMdSel(md.slice(0, ls) + body + md.slice(le), ls + body.length);
	}
	function blockInsert(snippet: string, selFrom?: number, selLen = 0) {
		const c = sel();
		const pre = md.slice(0, c.s).replace(/\n+$/, '');
		const post = md.slice(c.e).replace(/^\n+/, '');
		const head = pre ? `${pre}\n\n` : '';
		const a = head.length + (selFrom ?? snippet.length);
		setMdSel(head + snippet + (post ? `\n\n${post}` : '\n'), a, a + selLen);
	}

	/** 選んだ行を中央 / 右寄せにする（left で解除）。 */
	function alignLines(al: 'left' | 'center' | 'right') {
		insOpen = false;
		const c = sel();
		const ls = md.lastIndexOf('\n', c.s - 1) + 1;
		let le = md.indexOf('\n', c.e);
		if (le < 0) le = md.length;
		const body = md
			.slice(ls, le)
			.replace(/^<p align="(?:center|right)">/, '')
			.replace(/<\/p>\s*$/, '');
		const out = al === 'left' ? body : `<p align="${al}">${body}</p>`;
		setMdSel(md.slice(0, ls) + out + md.slice(le), ls + out.length);
	}

	const INSERTS: [string, string, string, () => void][] = [
		['中央寄せ', '≡', '選んだ行を中央に', () => alignLines('center')],
		['右寄せ', '⇥', '選んだ行を右に', () => alignLines('right')],
		['左寄せに戻す', '⇤', '配置を解除', () => alignLines('left')],
		[
			'埋め込み',
			'URL',
			'URLだけの行がカードに',
			() => ((insOpen = false), blockInsert('https://', 8, 0))
		],
		[
			'ファイル',
			'PDF',
			'[名前.pdf](URL)',
			() => ((insOpen = false), blockInsert('[ファイル名.pdf](https://)', 1, 9))
		],
		['目次', 'TOC', '見出しから目次を作る', () => ((insOpen = false), blockInsert('[toc]'))]
	];

	const CHEATS: [string, string][] = [
		['## 見出し', '大見出し'],
		['### 見出し', '小見出し'],
		['**太字** / __太字__', '太字'],
		['~~文字~~', '取り消し線'],
		['*文字*', '斜体'],
		['`code`', 'インラインコード'],
		['[文字](URL)', 'リンク'],
		['- 項目', '箇条書きリスト'],
		['1. 項目', '番号付きリスト'],
		['> 文章', '引用'],
		['> — 出典', '引用の出典（引用の最後の行）'],
		['```', 'コードブロック'],
		['---', '区切り線'],
		['![説明](画像URL)', '画像'],
		['https://…（URLだけの行）', '埋め込み（リンクカード）'],
		['[名前.pdf](URL)', 'ファイル'],
		['[toc]', '目次'],
		['<p align="center">…</p>', '中央寄せ'],
		['<p align="right">…</p>', '右寄せ'],
		['⌘/Ctrl + B · I · K', '太字 · 斜体 · リンク'],
		['⌘/Ctrl + Shift + X', '取り消し線']
	];

	function onMdKey(e: KeyboardEvent) {
		if (!(e.metaKey || e.ctrlKey)) return;
		const k = e.key.toLowerCase();
		if (k === 'x' && e.shiftKey) {
			e.preventDefault();
			wrap('~~', '~~', '取り消し線');
			return;
		}
		const f = {
			b: () => wrap('**', '**', '太字'),
			i: () => wrap('*', '*', '斜体'),
			k: () => wrap('[', '](https://)', 'リンク')
		}[k];
		if (f) {
			e.preventDefault();
			f();
		}
	}

	function onWindowKey(e: KeyboardEvent) {
		// ⌘S / Ctrl+S で下書き保存
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			send('save');
		}
	}

	function toGui() {
		if (!blocks.length) setBlocks([blk('p')]);
		mode = 'gui';
	}

	// 保存していない変更があるときは、ページを離れる前に確認する。
	beforeNavigate((nav) => {
		if (!dirty || busy) return;
		if (nav.type === 'leave') {
			nav.cancel();
			return;
		}
		if (!confirm('保存していない変更があります。このページを離れますか？')) nav.cancel();
	});

	onMount(() => {
		// 共通ヘッダーの下を、エディタが画面の高さいっぱいに使う。
		const header = document.querySelector<HTMLElement>('header.gh');
		if (!header) return;
		const ro = new ResizeObserver(() => (headerH = header.offsetHeight));
		ro.observe(header);
		return () => ro.disconnect();
	});
</script>

<svelte:head>
	<title>記事を書く（12/{d.day}） | KMC Advent Calendar {data.year}</title>
</svelte:head>

<svelte:window onkeydown={onWindowKey} />

<div class="shell pagein" style="--hh: {headerH}px">
	<main class="work">
		<h1 class="sr-only">記事を書く</h1>
		<div class="topbar">
			<input
				class="t-in"
				type="text"
				aria-label="タイトル"
				placeholder="記事のタイトル"
				maxlength={TITLE_MAX}
				bind:value={title}
			/>
			<div class="t-acts">
				<span class="badge" class:badge-draft={STATUS[status][1]}
					>{dirty ? '未保存の変更あり' : STATUS[status][0]}</span
				>
				<span class="stat">{stats.chars} 文字 · 約 {stats.minutes} 分で読めます</span>
				<button class="pill pill-ghost" onclick={copyMd}>Markdown をコピー</button>
				<button class="pill pill-pine" onclick={() => send('save')} disabled={busy}
					>下書き保存</button
				>
				{#if status !== 'new'}
					<a class="pill pill-ghost" href="/posts/{d.day}{q}"
						>{status === 'submitted' ? '記事を見る →' : '下書きを見る →'}</a
					>
				{/if}
				<button class="pill pill-acc" onclick={() => send('publish')} disabled={busy}
					>{status === 'submitted' ? '更新する' : '投稿する'}</button
				>
			</div>
		</div>

		<div class="metabar">
			<div class="seg" role="tablist" aria-label="編集モード">
				<button
					class="seg-b"
					class:seg-on={mode === 'gui'}
					role="tab"
					aria-selected={mode === 'gui'}
					onclick={toGui}
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
						><rect x="3" y="4" width="18" height="5" rx="1.5"></rect><rect
							x="3"
							y="11"
							width="18"
							height="4"
							rx="1.5"
						></rect><rect x="3" y="17" width="11" height="3" rx="1.5"></rect></svg
					>GUI
				</button>
				<button
					class="seg-b"
					class:seg-on={mode === 'md'}
					role="tab"
					aria-selected={mode === 'md'}
					onclick={() => (mode = 'md')}
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
						><rect x="2.5" y="5" width="19" height="14" rx="2"></rect><path
							d="M6 15V9l3 3 3-3v6M15.5 9v6M13.5 13l2 2 2-2"
						></path></svg
					>Markdown
				</button>
			</div>
			<span class="mf">
				<span class="mf-l">担当日</span>
				{#if data.days.length > 1}
					<select
						class="mf-in"
						aria-label="担当日"
						value={d.day}
						onchange={(e) => location.assign(`/write/${e.currentTarget.value}${q}`)}
					>
						{#each data.days as x (x.day)}<option value={x.day}
								>12/{x.day}（{weekdayEn(x.day)}）</option
							>{/each}
					</select>
				{:else}
					<span class="mf-v">DEC {pad(d.day)} · {weekdayEn(d.day)}</span>
				{/if}
			</span>
			<span class="mf">
				<span class="mf-l">著者</span>
				<span class="mf-v"
					><Avatar name={d.author} image={d.image} class="size-6 text-[10px]" />{d.author}</span
				>
			</span>
			<label class="mf" style="--g: {g?.color ?? '#C9C1B3'}">
				<span class="mf-dot" aria-hidden="true"></span><span class="mf-l">ジャンル</span>
				<select class="mf-in" bind:value={genre}>
					<option value="">未選択</option>
					{#each GENRES as opt (opt.key)}<option value={opt.key}>{opt.label}</option>{/each}
				</select>
			</label>
			<span class="flex-1"></span>
			<!-- GUI は書いたままの見た目で編集できるので、プレビューは Markdown モードだけ。 -->
			{#if mode === 'md'}
				<button
					class="tg"
					class:tg-on={preview}
					aria-pressed={preview}
					onclick={() => (preview = !preview)}
					><span class="tg-box" aria-hidden="true"></span>プレビュー</button
				>
			{/if}
		</div>

		{#if d.externalUrl && status !== 'submitted'}
			<p class="note">
				いまは外部の記事URL（{d.externalUrl}）が登録されています。「投稿する」を押すと、カレンダーのリンク先がこのサイトの記事に切り替わります。
			</p>
		{/if}

		<div class="ed-grid">
			<section class="ed-col" aria-label="エディタ">
				{#if mode === 'md'}
					<div class="tb" role="toolbar" aria-label="Markdown 書式">
						<button class="tb-b" aria-label="見出し2" onclick={() => prefix('## ')}>H2</button>
						<button class="tb-b" aria-label="見出し3" onclick={() => prefix('### ')}>H3</button>
						<span class="tb-sep" aria-hidden="true"></span>
						<button
							class="tb-b"
							aria-label="太字"
							onclick={() => wrap('**', '**', '太字')}
							style="font-weight: 900">B</button
						>
						<button
							class="tb-b"
							aria-label="斜体"
							onclick={() => wrap('*', '*', '斜体')}
							style="font-style: italic">I</button
						>
						<button
							class="tb-b"
							aria-label="取り消し線"
							onclick={() => wrap('~~', '~~', '取り消し線')}
							style="text-decoration: line-through">S</button
						>
						<button
							class="tb-b"
							aria-label="インラインコード"
							onclick={() => wrap('`', '`', 'code')}
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"></path></svg
							>
						</button>
						<button
							class="tb-b"
							aria-label="リンク"
							onclick={() => wrap('[', '](https://)', 'リンク')}
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								aria-hidden="true"
								><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path
									d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
								></path></svg
							>
						</button>
						<span class="tb-sep" aria-hidden="true"></span>
						<button class="tb-b" aria-label="箇条書き" onclick={() => prefix('- ')}>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								aria-hidden="true"
								><path d="M9 6h12M9 12h12M9 18h12"></path><circle cx="4" cy="6" r="1"
								></circle><circle cx="4" cy="12" r="1"></circle><circle cx="4" cy="18" r="1"
								></circle></svg
							>
						</button>
						<button class="tb-b" aria-label="番号付きリスト" onclick={() => prefix('ol')}>1.</button
						>
						<button class="tb-b" aria-label="引用" onclick={() => prefix('> ')}>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								aria-hidden="true"><path d="M5 7v10M10 9h9M10 15h6"></path></svg
							>
						</button>
						<button
							class="tb-b"
							aria-label="コードブロック"
							onclick={() => blockInsert('```\nコード\n```', 4, 3)}>```</button
						>
						<button
							class="tb-b"
							aria-label="画像"
							onclick={() => blockInsert('![代替テキスト](https://)', 2, 6)}
						>
							<svg
								width="18"
								height="18"
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
						</button>
						<button class="tb-b" aria-label="区切り線" onclick={() => blockInsert('---')}>—</button>
						<span class="tb-sep" aria-hidden="true"></span>
						<button
							class="tb-b"
							aria-label="配置・埋め込み・ファイルを挿入"
							aria-haspopup="menu"
							aria-expanded={insOpen}
							onclick={() => ((insOpen = !insOpen), (helpOpen = false))}
							>挿入<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.4"
								aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg
							></button
						>
						<button
							class="tb-b"
							aria-label="記法一覧"
							aria-expanded={helpOpen}
							onclick={() => ((helpOpen = !helpOpen), (insOpen = false))}>?</button
						>
					</div>
					{#if insOpen}
						<button class="pop-back" aria-label="メニューを閉じる" onclick={() => (insOpen = false)}
						></button>
						<div class="pop pop-ins" role="menu" aria-label="挿入">
							{#each INSERTS as [label, ic, desc, pick] (label)}
								<button class="pop-i" role="menuitem" onclick={pick}
									><span class="pop-ic" aria-hidden="true">{ic}</span><span class="pop-t"
										><span class="pop-l">{label}</span><span class="pop-d">{desc}</span></span
									></button
								>
							{/each}
						</div>
					{/if}
					<textarea
						class="mdta"
						aria-label="Markdown 本文"
						spellcheck="false"
						value={md}
						oninput={(e) => setMd(e.currentTarget.value)}
						onkeydown={onMdKey}
						bind:this={ta}></textarea>
				{:else}
					<div class="pane-h">
						<span class="pane-t">GUI</span>
						<span class="flex items-center gap-2"
							><span class="hint">「/」でブロックを挿入 · Markdown 記法でも変換</span><button
								class="tb-b"
								aria-label="記法一覧"
								aria-expanded={helpOpen}
								onclick={() => (helpOpen = !helpOpen)}>?</button
							></span
						>
					</div>
					<BlockEditor {blocks} onchange={setBlocks} />
				{/if}
				{#if helpOpen}
					<div class="pop pop-help" role="dialog" aria-label="記法一覧">
						<div class="help-h">
							<span>記法一覧</span><button
								class="help-x"
								aria-label="記法一覧を閉じる"
								onclick={() => (helpOpen = false)}
								><svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"></path></svg
								></button
							>
						</div>
						{#each CHEATS as [k, v] (k)}<div class="ch-r">
								<code>{k}</code><span>{v}</span>
							</div>{/each}
					</div>
				{/if}
			</section>

			{#if mode === 'md' && preview}
				<section class="ed-col ed-pv" aria-label="プレビュー">
					<div class="pane-h">
						<span class="pane-t">PREVIEW</span><span class="hint">公開時の見え方</span>
					</div>
					<div class="scroll">
						<article class="pv">
							<h2 class="pv-title" class:pv-ph={!title.trim()}>
								{title.trim() || 'タイトル未設定'}
							</h2>
							<div class="pv-meta">
								<span class="pv-day">DEC {pad(d.day)} · {weekdayEn(d.day)}</span>
								<span>{d.author}</span>
								{#if g}<span class="gchip" style="--g: {g.color}">{g.label}</span>{/if}
							</div>
							<Markdown view={pv.view} compact />
						</article>
					</div>
				</section>
			{/if}
		</div>
	</main>
</div>

{#if toast}<div class="toast" role="status">{toast}</div>{/if}

<style>
	.shell {
		height: calc(100dvh - var(--hh, 84px));
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.work {
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: 1440px;
		margin: 0 auto;
		padding: 16px 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
	}
	.t-in {
		flex: 1 1 360px;
		min-width: 0;
		font: inherit;
		font-size: 26px;
		font-weight: 900;
		line-height: 1.3;
		color: var(--color-pine);
		background: transparent;
		border: 0;
		border-radius: 8px;
		padding: 6px 10px;
		margin-left: -10px;
		min-height: 48px;
	}
	.t-in::placeholder {
		color: #a39a8b;
	}
	.t-in:hover {
		background: rgb(255 255 255 / 0.6);
	}
	.t-in:focus {
		outline: none;
		background: #fff;
		box-shadow: inset 0 0 0 2px var(--color-pine);
	}
	.t-acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.badge {
		font-size: 12px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 99px;
		background: var(--color-mint);
		color: var(--color-pine);
	}
	.badge-draft {
		background: #e7e0d4;
		color: #3d372e;
	}
	.stat {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		color: var(--color-muted);
	}
	.pill {
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		min-height: 44px;
		padding: 0 20px;
		border-radius: 99px;
		border: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		text-decoration: none;
		transition:
			transform 0.15s,
			filter 0.15s,
			background 0.15s;
	}
	.pill:hover {
		transform: translateY(-1px);
	}
	.pill:disabled {
		opacity: 0.5;
		cursor: default;
		transform: none;
	}
	.pill-pine {
		background: var(--color-pine);
		color: var(--color-cream);
	}
	.pill-pine:hover {
		background: var(--color-pine-dark);
		color: var(--color-cream);
	}
	.pill-ghost {
		background: #fff;
		color: var(--color-pine);
		box-shadow: inset 0 0 0 1.5px var(--color-pine);
	}
	.pill-ghost:hover {
		color: var(--color-pine);
	}
	.pill-acc {
		background: var(--accent);
		color: #1b1b1b;
	}
	.pill-acc:hover {
		filter: brightness(1.05);
	}
	.metabar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.mf {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 6px 0 14px;
		border-radius: 99px;
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--color-line);
	}
	.mf:focus-within {
		box-shadow: inset 0 0 0 2px var(--color-pine);
	}
	.mf-l {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-muted);
		white-space: nowrap;
	}
	.mf-in {
		font: inherit;
		font-size: 14px;
		font-weight: 700;
		color: var(--color-ink);
		background: transparent;
		border: 0;
		min-height: 40px;
		padding: 0 8px;
		border-radius: 99px;
		cursor: pointer;
	}
	.mf-in:focus {
		outline: none;
	}
	.mf-v {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px 0 2px;
		font-size: 14px;
		font-weight: 700;
	}
	.mf-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--g);
		flex: none;
	}
	.seg {
		display: inline-flex;
		padding: 4px;
		border-radius: 99px;
		background: #e7e0d4;
		gap: 4px;
	}
	.seg-b {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		min-height: 40px;
		padding: 0 18px;
		border-radius: 99px;
		border: 0;
		background: transparent;
		color: #3d372e;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.seg-b:hover {
		background: rgb(255 255 255 / 0.6);
	}
	.seg-on,
	.seg-on:hover {
		background: var(--color-pine);
		color: var(--color-cream);
	}
	.tg {
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		min-height: 44px;
		padding: 0 14px;
		border-radius: 99px;
		border: 0;
		background: transparent;
		color: #3d372e;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.tg:hover {
		background: #e7e0d4;
	}
	.tg-box {
		width: 34px;
		height: 20px;
		border-radius: 99px;
		background: #c9c1b3;
		position: relative;
		transition: background 0.2s;
	}
	.tg-box::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s;
	}
	.tg-on .tg-box {
		background: var(--color-pine);
	}
	.tg-on .tg-box::after {
		transform: translateX(14px);
	}
	.note {
		margin: 0;
		padding: 10px 16px;
		border-radius: 8px;
		background: #fbecd0;
		color: #5a4310;
		font-size: 13px;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.ed-grid {
		flex: 1;
		min-height: 0;
		display: flex;
		background: #fff;
		border-radius: 10px;
		box-shadow: inset 0 0 0 1px var(--color-line);
		overflow: hidden;
	}
	.ed-col {
		flex: 1 1 0;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.ed-pv {
		border-left: 1px solid var(--color-line);
	}
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.pane-h {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 16px;
		border-bottom: 1px solid #e7e0d4;
		min-height: 53px;
		flex: none;
		background: #fbf8f3;
	}
	.pane-t {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--color-muted);
	}
	.hint {
		font-size: 12px;
		color: #6b6458;
		line-height: 1.6;
	}
	.tb {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 2px;
		padding: 8px 10px;
		min-height: 53px;
		border-bottom: 1px solid #e7e0d4;
		background: #fbf8f3;
		flex: none;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tb-b {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		min-width: 34px;
		min-height: 36px;
		padding: 0 6px;
		flex: none;
		border-radius: 6px;
		border: 0;
		background: transparent;
		color: #2b2620;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.tb-b:hover {
		background: #e7e0d4;
	}
	.tb-sep {
		width: 1px;
		align-self: stretch;
		background: #e2dbcf;
		margin: 8px 3px;
		flex: none;
	}
	.mdta {
		display: block;
		flex: 1;
		min-height: 0;
		width: 100%;
		resize: none;
		border: 0;
		padding: 20px 24px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 14px;
		line-height: 1.8;
		color: var(--color-ink);
		background: #fff;
		tab-size: 2;
	}
	.mdta:focus {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--color-pine);
	}
	.pv {
		max-width: 760px;
		margin: 0 auto;
		padding: 28px 32px 40px;
	}
	.pv-title {
		margin: 0;
		font-size: 30px;
		line-height: 1.35;
		font-weight: 900;
		color: var(--color-pine);
		overflow-wrap: anywhere;
	}
	.pv-ph {
		color: #a39a8b;
	}
	.pv-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
		margin: 14px 0 26px;
		padding-bottom: 20px;
		border-bottom: 1px solid #e7e0d4;
		font-size: 13px;
		color: var(--color-muted);
	}
	.pv-day {
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--color-pine);
	}
	.ed-col {
		position: relative;
	}
	.pop-back {
		position: fixed;
		inset: 0;
		z-index: 25;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: default;
	}
	.pop {
		position: absolute;
		top: 56px;
		right: 10px;
		z-index: 30;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: #fff;
		border-radius: 8px;
		box-shadow:
			0 0 0 1px rgb(15 15 15 / 0.07),
			0 10px 28px -8px rgb(15 15 15 / 0.28);
		padding: 4px;
	}
	.pop-ins {
		width: 250px;
	}
	.pop-help {
		width: 360px;
		max-width: calc(100% - 20px);
		max-height: calc(100% - 70px);
		padding: 6px 6px 8px;
	}
	.pop-i {
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
	.pop-i:hover {
		background: #f1ede6;
	}
	.pop-ic {
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
	.pop-t {
		display: flex;
		flex-direction: column;
		line-height: 1.35;
	}
	.pop-l {
		font-size: 13px;
		font-weight: 500;
	}
	.pop-d {
		font-size: 11px;
		color: #6b6458;
	}
	.help-h {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 6px 6px 8px;
		font-size: 13px;
		font-weight: 900;
		color: var(--color-pine);
	}
	.help-x {
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: #9b9384;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.help-x:hover {
		background: #efebe4;
		color: #3d372e;
	}
	.ch-r {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 10px;
		align-items: center;
		padding: 5px 8px;
		border-radius: 6px;
		font-size: 12px;
		color: #3d372e;
	}
	.ch-r:nth-child(even) {
		background: #faf8f4;
	}
	.ch-r code {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11.5px;
		color: var(--color-pine);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: 28px;
		transform: translateX(-50%);
		padding: 12px 20px;
		border-radius: 99px;
		background: var(--color-night);
		color: var(--color-cream);
		font-size: 14px;
		font-weight: 700;
		box-shadow: 0 14px 30px -12px rgb(11 42 41 / 0.6);
		z-index: 40;
		animation: tin 0.25s ease-out;
	}
	@keyframes tin {
		from {
			opacity: 0;
			transform: translate(-50%, 10px);
		}
	}
	@media (max-width: 900px) {
		.shell {
			height: auto;
			min-height: calc(100dvh - var(--hh, 84px));
			overflow: visible;
		}
		.ed-grid {
			flex-direction: column;
		}
		.ed-pv {
			border-left: 0;
			border-top: 1px solid var(--color-line);
		}
		.ed-col {
			flex: none;
			overflow: visible;
		}
		.scroll {
			overflow: visible;
		}
		.mdta {
			min-height: 60vh;
		}
	}
</style>
