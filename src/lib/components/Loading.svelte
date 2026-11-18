<script lang="ts">
	import { onMount } from 'svelte';

	/** セッション中に一度見せたら、以降のページ遷移・再読み込みでは出さない。 */
	const SEEN_KEY = 'kmc-advent-loaded';
	const DELAY = 150;
	const DUR = 2300;
	/** 100% に届いてから消え始めるまでの余韻。 */
	const HOLD = 450;

	const TREE = [
		['mint'],
		['pine', 'coral', 'pine'],
		['mint', 'pine', 'paper', 'pine', 'mint'],
		['pine', 'coral', 'mint', 'pine', 'mint', 'coral', 'pine'],
		['mint', 'pine', 'paper', 'pine', 'coral', 'pine', 'paper', 'pine', 'mint']
	];
	let k = 0;
	const rows = TREE.map((row) =>
		row.map((c) => ({ cls: `lt-${c}`, delay: `${(0.15 + k++ * 0.045).toFixed(3)}s` }))
	);

	let show = $state(true);
	let leaving = $state(false);
	let pct = $state(0);

	onMount(() => {
		// app.html の先読みスクリプトで既に隠しているので、DOM からも外すだけ。
		if (document.documentElement.classList.contains('ld-skip')) {
			show = false;
			return;
		}

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let raf = 0;
		let timer: ReturnType<typeof setTimeout>;

		const finish = () => {
			try {
				sessionStorage.setItem(SEEN_KEY, '1');
			} catch {
				// プライベートモードなどで保存できなくても表示には影響しない。
			}
			leaving = true;
			timer = setTimeout(() => (show = false), 500);
		};

		if (reduced) {
			pct = 100;
			timer = setTimeout(finish, 600);
		} else {
			let t0: number | null = null;
			const tick = (now: number) => {
				t0 ??= now;
				const p = Math.max(0, Math.min(1, (now - t0 - DELAY) / DUR));
				pct = Math.round((1 - Math.pow(1 - p, 2.2)) * 100);
				if (p < 1) raf = requestAnimationFrame(tick);
				else timer = setTimeout(finish, HOLD);
			};
			raf = requestAnimationFrame(tick);
		}

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
			<div class="ld-tree" aria-hidden="true">
				<svg class="ld-star" width="40" height="40" viewBox="0 0 40 40">
					<path
						d="M20 2l5.3 11.6L38 15l-9.4 8.6L31.2 36 20 29.6 8.8 36l2.6-12.4L2 15l12.7-1.4z"
						fill="#F3C65A"
					/>
				</svg>
				{#each rows as row}
					<div class="ld-row">
						{#each row as t}<span class="ld-t {t.cls}" style:animation-delay={t.delay}
							></span>{/each}
					</div>
				{/each}
				<span class="ld-trunk"></span>
			</div>
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
	:global(.ld-skip) .ld {
		display: none;
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

	.ld-tree {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		transform-origin: 50% 100%;
		animation: ldbeat 0.5s ease 1.55s;
	}
	@keyframes ldbeat {
		50% {
			transform: scale(1.08) rotate(-2deg);
		}
	}
	.ld-row {
		display: flex;
		gap: 6px;
	}
	.ld-t {
		width: 26px;
		height: 26px;
		border-radius: 5px;
		opacity: 0;
		transform: scale(0.3) rotate(-25deg);
		animation: ldpop 0.45s cubic-bezier(0.2, 1.5, 0.3, 1) forwards;
	}
	@keyframes ldpop {
		to {
			opacity: 1;
			transform: none;
		}
	}
	.lt-pine {
		background: #2a6a66;
	}
	.lt-mint {
		background: #cfe3d3;
	}
	.lt-coral {
		background: var(--accent);
	}
	.lt-paper {
		background: #f3eee6;
	}
	.ld-star {
		margin-bottom: 4px;
		opacity: 0;
		transform: scale(0) rotate(-180deg);
		animation:
			starin 0.7s cubic-bezier(0.2, 1.5, 0.3, 1) 1.3s forwards,
			starglow 2.4s ease-in-out 2s infinite;
	}
	@keyframes starin {
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
	.ld-trunk {
		width: 22px;
		height: 20px;
		border-radius: 0 0 4px 4px;
		background: #8a5a3c;
		opacity: 0;
		transform: scaleY(0);
		transform-origin: 50% 0;
		animation: trunkin 0.4s ease-out 0.1s forwards;
	}
	@keyframes trunkin {
		to {
			opacity: 1;
			transform: none;
		}
	}

	.ld-title {
		font-family: 'Space Grotesk', sans-serif;
		font-weight: 700;
		font-size: 20px;
		letter-spacing: 0.32em;
		color: #f3eee6;
		opacity: 0;
		animation: ldfade 0.6s ease-out 1.35s forwards;
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

	@media (prefers-reduced-motion: reduce) {
		.ld-t,
		.ld-title,
		.ld-tree,
		.ld-star,
		.ld-trunk {
			animation-duration: 0.01s !important;
			animation-delay: 0s !important;
		}
		.ld-flake {
			display: none;
		}
	}
</style>
