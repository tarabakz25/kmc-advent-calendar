<script lang="ts">
	import type { Seg, ViewBlock } from '#lib/markdown.ts';

	let {
		view,
		compact = false
	}: {
		view: ViewBlock[];
		/** エディタのプレビュー用に少し小さく組み、未入力のブロックには案内を出す。 */
		compact?: boolean;
	} = $props();

	// ページの h1 は記事タイトルなので、本文の見出しは h2 から始める。
	const TAG = { h1: 'h2', h2: 'h2', h3: 'h3' } as const;
</script>

{#snippet segs(list: Seg[])}
	{#each list as s, i (i)}
		{#if s.href}
			<a href={s.href} target="_blank" rel="noopener noreferrer">{s.text}</a>
		{:else if s.cls}
			<span class={s.cls}>{s.text}</span>
		{:else}
			{s.text}
		{/if}
	{/each}
{/snippet}

<div class="md" class:compact>
	{#each view as x, i (i)}
		{#if x.kind === 'h1' || x.kind === 'h2' || x.kind === 'h3'}
			<svelte:element this={TAG[x.kind]} class="m-{x.kind}" id={x.anchor || undefined}
				>{@render segs(x.segs)}</svelte:element
			>
		{:else if x.kind === 'p'}
			<p
				class="m-p"
				class:m-al-center={x.align === 'center'}
				class:m-al-right={x.align === 'right'}
			>
				{@render segs(x.segs)}
			</p>
		{:else if x.kind === 'quote'}
			<blockquote class="m-q">
				{@render segs(x.segs)}{#if x.cite}<cite class="m-cite">— {x.cite}</cite>{/if}
			</blockquote>
		{:else if x.kind === 'ul'}
			<ul class="m-list">
				{#each x.items as it, k (k)}<li>{@render segs(it)}</li>{/each}
			</ul>
		{:else if x.kind === 'ol'}
			<ol class="m-list">
				{#each x.items as it, k (k)}<li>{@render segs(it)}</li>{/each}
			</ol>
		{:else if x.kind === 'code'}
			<pre class="m-pre">{#if x.lang}<span class="m-lang">{x.lang}</span>{/if}<code>{x.text}</code
				></pre>
		{:else if x.kind === 'img'}
			{#if x.url}
				<figure class="m-img">
					<img src={x.url} alt={x.caption} loading="lazy" />
					{#if x.caption.trim()}<figcaption>{x.caption}</figcaption>{/if}
				</figure>
			{:else if compact}
				<figure class="m-img">
					<div class="m-imgph">画像URL（https://…）を入力すると表示されます</div>
				</figure>
			{/if}
		{:else if x.kind === 'embed'}
			{#if x.href}
				<a class="m-embed" href={x.href} target="_blank" rel="noopener noreferrer">
					<span class="m-embed-ic" aria-hidden="true"
						><svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							><circle cx="12" cy="12" r="9"></circle><path
								d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"
							></path></svg
						></span
					>
					<span class="m-embed-t"><b>{x.host}</b><span>{x.href}</span></span>
					<svg
						class="m-go"
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"><path d="M5 11L11 5M6 5h5v5"></path></svg
					>
				</a>
			{:else if compact}
				<div class="m-imgph m-ph-s">URL（https://…）を入力するとカードで表示されます</div>
			{/if}
		{:else if x.kind === 'file'}
			{#if x.href}
				<a class="m-file" href={x.href} target="_blank" rel="noopener noreferrer">
					<span class="m-file-ext" aria-hidden="true">{x.ext}</span>
					<span class="m-embed-t"><b>{x.name}</b><span>{x.host}</span></span>
					<svg
						class="m-go"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg
					>
				</a>
			{:else if compact}
				<div class="m-imgph m-ph-s">ファイルのURL（https://…）を入力すると表示されます</div>
			{/if}
		{:else if x.kind === 'toc'}
			<nav class="m-toc" aria-label="目次">
				<span class="m-toc-t">目次</span>
				{#if !x.items.length}<span class="m-toc-e">見出しがまだありません</span>{/if}
				<ol>
					{#each x.items as t (t.anchor)}<li class:toc-2={t.level === 2}>
							<a href="#{t.anchor}">{t.text}</a>
						</li>{/each}
				</ol>
			</nav>
		{:else if x.kind === 'hr'}
			<hr class="m-hr" />
		{/if}
	{/each}
</div>

<style>
	.md {
		color: #1e1b17;
		font-size: 16.5px;
		line-height: 1.95;
		word-break: break-word;
	}
	.md > :global(:first-child) {
		margin-top: 0;
	}
	.m-h1 {
		margin: 40px 0 16px;
		font-size: 27px;
		line-height: 1.4;
		font-weight: 900;
		color: var(--color-pine);
		scroll-margin-top: 16px;
	}
	.m-h2 {
		margin: 40px 0 14px;
		padding-bottom: 10px;
		font-size: 22px;
		line-height: 1.45;
		font-weight: 900;
		color: var(--color-pine);
		border-bottom: 2px solid var(--color-mint);
		scroll-margin-top: 16px;
	}
	.m-h3 {
		scroll-margin-top: 16px;
		margin: 28px 0 10px;
		font-size: 18px;
		line-height: 1.5;
		font-weight: 700;
		color: var(--color-pine);
	}
	.m-p {
		margin: 0 0 18px;
		white-space: pre-line;
	}
	.m-list {
		margin: 0 0 18px;
		padding-left: 1.5em;
	}
	.m-list li {
		margin: 6px 0;
	}
	ul.m-list {
		list-style: disc;
	}
	ol.m-list {
		list-style: decimal;
	}
	.m-q {
		margin: 0 0 18px;
		padding: 14px 20px;
		background: var(--color-cream);
		border-radius: 8px;
		color: #3d372e;
		white-space: pre-line;
	}
	.m-pre {
		margin: 0 0 20px;
		border-radius: 8px;
		background: #0f1f1e;
		color: #e6f0ec;
		overflow-x: auto;
	}
	.m-lang {
		display: block;
		padding: 10px 16px 0;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #9fc2b4;
	}
	.m-pre code {
		display: block;
		padding: 10px 16px 16px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 13.5px;
		line-height: 1.7;
		white-space: pre;
	}
	.m-img {
		margin: 0 0 20px;
	}
	.m-img img {
		display: block;
		max-width: 100%;
		border-radius: 8px;
	}
	.m-img figcaption {
		margin-top: 8px;
		font-size: 13px;
		color: #6b6458;
		text-align: center;
	}
	.m-imgph {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 140px;
		border-radius: 8px;
		border: 1.5px dashed #c9c1b3;
		font-size: 13px;
		color: #6b6458;
	}
	.m-hr {
		margin: 32px 0;
		border: 0;
		height: 2px;
		background: #e7e0d4;
	}
	.md :global(.i-b) {
		font-weight: 900;
	}
	.md :global(.i-i) {
		font-style: italic;
	}
	.md :global(.i-s) {
		text-decoration: line-through;
		text-decoration-thickness: 1.5px;
		opacity: 0.75;
	}
	.m-al-center {
		text-align: center;
	}
	.m-al-right {
		text-align: right;
	}
	.m-cite {
		display: block;
		margin-top: 8px;
		font-style: normal;
		font-size: 13px;
		color: #6b6458;
		white-space: normal;
	}
	/* 本文のリンク（.md a）の下線・色を打ち消す */
	.md .m-embed,
	.md .m-file {
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 0 0 18px;
		padding: 14px 16px;
		border-radius: 10px;
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--color-line);
		text-decoration: none;
		color: var(--color-ink);
		transition:
			box-shadow 0.2s,
			transform 0.2s;
	}
	.md .m-embed:hover,
	.md .m-file:hover {
		box-shadow: inset 0 0 0 1.5px var(--color-pine);
		transform: translateY(-1px);
		color: var(--color-ink);
	}
	.m-embed-ic,
	.m-file-ext {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.m-embed-ic {
		background: var(--color-cream);
		color: var(--color-pine);
	}
	.m-file-ext {
		background: var(--color-pine);
		color: var(--color-cream);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
	}
	.m-embed-t {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		line-height: 1.45;
	}
	.m-embed-t b {
		font-size: 15px;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.m-embed-t span {
		font-size: 12px;
		color: #6b6458;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.m-go {
		flex: none;
		color: #6b6458;
	}
	.m-ph-s {
		min-height: 72px;
		margin: 0 0 18px;
	}
	.m-toc {
		margin: 0 0 22px;
		padding: 16px 20px;
		border-radius: 10px;
		background: #f7f3ec;
	}
	.m-toc-t {
		display: block;
		font-size: 13px;
		font-weight: 900;
		color: var(--color-pine);
		margin-bottom: 6px;
	}
	.m-toc-e {
		font-size: 13px;
		color: #6b6458;
	}
	.m-toc ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.m-toc li {
		margin: 2px 0;
		line-height: 1.6;
	}
	.m-toc .toc-2 {
		padding-left: 1.2em;
		font-size: 0.92em;
	}
	.md .m-toc a {
		color: var(--color-pine);
		text-decoration: none;
	}
	.md .m-toc a:hover {
		text-decoration: underline;
	}
	.md :global(.i-c) {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.88em;
		padding: 2px 6px;
		border-radius: 4px;
		background: #efe9df;
		color: var(--color-pine);
	}
	.md a {
		color: #0f5e5b;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.md a:hover {
		color: var(--color-pine-dark);
	}

	.compact {
		font-size: 16px;
		line-height: 1.9;
	}
	.compact .m-h1 {
		margin: 36px 0 14px;
		font-size: 26px;
	}
	.compact .m-h2 {
		margin: 32px 0 12px;
		padding-bottom: 8px;
		font-size: 21px;
	}
	.compact .m-h3 {
		margin: 26px 0 10px;
		font-size: 17px;
	}
	.compact .m-p,
	.compact .m-list,
	.compact .m-q {
		margin-bottom: 16px;
	}
	.compact .m-pre code {
		font-size: 13px;
	}
</style>
