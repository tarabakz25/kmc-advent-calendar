<script lang="ts">
	import { CALENDAR_YEAR } from '#lib/calendar.ts';
	import CalendarBoard from '#lib/components/CalendarBoard.svelte';
	import SiteNav from '#lib/components/SiteNav.svelte';
	import { heroStatus } from '#lib/design.ts';
	import { isReportOpen } from '#lib/report.ts';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hero = $derived(heroStatus(data.today));
	/** 12月26日からは、トップから最終レポートへ入れるようにする。 */
	const reportOpen = $derived(isReportOpen(data.today));

	// マウスに合わせて、星・雲・山・タイトルを少しずつずらす（パララックス）。
	let mx = $state(0);
	let my = $state(0);
	let raf = 0;
	function onpointermove(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const nx = (e.clientX - r.left) / r.width - 0.5;
		const ny = (e.clientY - r.top) / r.height - 0.5;
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			mx = nx;
			my = ny;
		});
	}
	const tr = (k: number) => `translate(${(mx * k).toFixed(1)}px, ${(my * k).toFixed(1)}px)`;

	const letters = (word: string, base: number) => [...word].map((c, i) => ({ c, delay: `${(base + i * 0.07).toFixed(2)}s` }));
	const rowA = letters('ADVENT', 0.1);
	const rowB = letters('CALENDAR', 0.55);
</script>

<svelte:head>
	<title>KMC Advent Calendar {data.year} | 神山まるごと高専</title>
	<meta name="description" content="神山まるごと高専のアドベントカレンダー。12月1日から25日まで、毎日ひとつずつ記事が公開されます。" />
</svelte:head>

<section class="kv" {onpointermove} onpointerleave={() => ((mx = 0), (my = 0))} aria-labelledby="kv-title">
	<div class="kv-layer" aria-hidden="true" style="transform: {tr(-8)}">
		{#each { length: 14 } as _, i (i)}<span class="star"></span>{/each}
		<svg class="moon" width="74" height="74" viewBox="0 0 74 74"><path d="M50 8A30 30 0 1 0 66 54 24 24 0 1 1 50 8z" fill="#F3EEE6"></path></svg>
		<svg class="spark s1" width="22" height="22" viewBox="0 0 22 22"><path d="M11 0v22M0 11h22M3.5 3.5l15 15M18.5 3.5l-15 15" stroke="#F3EEE6" stroke-width="1.6"></path></svg>
		<svg class="spark s2" width="16" height="16" viewBox="0 0 22 22"><path d="M11 0v22M0 11h22M3.5 3.5l15 15M18.5 3.5l-15 15" stroke="#CFE3D3" stroke-width="1.8"></path></svg>
		<svg class="spark s3" width="18" height="18" viewBox="0 0 22 22"><path d="M11 0v22M0 11h22M3.5 3.5l15 15M18.5 3.5l-15 15" stroke="#F3EEE6" stroke-width="1.6"></path></svg>
	</div>
	<div class="kv-layer" aria-hidden="true" style="transform: {tr(-22)}">
		<span class="cloud cl1"></span><span class="cloud cl2"></span><span class="cloud cl3"></span><span class="cloud cl4"></span>
	</div>
	<div class="kv-layer" aria-hidden="true">
		{#each { length: 12 } as _, i (i)}<span class="flake"></span>{/each}
	</div>

	<div class="relative z-[3]">
		<SiteNav viewer={data.viewer} />
	</div>

	<div class="kv-title" style="transform: {tr(10)}">
		<span class="kicker">
			<svg width="46" height="12" viewBox="0 0 46 12" aria-hidden="true"><path d="M0 6h40M34 1l6 5-6 5M28 1l6 5-6 5" fill="none" stroke="#CFE3D3" stroke-width="1.6"></path></svg>
			神山まるごと高専 presents
			<svg width="46" height="12" viewBox="0 0 46 12" aria-hidden="true"><path d="M46 6H6M12 1L6 6l6 5M18 1l-6 5 6 5" fill="none" stroke="#CFE3D3" stroke-width="1.6"></path></svg>
		</span>
		<h1 id="kv-title" class="m-0 flex flex-col items-center">
			<span class="row-solid" aria-label="ADVENT">
				{#each rowA as l, i (i)}<span class="ltr" aria-hidden="true" style="animation-delay: {l.delay}">{l.c}</span>{/each}
			</span>
			<span class="row-line" aria-label="CALENDAR">
				{#each rowB as l, i (i)}<span class="ltr" aria-hidden="true" style="animation-delay: {l.delay}">{l.c}</span>{/each}
			</span>
		</h1>
		<span class="ribbon">DEC 01 — DEC 25 · {CALENDAR_YEAR}</span>
		<span class="status">
			{hero.pre}<span class="status-num">{hero.num}</span>{hero.post}
		</span>
		{#if reportOpen}
			<a class="report-cta" href="/report{page.url.search}">
				FINAL REPORT を見る
				<svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M0 6h15M11 1l5 5-5 5"></path></svg>
			</a>
		{/if}
	</div>

	<svg class="ridge" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true" style="transform: {tr(-12)}">
		<path d="M0 220V128L110 78L210 112L340 44L470 104L590 66L720 122L850 52L990 106L1120 34L1270 96L1440 58V220Z" fill="#CFE3D3" opacity=".22"></path>
		<path d="M340 44L310 58L326 60L300 76L372 60L356 58ZM1120 34L1092 50L1108 51L1084 66L1150 50L1136 49Z" fill="#F3EEE6" opacity=".5"></path>
	</svg>
	<svg class="ridge" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true" style="transform: translate({(mx * -26).toFixed(1)}px, 0px)">
		<path d="M0 220V162Q180 98 360 148Q520 190 700 130Q880 80 1060 140Q1240 186 1440 118V220Z" fill="#F3EEE6"></path>
		<path d="M300 150l10-30 10 30zM322 154l9-24 9 24zM344 156l7-20 7 20zM1000 128l10-30 10 30zM1024 132l8-24 8 24zM1046 136l7-18 7 18zM640 142l9-26 9 26z" fill="#0F3B3A"></path>
	</svg>
</section>

<CalendarBoard entries={data.entries} today={data.today} cal={data.cal} />

<style>
	.kv {
		position: relative;
		overflow: hidden;
		background: var(--color-night);
		min-height: 660px;
		padding-bottom: 150px;
		color: var(--color-cream);
	}
	.kv-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.star {
		position: absolute;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--color-cream);
		animation: tw 3s ease-in-out infinite;
	}
	.star:nth-child(1) { left: 6%; top: 18%; }
	.star:nth-child(2) { left: 14%; top: 44%; animation-delay: -1s; }
	.star:nth-child(3) { left: 23%; top: 12%; animation-delay: -2s; width: 2px; height: 2px; }
	.star:nth-child(4) { left: 31%; top: 36%; animation-delay: -0.5s; }
	.star:nth-child(5) { left: 41%; top: 8%; animation-delay: -1.6s; width: 2px; height: 2px; }
	.star:nth-child(6) { left: 58%; top: 14%; animation-delay: -2.4s; }
	.star:nth-child(7) { left: 66%; top: 40%; animation-delay: -0.8s; width: 2px; height: 2px; }
	.star:nth-child(8) { left: 74%; top: 10%; animation-delay: -1.2s; }
	.star:nth-child(9) { left: 83%; top: 30%; animation-delay: -2.8s; }
	.star:nth-child(10) { left: 92%; top: 16%; animation-delay: -0.3s; width: 2px; height: 2px; }
	.star:nth-child(11) { left: 9%; top: 62%; animation-delay: -1.9s; width: 2px; height: 2px; }
	.star:nth-child(12) { left: 88%; top: 56%; animation-delay: -1.1s; }
	.star:nth-child(13) { left: 50%; top: 30%; animation-delay: -2.2s; width: 2px; height: 2px; }
	.star:nth-child(14) { left: 36%; top: 58%; animation-delay: -0.7s; width: 2px; height: 2px; }
	@keyframes tw {
		0%, 100% { opacity: 0.25; }
		50% { opacity: 1; }
	}
	.moon {
		position: absolute;
		left: 9%;
		top: 120px;
		animation: bob 7s ease-in-out infinite;
	}
	.spark {
		position: absolute;
		animation: spin 9s linear infinite;
	}
	.s1 { left: 80%; top: 118px; }
	.s2 { left: 27%; top: 250px; animation-duration: 12s; }
	.s3 { left: 90%; top: 330px; animation-duration: 7s; }
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	@keyframes bob {
		50% { transform: translateY(-8px); }
	}
	.cloud {
		position: absolute;
		height: 34px;
		border-radius: 999px;
		background: var(--color-mint);
		animation: drift 22s ease-in-out infinite alternate;
	}
	.cloud::before,
	.cloud::after {
		content: '';
		position: absolute;
		bottom: 14px;
		border-radius: 50%;
		background: var(--color-mint);
	}
	.cloud::before { left: 18%; width: 44px; height: 44px; }
	.cloud::after { left: 46%; width: 30px; height: 30px; }
	.cl1 { left: -2%; top: 200px; width: 150px; }
	.cl2 { left: 72%; top: 76px; width: 118px; animation-duration: 28s; opacity: 0.85; }
	.cl3 { left: 84%; top: 250px; width: 170px; animation-duration: 18s; }
	.cl4 { left: 30%; top: 100px; width: 90px; animation-duration: 25s; opacity: 0.55; }
	@keyframes drift {
		from { transform: translateX(-18px); }
		to { transform: translateX(26px); }
	}
	.kv :global(.flake) {
		width: 5px;
		height: 5px;
		animation-name: kvfall;
	}
	.kv :global(.flake:nth-child(9)) { left: 16%; animation-duration: 15s; animation-delay: -3s; }
	.kv :global(.flake:nth-child(10)) { left: 58%; animation-duration: 10.5s; animation-delay: -6s; }
	.kv :global(.flake:nth-child(11)) { left: 71%; animation-duration: 17s; animation-delay: -8s; width: 3px; height: 3px; }
	.kv :global(.flake:nth-child(12)) { left: 96%; animation-duration: 12s; animation-delay: -10s; }
	@keyframes -global-kvfall {
		0% { transform: translateY(0) translateX(0); }
		50% { transform: translateY(340px) translateX(16px); }
		100% { transform: translateY(700px) translateX(-8px); }
	}

	.kv-title {
		position: relative;
		z-index: 2;
		max-width: 1200px;
		margin: 0 auto;
		padding: 70px 24px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 22px;
		text-align: center;
		transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.kicker {
		display: inline-flex;
		align-items: center;
		gap: 14px;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--color-mint);
	}
	.row-solid,
	.row-line {
		display: flex;
		justify-content: center;
		font-family: var(--font-display);
		font-weight: 700;
		line-height: 0.92;
		letter-spacing: -0.02em;
	}
	.row-solid {
		font-size: clamp(64px, 11vw, 148px);
		color: var(--color-cream);
	}
	.row-line {
		font-size: clamp(52px, 9vw, 124px);
		color: transparent;
		-webkit-text-stroke: 2px var(--color-cream);
	}
	.ltr {
		display: inline-block;
		opacity: 0;
		animation: drop-in 0.7s cubic-bezier(0.2, 1.3, 0.3, 1) forwards;
		transition:
			transform 0.25s cubic-bezier(0.2, 1.6, 0.3, 1),
			color 0.25s;
		cursor: default;
	}
	.ltr:hover {
		transform: translateY(-12px) rotate(-6deg);
	}
	.row-line .ltr:hover {
		color: var(--color-mint);
	}
	.row-solid .ltr:hover {
		color: var(--accent);
	}
	@keyframes drop-in {
		from {
			opacity: 0;
			transform: translateY(-50px) rotate(8deg);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.ribbon {
		position: relative;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: #1b1b1b;
		background: var(--accent);
		padding: 10px 26px;
		transform: rotate(-2deg);
	}
	.ribbon::before,
	.ribbon::after {
		content: '';
		position: absolute;
		top: 8px;
		width: 18px;
		height: 100%;
		background: inherit;
		filter: brightness(0.8);
		z-index: -1;
	}
	.ribbon::before {
		left: -12px;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 40% 50%);
	}
	.ribbon::after {
		right: -12px;
		clip-path: polygon(0 0, 100% 0, 60% 50%, 100% 100%, 0 100%);
	}
	.status {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--color-mint);
		display: inline-flex;
		align-items: baseline;
		gap: 12px;
	}
	.status-num {
		display: inline-block;
		font-size: 72px;
		line-height: 1;
		letter-spacing: -0.03em;
		color: var(--accent);
		text-shadow: 0 0 28px rgb(240 106 85 / 0.35);
		animation: numpop 1s cubic-bezier(0.2, 1.4, 0.3, 1) 0.9s both;
	}
	@keyframes numpop {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.7);
		}
	}
	.report-cta {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		padding: 0 28px;
		border-radius: 99px;
		background: var(--accent);
		color: #1b1b1b;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-decoration: none;
		box-shadow: 0 14px 30px -14px rgb(240 106 85 / 0.8);
		animation: numpop 1s cubic-bezier(0.2, 1.4, 0.3, 1) 1.3s both;
		transition: transform 0.2s;
	}
	.report-cta:hover {
		color: #1b1b1b;
		transform: translateY(-2px);
	}
	.ridge {
		position: absolute;
		left: -2%;
		bottom: -2px;
		width: 104%;
		height: 200px;
		transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
</style>
