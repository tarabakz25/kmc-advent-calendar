<script lang="ts">
	import { page } from '$app/state';
	import { GENRES, genreOf, type Genre } from '#lib/calendar.ts';
	import BgDeco from '#lib/components/BgDeco.svelte';
	import { colorOf, pad, weekdayEn } from '#lib/design.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let genre = $state<Genre | 'all'>('all');

	const TABS = [{ key: 'all', label: 'すべて', color: '#0F3B3A' } as const, ...GENRES];
	const count = (g: Genre | 'all') => data.entries.filter((e) => g === 'all' || e.genre === g).length;
	const shown = $derived(data.entries.filter((e) => genre === 'all' || e.genre === genre));
	const curLabel = $derived(TABS.find((t) => t.key === genre)!.label);
</script>

<svelte:head>
	<title>記事一覧 | KMC Advent Calendar {data.year}</title>
</svelte:head>

<main class="content wrap pagein">
	<BgDeco />
	<div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
		<h1 class="font-display m-0 text-[44px] leading-tight font-bold tracking-tight text-pine">Articles</h1>
		<span class="font-display text-[15px] font-bold text-muted">{curLabel} · {shown.length} 本 / 全 {data.entries.length} 本</span>
	</div>

	<div class="flex flex-wrap gap-2" role="tablist" aria-label="ジャンル">
		{#each TABS as t (t.key)}
			<button
				class="tab"
				class:tab-all={t.key === 'all'}
				role="tab"
				aria-selected={genre === t.key}
				onclick={() => (genre = t.key)}
				style="--g: {t.color}"><span class="tab-dot" aria-hidden="true"></span>{t.label}<span class="tab-n">{count(t.key)}</span></button
			>
		{/each}
	</div>

	<div class="list" role="tabpanel" aria-label="{curLabel}の記事">
		{#each shown as e, i (e.day)}
			{@const g = genreOf(e.genre)}
			<svelte:element
				this={e.url ? 'a' : 'div'}
				class="card"
				href={e.url ?? undefined}
				target={e.url ? '_blank' : undefined}
				rel={e.url ? 'noopener noreferrer' : undefined}
				style="animation-delay: {(i * 0.06).toFixed(2)}s"
			>
				<div class="card-top c-{colorOf(e.day)}">
					<span class="card-num">{pad(e.day)}</span><span class="card-date">DEC {pad(e.day)}<br />{weekdayEn(e.day)}</span>
				</div>
				<div class="card-body">
					{#if g}<span class="gchip" style="--g: {g.color}">{g.label}</span>{/if}
					<h2 class="card-title">{e.title}</h2>
					<div class="card-foot">
						<span class="card-who">{e.author}</span>
						{#if e.url}
							<span class="card-go"
								>記事を読む<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"
									><path d="M5 11L11 5M6 5h5v5"></path></svg
								></span
							>
						{:else}
							<span class="card-wait">公開待ち</span>
						{/if}
					</div>
				</div>
			</svelte:element>
		{:else}
			<div class="empty-st">
				<span>{genre === 'all' ? 'まだ記事がありません。' : 'このジャンルの記事は、まだありません。'}</span>
				<a class="btn btn-main rounded-full" href="/join{page.url.search}">参加登録する →</a>
			</div>
		{/each}
	</div>
</main>

<style>
	.wrap {
		max-width: 1200px;
		margin: 0 auto;
		padding: 40px 24px 72px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.tab {
		font: inherit;
		font-size: 14px;
		font-weight: 700;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 99px;
		border: 0;
		background: #fff;
		color: var(--color-ink);
		box-shadow: inset 0 0 0 1.5px var(--color-line);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		transition:
			background 0.2s,
			box-shadow 0.2s,
			color 0.2s,
			transform 0.15s;
	}
	.tab:hover {
		box-shadow: inset 0 0 0 1.5px var(--g);
		transform: translateY(-1px);
	}
	.tab-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--g);
	}
	.tab-n {
		font-family: var(--font-display);
		font-size: 12px;
		opacity: 0.6;
	}
	.tab[aria-selected='true'] {
		background: var(--g);
		box-shadow: none;
	}
	.tab[aria-selected='true'] .tab-dot {
		background: #fff;
	}
	.tab[aria-selected='true'] .tab-n {
		opacity: 0.8;
	}
	.tab-all[aria-selected='true'] {
		color: var(--color-cream);
	}

	.list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	@media (max-width: 960px) {
		.list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 600px) {
		.list {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.card {
		background: #fff;
		border-radius: 10px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 260px;
		text-decoration: none;
		color: var(--color-ink);
		animation: cardin 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		transition:
			transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.3s;
	}
	a.card:hover {
		transform: translateY(-5px);
		box-shadow: 0 22px 36px -18px rgb(15 59 58 / 0.45);
		color: var(--color-ink);
	}
	@keyframes cardin {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
	}
	.card-top {
		padding: 18px 20px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		min-height: 96px;
	}
	.card-top.c-paper {
		box-shadow: inset 0 0 0 1px var(--color-line);
	}
	.card-num {
		font-family: var(--font-display);
		font-size: 52px;
		font-weight: 700;
		line-height: 0.9;
		letter-spacing: -0.03em;
	}
	.card-date {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		opacity: 0.75;
		padding-top: 4px;
		text-align: right;
	}
	.card-body {
		padding: 18px 20px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex: 1;
	}
	.card-title {
		margin: 0;
		font-size: 17px;
		line-height: 1.5;
		font-weight: 900;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.card-foot {
		margin-top: auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}
	.card-who {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--color-pine);
	}
	.card-go {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
		color: var(--color-pine);
	}
	.card-wait {
		font-size: 12px;
		font-weight: 700;
		color: #8a8274;
		padding: 3px 10px;
		border-radius: 99px;
		background: var(--color-cream);
	}
	.empty-st {
		grid-column: 1 / -1;
		min-height: 240px;
		border-radius: 10px;
		border: 1.5px dashed #c9c1b3;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		text-align: center;
		color: var(--color-muted);
		font-size: 15px;
	}
</style>
