<script lang="ts">
	import { onMount } from 'svelte';

	/** 実際の読み込み状況に関係なく、ページを開くたびに必ずこの時間だけ見せる（ms）。 */
	const TOTAL = 2000;
	const DELAY = 100;
	/** 100% に届いてから消え始めるまでの余韻。 */
	const HOLD = 350;
	const DUR = TOTAL - DELAY - HOLD;

	/** オーナメントの位置（上から順）。4% ごとに 1 つずつ灯る。 */
	const ORN_POS: [number, number][] = [
		[100, 52],
		[88, 70],
		[112, 68],
		[76, 82],
		[123, 82],
		[100, 92],
		[82, 106],
		[118, 104],
		[68, 122],
		[96, 120],
		[128, 124],
		[56, 134],
		[144, 132],
		[100, 134],
		[84, 148],
		[116, 148],
		[70, 162],
		[100, 162],
		[130, 162],
		[57, 178],
		[85, 180],
		[115, 180],
		[143, 178],
		[46, 188],
		[156, 188]
	];
	const ORN_COLORS = ['var(--accent)', '#F3C65A', '#CFE3D3', '#F3EEE6'];
	const ORN_OFF = 'rgba(11, 42, 41, 0.35)';

	let show = $state(true);
	let leaving = $state(false);
	let pct = $state(0);

	const orns = $derived(
		ORN_POS.map(([x, y], i) => {
			const on = pct >= (i + 1) * 4;
			return { x, y, on, fill: on ? ORN_COLORS[i % 4] : ORN_OFF };
		})
	);
	const starOn = $derived(pct >= 100);

	onMount(() => {
		let raf = 0;
		let timer: ReturnType<typeof setTimeout>;

		const finish = () => {
			leaving = true;
			timer = setTimeout(() => (show = false), 500);
		};

		// OS の「視差効果を減らす」設定に関係なく、全員に同じ演出を見せる方針。
		let t0: number | null = null;
		const tick = (now: number) => {
			t0 ??= now;
			const p = Math.max(0, Math.min(1, (now - t0 - DELAY) / DUR));
			pct = Math.round((1 - Math.pow(1 - p, 2.2)) * 100);
			if (p < 1) raf = requestAnimationFrame(tick);
			else timer = setTimeout(finish, HOLD);
		};
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			clearTimeout(timer);
		};
	});
</script>

<noscript
	><style>
		.ld {
			display: none !important;
		}
	</style></noscript
>

{#if show}
	<div class="ld" class:leaving role="status" aria-label="読み込み中">
		<div class="ld-snow" aria-hidden="true">
			{#each { length: 7 } as _}<span class="ld-flake"></span>{/each}
		</div>
		<div class="ld-in">
			<svg class="xtree" width="220" height="264" viewBox="0 0 200 240" aria-hidden="true">
				<rect class="xt-trunk" x="88" y="192" width="24" height="24" rx="3" fill="#A86E48" />
				<ellipse cx="100" cy="218" rx="62" ry="6" fill="#F3EEE6" opacity=".18" />
				<circle cx="100" cy="128" r="104" fill="#CFE3D3" opacity=".07" />
				<circle cx="100" cy="128" r="76" fill="#CFE3D3" opacity=".06" />
				<path
					class="xt-tier xt-3"
					d="M100 106L172 190Q100 204 28 190Z"
					fill="#2F8F62"
					stroke="#CFE3D3"
					stroke-width="2"
					stroke-linejoin="round"
				/>
				<path
					class="xt-tier xt-2"
					d="M100 66L154 136Q100 148 46 136Z"
					fill="#3AA171"
					stroke="#CFE3D3"
					stroke-width="2"
					stroke-linejoin="round"
				/>
				<path
					class="xt-tier xt-1"
					d="M100 32L138 88Q100 97 62 88Z"
					fill="#4DB583"
					stroke="#CFE3D3"
					stroke-width="2"
					stroke-linejoin="round"
				/>
				<g
					class="xt-garland"
					fill="none"
					stroke="#F3EEE6"
					stroke-width="1.6"
					stroke-linecap="round"
					opacity=".55"
				>
					<path d="M72 80Q100 92 128 78" />
					<path d="M58 124Q100 140 144 120" />
					<path d="M42 174Q100 192 160 170" />
				</g>
				{#each orns as o}
					<circle class="xt-orn" class:xt-on={o.on} cx={o.x} cy={o.y} r="4.6" style:fill={o.fill} />
				{/each}
				<g class="xt-star" class:xt-star-on={starOn}>
					<path
						d="M100 6l5 10.8 11.8 1.3-8.8 8 2.4 11.6L100 31.8l-10.4 5.9L92 26.1l-8.8-8 11.8-1.3z"
						fill="#F3C65A"
					/>
				</g>
			</svg>
			<span class="ld-title">KMC ADVENT 2026</span>
			<span class="ld-bar" aria-hidden="true"
				><span class="ld-fill" style:width="{pct}%"></span></span
			>
			<span class="ld-pct" aria-live="polite">{pct}<small>%</small></span>
		</div>
	</div>
{/if}

<style>
	.ld {
		position: fixed;
		inset: 0;
		z-index: 100;
		overflow: hidden;
		background: #0b2a29;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			opacity 0.5s ease,
			visibility 0.5s;
	}
	.ld.leaving {
		opacity: 0;
		visibility: hidden;
	}
	.ld-snow {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.ld-in {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 28px;
		transition: transform 0.5s ease;
	}
	.leaving .ld-in {
		transform: scale(0.96);
	}

	/* ── ツリー ── */
	.xtree {
		overflow: visible;
	}
	.xt-tier {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		transform: scale(0);
		animation: tierin 0.6s cubic-bezier(0.2, 1.4, 0.3, 1) forwards;
	}
	.xt-3 {
		animation-delay: 0.1s;
	}
	.xt-2 {
		animation-delay: 0.25s;
	}
	.xt-1 {
		animation-delay: 0.4s;
	}
	@keyframes tierin {
		to {
			transform: none;
		}
	}
	.xt-trunk {
		transform-box: fill-box;
		transform-origin: 50% 0;
		transform: scaleY(0);
		animation: tierin 0.4s ease-out forwards;
	}
	.xt-garland path {
		stroke-dasharray: 140;
		stroke-dashoffset: 140;
		animation: garland 1.2s ease-out 0.7s forwards;
	}
	@keyframes garland {
		to {
			stroke-dashoffset: 0;
		}
	}
	.xt-orn {
		transform-box: fill-box;
		transform-origin: center;
		transition: fill 0.3s;
	}
	.xt-on {
		animation: ornpop 0.45s cubic-bezier(0.2, 1.8, 0.3, 1);
	}
	@keyframes ornpop {
		0% {
			transform: scale(0.4);
		}
		100% {
			transform: scale(1);
		}
	}
	.xt-star {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0.15;
		transition: opacity 0.3s;
	}
	.xt-star-on {
		opacity: 1;
		animation:
			starin 0.7s cubic-bezier(0.2, 1.5, 0.3, 1) forwards,
			starglow 2.4s ease-in-out 0.7s infinite;
	}
	@keyframes starin {
		from {
			transform: scale(0) rotate(-180deg);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes starglow {
		0%,
		100% {
			filter: drop-shadow(0 0 2px rgba(243, 198, 90, 0.4));
		}
		50% {
			filter: drop-shadow(0 0 14px rgba(243, 198, 90, 0.9));
		}
	}

	/* ── テキストと進捗 ── */
	.ld-title {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 700;
		font-size: 20px;
		letter-spacing: 0.32em;
		color: #f3eee6;
		opacity: 0;
		animation: ldfade 0.5s ease-out 0.6s forwards;
	}
	@keyframes ldfade {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.ld-bar {
		width: 200px;
		height: 2px;
		border-radius: 2px;
		background: rgba(243, 238, 230, 0.18);
		overflow: hidden;
	}
	.ld-fill {
		display: block;
		height: 100%;
		width: 0;
		background: var(--accent);
	}
	.ld-pct {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 44px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
		color: #f3eee6;
		font-variant-numeric: tabular-nums;
		min-width: 3.2ch;
		text-align: center;
	}
	.ld-pct small {
		font-size: 18px;
		margin-left: 2px;
		color: var(--accent);
	}

	/* ── 雪 ── */
	.ld-flake {
		position: absolute;
		top: -12px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #f3eee6;
		opacity: 0.5;
		animation: ldfall linear infinite;
	}
	.ld-flake:nth-child(1) {
		left: 10%;
		animation-duration: 11s;
	}
	.ld-flake:nth-child(2) {
		left: 24%;
		animation-duration: 14s;
		animation-delay: -5s;
		width: 3px;
		height: 3px;
	}
	.ld-flake:nth-child(3) {
		left: 38%;
		animation-duration: 12s;
		animation-delay: -8s;
	}
	.ld-flake:nth-child(4) {
		left: 55%;
		animation-duration: 16s;
		animation-delay: -2s;
		width: 3px;
		height: 3px;
	}
	.ld-flake:nth-child(5) {
		left: 68%;
		animation-duration: 13s;
		animation-delay: -10s;
	}
	.ld-flake:nth-child(6) {
		left: 82%;
		animation-duration: 15s;
		animation-delay: -6s;
		width: 4px;
		height: 4px;
	}
	.ld-flake:nth-child(7) {
		left: 93%;
		animation-duration: 11.5s;
		animation-delay: -3s;
	}
	@keyframes ldfall {
		to {
			transform: translateY(110vh) translateX(-10px);
		}
	}
</style>
