<script lang="ts">
	import { CALENDAR_YEAR, DAYS, type PublicEntry } from '#lib/calendar.ts';
	import { colorOf, heroStatus, pad, shapeOf, STATUS_LABEL, statusOf, type SlotStatus } from '#lib/design.ts';
	import Avatar from './Avatar.svelte';
	import BgDeco from './BgDeco.svelte';
	import DayModal from './DayModal.svelte';
	import Legend from './Legend.svelte';
	import StatusIcon from './StatusIcon.svelte';

	let {
		entries,
		today,
		fit = false
	}: {
		entries: PublicEntry[];
		today: string;
		/** カレンダーページ用。広い画面では1画面に収め、参加状況とフッターを省く。 */
		fit?: boolean;
	} = $props();

	const days = Array.from({ length: DAYS }, (_, i) => i + 1);
	const byDay = $derived(new Map(entries.map((e) => [e.day, e])));
	const hero = $derived(heroStatus(today));
	const counts = $derived(
		days.reduce<Record<SlotStatus, number>>(
			(acc, d) => {
				acc[statusOf(byDay.get(d), today)]++;
				return acc;
			},
			{ open: 0, res: 0, done: 0 }
		)
	);

	let selected = $state<number | null>(null);

	function open(e: MouseEvent, day: number) {
		// 修飾キー付きクリックは通常のリンクとして日別ページを開く。
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		selected = day;
	}

	/**
	 * タイトルをタイルの残りの高さに収まるだけの行数で表示し、溢れた分だけ … にする。
	 * node は「名前の行 + タイトル」を縦に並べた要素で、タイルの残り高さいっぱいに広がっている。
	 */
	function fitTitle(node: HTMLElement) {
		const update = () => {
			const ttl = node.lastElementChild as HTMLElement | null;
			const who = node.firstElementChild as HTMLElement | null;
			if (!ttl || !who || ttl === who) return;
			const cs = getComputedStyle(ttl);
			const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.45;
			const gap = parseFloat(getComputedStyle(node).rowGap) || 0;
			const room = node.clientHeight - who.offsetHeight - gap;
			const lines = Math.max(1, Math.floor((room + 1) / lh));
			ttl.style.setProperty('--lines', String(lines));
		};
		const ro = new ResizeObserver(update);
		ro.observe(node);
		update();
		document.fonts?.ready.then(update);
		return { destroy: () => ro.disconnect() };
	}
</script>

<div class="content board" class:calfit={fit}>
	<BgDeco />

	{#if !fit}
		<section aria-label="参加状況" class="summary">
			<div class="flex items-baseline gap-2.5">
				<span class="font-display text-[56px] leading-none font-bold text-pine">{counts.res + counts.done}</span>
				<span class="font-display text-xl font-bold text-muted">/ {DAYS} 枠 埋まっています</span>
			</div>
			<Legend {counts} detail />
			<div class="segs" aria-hidden="true">
				{#each days as d (d)}
					<span class="seg seg-{statusOf(byDay.get(d), today)}"></span>
				{/each}
			</div>
		</section>
	{/if}

	<main class="ac-grid">
		<div class="hero">
			<div aria-hidden="true" class="pointer-events-none absolute inset-0">
				{#each { length: 8 } as _, i (i)}<span class="flake"></span>{/each}
			</div>
			<span class="hero-k">DEC 01 — DEC 25, {CALENDAR_YEAR}</span>
			<div class="relative flex flex-col gap-1.5">
				<span class="hero-k">{hero.label}</span>
				<span class="bigc">{hero.num}</span>
				<span class="text-[15px] font-bold">{hero.sub}</span>
			</div>
			<span class="hero-desc">好きな日を選んで、あなたの記事でカレンダーを埋めよう。</span>
		</div>

		{#each days as day (day)}
			{@const entry = byDay.get(day)}
			{@const st = statusOf(entry, today)}
			{@const isToday = day === hero.todayDay}
			<a
				href="/day/{day}"
				class="tile c-{colorOf(day)} {shapeOf(day)}"
				class:today={isToday}
				class:st-open={!entry}
				onclick={(e) => open(e, day)}
				aria-label="12月{day}日 {entry ? `${entry.author}「${entry.title}」` : '空き枠 — 登録する'}"
				style="--i: {day}"
			>
				<span class="flex items-start justify-between gap-2">
					<span class="num">{pad(day)}</span>
					<span class="stb stb-{st}" title={STATUS_LABEL[st]}><StatusIcon status={st} /></span>
				</span>
				{#if isToday}<span class="badge">TODAY</span>{/if}
				{#if entry}
					<span class="body flex min-w-0 flex-col gap-1" use:fitTitle>
						<span class="flex min-w-0 items-center gap-[7px]">
							<Avatar name={entry.author} image={entry.image} class="uav" plain />
							<span class="who">{entry.author}</span>
						</span>
						<span class="ttl">{entry.title}</span>
					</span>
				{:else}
					<span class="empty">+ JOIN</span>
				{/if}
			</a>
		{/each}
	</main>

	{#if !fit}
		<footer class="site-footer">
			<span>記事は各公開日の 0:00 以降にリンクされます。内容や権利は各著者に帰属します。</span>
			<span class="font-display font-bold tracking-[.1em]">#KAMIYAMA_ADVENT_{CALENDAR_YEAR}</span>
		</footer>
	{/if}
</div>

{#if selected !== null}
	<DayModal day={selected} entry={byDay.get(selected)} {today} onclose={() => (selected = null)} />
{/if}

<style>
	.board {
		max-width: 1200px;
		margin: 0 auto;
		padding: 8px 24px 64px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 18px 40px;
		padding-top: 24px;
	}
	.segs {
		flex: 1 1 100%;
		display: flex;
		gap: 4px;
	}
	.seg {
		flex: 1 1 0;
		height: 10px;
		border-radius: 2px;
		transition: background 0.4s;
	}
	.seg-open {
		background: var(--color-line);
	}
	.seg-res {
		background: var(--color-amber);
	}
	.seg-done {
		background: var(--color-ink);
	}

	.ac-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-auto-rows: 150px;
		gap: 10px;
	}
	.hero {
		grid-column: span 2;
		grid-row: span 2;
		position: relative;
		overflow: hidden;
		border-radius: 4px;
		padding: 28px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		background: var(--color-pine);
		color: var(--color-cream);
	}
	.hero-k {
		position: relative;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: var(--color-mint);
	}
	.bigc {
		font-family: var(--font-display);
		font-size: 120px;
		font-weight: 700;
		line-height: 0.85;
		letter-spacing: -0.04em;
	}
	.hero-desc {
		position: relative;
		font-size: 13px;
		line-height: 1.7;
		color: var(--color-mint);
	}
	.w2 {
		grid-column: span 2;
	}
	.h2 {
		grid-row: span 2;
	}
	.big {
		grid-column: span 2;
		grid-row: span 2;
	}
	.x4 {
		grid-column: span 4;
	}

	.tile {
		position: relative;
		overflow: hidden;
		padding: 18px;
		text-decoration: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		border-radius: 4px;
		animation: tilein 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		animation-delay: calc(var(--i) * 25ms);
		transition:
			transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.35s,
			background 0.3s,
			color 0.3s;
	}
	@keyframes tilein {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	.tile:hover {
		transform: translateY(-5px) rotate(-0.6deg);
		box-shadow: 0 18px 30px -14px rgb(15 59 58 / 0.55);
		z-index: 2;
	}
	.tile.c-pine:hover,
	.tile.c-pine {
		color: var(--color-cream);
	}
	.tile.c-mint,
	.tile.c-paper,
	.tile.c-mint:hover,
	.tile.c-paper:hover {
		color: var(--color-pine);
	}
	.tile.c-coral,
	.tile.c-coral:hover {
		color: #1b1b1b;
	}
	.tile::after {
		content: '';
		position: absolute;
		right: 0;
		bottom: 0;
		width: 0;
		height: 0;
		background: linear-gradient(135deg, transparent 50%, rgb(255 255 255 / 0.55) 50%);
		transition:
			width 0.3s,
			height 0.3s;
	}
	.tile:hover::after {
		width: 34px;
		height: 34px;
	}
	.tile.st-open {
		background: rgb(255 255 255 / 0.55);
		color: #8a8274;
		box-shadow: inset 0 0 0 1px rgb(15 59 58 / 0.08);
	}
	.tile.st-open:hover {
		background: #fff;
		color: var(--color-pine);
		box-shadow: 0 18px 30px -14px rgb(15 59 58 / 0.35);
	}
	.tile.today {
		box-shadow: 0 0 0 3px var(--color-ink) inset;
	}
	.num {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 44px;
		line-height: 1;
		letter-spacing: -0.02em;
		transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
		transform-origin: left top;
	}
	.tile:hover .num {
		transform: scale(1.12) translateX(2px);
	}
	.big .num {
		font-size: 104px;
	}
	.x4 .num {
		font-size: 72px;
	}
	.h2 .num {
		font-size: 60px;
	}
	.w2 .num {
		font-size: 56px;
	}
	.tile:hover :global(.uav) {
		transform: scale(1.12);
	}
	.tile .stb {
		width: 28px;
		height: 28px;
		padding: 0;
		justify-content: center;
		gap: 0;
	}
	.who {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 13px;
		letter-spacing: 0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* 番号の下の余白いっぱいを名前+タイトルの領域にし、中身は下に寄せる */
	.body {
		flex: 1 1 0;
		min-height: 0;
		justify-content: flex-end;
	}
	.ttl {
		flex: 0 1 auto;
		min-height: 0;
		font-size: 13px;
		line-height: 1.45;
		font-weight: 500;
		display: -webkit-box;
		/* 行数は fitTitle が残りの高さから決める */
		-webkit-line-clamp: var(--lines, 2);
		line-clamp: var(--lines, 2);
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.empty {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		opacity: 0.7;
		transition:
			opacity 0.25s,
			letter-spacing 0.25s;
	}
	.tile:hover .empty {
		opacity: 1;
		letter-spacing: 0.18em;
	}
	.badge {
		position: absolute;
		top: 46px;
		right: 14px;
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.14em;
		padding: 4px 8px;
		border-radius: 99px;
		background: var(--color-ink);
		color: var(--color-cream);
		animation: pulse 1.8s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			transform: scale(1.08);
		}
	}

	@media (max-width: 900px) {
		.ac-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.w2,
		.h2,
		.big {
			grid-column: auto;
			grid-row: auto;
		}
		.x4 {
			grid-column: 1 / -1;
		}
		.big .num,
		.h2 .num,
		.w2 .num {
			font-size: 44px;
		}
	}
	@media (max-width: 560px) {
		.ac-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-auto-rows: 132px;
		}
	}

	/* カレンダーページ: 広い画面では1画面に収める */
	@media (min-width: 901px) and (min-height: 620px) {
		.calfit {
			flex: 1 1 auto;
			min-height: 0;
			width: 100%;
			padding-top: 14px;
			padding-bottom: 20px;
			gap: 12px;
		}
		.calfit .ac-grid {
			flex: 1 1 auto;
			min-height: 0;
			grid-auto-rows: minmax(0, 1fr);
			gap: 8px;
		}
		.calfit .tile {
			padding: 10px 14px;
		}
		.calfit .num {
			font-size: 30px;
		}
		.calfit .big .num {
			font-size: 72px;
		}
		.calfit .x4 .num,
		.calfit .h2 .num,
		.calfit .w2 .num {
			font-size: 40px;
		}
		.calfit .ttl {
			font-size: 12px;
		}
		.calfit .who {
			font-size: 12px;
		}
		.calfit :global(.uav) {
			width: 18px;
			height: 18px;
			font-size: 9px;
		}
		.calfit .tile .stb {
			width: 24px;
			height: 24px;
		}
		.calfit .badge {
			top: 38px;
			right: 12px;
			padding: 3px 7px;
			font-size: 9px;
		}
		.calfit .hero {
			padding: 18px;
		}
		.calfit .bigc {
			font-size: 72px;
		}
		.calfit .hero-desc {
			display: none;
		}
	}
</style>
