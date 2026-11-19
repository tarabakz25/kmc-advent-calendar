<script lang="ts">
	import { DAYS, isPostPath, stateOf, type PublicEntry } from '#lib/calendar.ts';

	let {
		entries,
		today,
		complete,
		class: cls = ''
	}: { entries: PublicEntry[]; today: string; complete: boolean; class?: string } = $props();

	const byDay = $derived(new Map(entries.map((e) => [e.day, e])));
	const published = $derived(entries.filter((e) => stateOf(e, e.day, today) === 'published').length);

	// ツリーの輪郭: 頂点 (200, 62) から底辺 y=420・半幅 170 へ広がる。
	const APEX = 62;
	const BASE = 420;
	const halfWidth = (y: number) => ((y - APEX) / (BASE - APEX)) * 170;

	/** 下から上へ 7/6/5/4/3 個、合計 25 個のオーナメント。1日目は左下、25日目は星の近く。 */
	const ROWS = [
		{ y: 388, n: 7 },
		{ y: 318, n: 6 },
		{ y: 252, n: 5 },
		{ y: 192, n: 4 },
		{ y: 136, n: 3 }
	];
	const ornaments = (() => {
		const out: { day: number; x: number; y: number }[] = [];
		ROWS.forEach((row, r) => {
			const spread = halfWidth(row.y) * 0.72;
			for (let k = 0; k < row.n; k++) {
				const idx = r % 2 ? row.n - 1 - k : k; // 行ごとに向きを変えて蛇行させる
				const x = 200 - spread + (2 * spread * idx) / (row.n - 1);
				out.push({ day: out.length + 1, x, y: row.y + (k % 2 ? 7 : -5) });
			}
		});
		return out.slice(0, DAYS);
	})();

	const TIERS = [
		{ top: 230, bottom: 420, hw: 172 },
		{ top: 160, bottom: 338, hw: 136 },
		{ top: 104, bottom: 254, hw: 100 },
		{ top: 58, bottom: 172, hw: 64 }
	];
	const tierPath = ({ top, bottom, hw }: (typeof TIERS)[number]) => {
		const mid = top + (bottom - top) * 0.62;
		return `M200 ${top} Q${200 + hw * 0.42} ${mid} ${200 + hw} ${bottom} Q200 ${bottom + 26} ${200 - hw} ${bottom} Q${200 - hw * 0.42} ${mid} 200 ${top}Z`;
	};

	/** 枝にかかる電飾。左上から右下へたるむ曲線と、その上の電球。 */
	const garlands = [356, 286, 222].map((y0, g) => {
		const y1 = y0 + 22;
		const x0 = 200 - halfWidth(y0) * 0.95;
		const x1 = 200 + halfWidth(y1) * 0.95;
		const cx = 200;
		const cy = (y0 + y1) / 2 + 26;
		const bulbs = Array.from({ length: 9 }, (_, i) => {
			const t = (i + 0.5) / 9;
			const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
			const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
			return { x, y, color: ['#ffe3a3', '#ffb3c1', '#9ae9c6'][(i + g) % 3], delay: (i * 0.23 + g * 0.4) % 2.4 };
		});
		return { d: `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`, bulbs };
	});

	const STAR = (() => {
		const pts: string[] = [];
		for (let i = 0; i < 10; i++) {
			const r = i % 2 ? 11 : 27;
			const a = -Math.PI / 2 + (i * Math.PI) / 5;
			pts.push(`${(200 + r * Math.cos(a)).toFixed(1)},${(40 + r * Math.sin(a)).toFixed(1)}`);
		}
		return pts.join(' ');
	})();
</script>

<svg viewBox="0 0 400 470" class="tree {complete ? 'is-complete' : ''} {cls}" role="img" aria-label="{published}個のオーナメントが灯ったツリー">
	<defs>
		<linearGradient id="tree-fill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="#1f6b55" />
			<stop offset="100%" stop-color="#0b2e2c" />
		</linearGradient>
		<linearGradient id="tree-shade" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0%" stop-color="#000" stop-opacity="0" />
			<stop offset="55%" stop-color="#000" stop-opacity="0" />
			<stop offset="100%" stop-color="#000" stop-opacity="0.35" />
		</linearGradient>
		<radialGradient id="orn-gold" cx="35%" cy="30%">
			<stop offset="0%" stop-color="#fffaf0" />
			<stop offset="35%" stop-color="#ffe3a3" />
			<stop offset="100%" stop-color="#d9962a" />
		</radialGradient>
		<radialGradient id="orn-mint" cx="35%" cy="30%">
			<stop offset="0%" stop-color="#9ae9c6" stop-opacity="0.55" />
			<stop offset="100%" stop-color="#0d3a33" />
		</radialGradient>
		<radialGradient id="star-glow">
			<stop offset="0%" stop-color="#fff3c9" stop-opacity="0.9" />
			<stop offset="40%" stop-color="#f8cf73" stop-opacity="0.35" />
			<stop offset="100%" stop-color="#f8cf73" stop-opacity="0" />
		</radialGradient>
		<filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
			<feGaussianBlur stdDeviation="4" result="b" />
			<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
		</filter>
	</defs>

	<!-- 足元の雪 -->
	<ellipse cx="200" cy="452" rx="190" ry="14" fill="#cfe3ff" opacity="0.08" />
	<ellipse cx="200" cy="452" rx="110" ry="8" fill="#e8f1ff" opacity="0.1" />
	<rect x="186" y="415" width="28" height="40" rx="3" fill="#3b2a24" />

	<!-- 枝 -->
	{#each TIERS as tier, i (i)}
		<g class="tier" style="--d: {(TIERS.length - 1 - i) * 0.12}s">
			<path d={tierPath(tier)} fill="url(#tree-fill)" />
			<path d={tierPath(tier)} fill="url(#tree-shade)" />
		</g>
	{/each}

	<!-- 電飾 -->
	{#each garlands as g, gi (gi)}
		<path d={g.d} fill="none" stroke="#ffe3a3" stroke-opacity="0.25" stroke-width="1" class="garland" style="--d: {0.9 + gi * 0.1}s" />
		{#each g.bulbs as b, bi (bi)}
			<circle cx={b.x} cy={b.y} r="2.4" fill={b.color} class="bulb" style="--d: {b.delay}s" />
		{/each}
	{/each}

	<!-- 25 個のオーナメント = 25 日分の記事 -->
	{#each ornaments as o (o.day)}
		{@const entry = byDay.get(o.day)}
		{@const state = stateOf(entry, o.day, today)}
		<a
			href={state === 'published' ? entry!.url! : `/day/${o.day}`}
			target={state === 'published' && !isPostPath(entry!.url) ? '_blank' : undefined}
			rel={state === 'published' ? 'noopener noreferrer' : undefined}
			class="ornament state-{state}"
			style="--d: {1 + o.day * 0.04}s; --t: {(o.day * 0.37) % 3}s"
		>
			<title>12月{o.day}日{entry ? ` ${entry.author}「${entry.title}」` : '（空き）'}</title>
			<line x1={o.x} y1={o.y - 18} x2={o.x} y2={o.y - 11} stroke="#ffe3a3" stroke-opacity="0.3" />
			<rect x={o.x - 3} y={o.y - 13} width="6" height="3" rx="1" fill="#c9a24a" opacity={state === 'open' ? 0.3 : 0.9} />
			<circle
				cx={o.x}
				cy={o.y}
				r="11"
				class="ball"
				fill={state === 'published' ? 'url(#orn-gold)' : state === 'reserved' ? 'url(#orn-mint)' : 'rgb(255 255 255 / 0.04)'}
				stroke={state === 'published' ? 'none' : state === 'reserved' ? '#5fd4a0' : 'rgb(255 255 255 / 0.3)'}
				stroke-dasharray={state === 'open' ? '2 3' : undefined}
				filter={state === 'published' ? 'url(#glow)' : undefined}
			/>
			<text
				x={o.x}
				y={o.y + 3.2}
				text-anchor="middle"
				class="pointer-events-none font-display text-[9px] font-bold"
				fill={state === 'published' ? '#5a3b06' : state === 'reserved' ? '#9ae9c6' : 'rgb(255 255 255 / 0.45)'}>{o.day}</text
			>
		</a>
	{/each}

	<!-- 頂上の星。全部灯ると輝き出す -->
	<g class="star-wrap">
		<circle cx="200" cy="40" r={complete ? 70 : 30 + (published / DAYS) * 25} fill="url(#star-glow)" class="star-halo" />
		{#if complete}
			<g class="rays" stroke="#ffe3a3" stroke-linecap="round">
				{#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
					<line x1="200" y1="4" x2="200" y2="-14" stroke-width="2" opacity="0.7" transform="rotate({i * 30} 200 40)" />
				{/each}
			</g>
		{/if}
		<polygon
			points={STAR}
			class="star"
			fill={complete ? '#fff3c9' : published > 0 ? '#f8cf73' : 'transparent'}
			fill-opacity={complete ? 1 : 0.35 + (published / DAYS) * 0.65}
			stroke="#f8cf73"
			stroke-width="1.5"
			stroke-linejoin="round"
			filter="url(#glow)"
		/>
	</g>
</svg>

<style>
	.tier {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: grow 1s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
		animation-delay: var(--d);
	}
	@keyframes grow {
		from {
			opacity: 0;
			transform: scale(0.6, 0.3);
		}
	}

	.garland {
		stroke-dasharray: 400;
		stroke-dashoffset: 400;
		animation: draw 1.2s ease forwards;
		animation-delay: var(--d);
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	.bulb {
		animation: bulb 2.4s ease-in-out infinite;
		animation-delay: var(--d);
	}
	@keyframes bulb {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 1;
		}
	}
	.is-complete .bulb {
		animation-duration: 0.9s;
	}

	.ornament {
		cursor: pointer;
		outline: none;
	}
	.ornament > * {
		transform-box: fill-box;
		transform-origin: 50% 0%;
		animation: pop 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
		animation-delay: var(--d);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(-14px) scale(0.3);
		}
	}
	.ball {
		transition: transform 0.3s;
	}
	.ornament:hover .ball,
	.ornament:focus-visible .ball {
		transform: scale(1.35);
	}
	.state-published .ball {
		animation:
			pop 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both var(--d),
			twinkle 3s ease-in-out infinite calc(var(--d) + var(--t));
	}
	@keyframes twinkle {
		50% {
			opacity: 0.75;
		}
	}
	.state-open:hover .ball {
		stroke: #f8cf73;
	}

	.star {
		transform-box: fill-box;
		transform-origin: center;
		animation:
			star-in 1s 1.6s cubic-bezier(0.3, 1.6, 0.5, 1) both,
			star-spin 10s 2.6s ease-in-out infinite;
	}
	@keyframes star-in {
		from {
			opacity: 0;
			transform: scale(0) rotate(-180deg);
		}
	}
	@keyframes star-spin {
		50% {
			transform: scale(1.08) rotate(8deg);
		}
	}
	.star-halo {
		transform-box: fill-box;
		transform-origin: center;
		animation: halo 3s ease-in-out infinite;
	}
	@keyframes halo {
		50% {
			transform: scale(1.15);
			opacity: 0.7;
		}
	}
	.rays {
		transform-origin: 200px 40px;
		animation: rays 12s linear infinite;
	}
	@keyframes rays {
		to {
			transform: rotate(360deg);
		}
	}
</style>
