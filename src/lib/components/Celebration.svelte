<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	let {
		open = $bindable(false),
		year,
		authors,
		articles
	}: { open?: boolean; year: number; authors: number; articles: number } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let closeButton = $state<HTMLButtonElement>();

	const LETTERS = [...'COMPLETE'];

	// 花火。ロケットが上がって弾け、粒が重力で落ちながら消える。
	$effect(() => {
		if (!open || !canvas) return;
		closeButton?.focus();
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		let w = 0;
		let h = 0;
		const resize = () => {
			w = window.innerWidth;
			h = window.innerHeight;
			canvas!.width = w * dpr;
			canvas!.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();

		type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
		type Rocket = { x: number; y: number; vy: number; targetY: number; color: string };
		const COLORS = ['#ffe3a3', '#f8cf73', '#ffb3c1', '#9ae9c6', '#ffffff', '#a5b4ff'];
		const sparks: Spark[] = [];
		const rockets: Rocket[] = [];
		const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)];

		const launch = () =>
			rockets.push({ x: w * (0.15 + Math.random() * 0.7), y: h, vy: -(9 + Math.random() * 4), targetY: h * (0.15 + Math.random() * 0.3), color: pick() });

		const burst = (x: number, y: number, color: string) => {
			const n = 70 + Math.floor(Math.random() * 40);
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2;
				const speed = 2 + Math.random() * 4.5;
				sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1, color: Math.random() < 0.25 ? '#fff' : color, size: 1 + Math.random() * 1.8 });
			}
		};

		let frame = 0;
		let t = 0;
		const tick = () => {
			t++;
			// 毎フレーム消して、粒は速度方向に短い尾を引いて描く（残像が焼き付かないように）。
			ctx.clearRect(0, 0, w, h);
			ctx.globalCompositeOperation = 'lighter';
			ctx.lineCap = 'round';

			if (t % 28 === 0 || (t < 120 && t % 12 === 0)) launch();

			for (let i = rockets.length - 1; i >= 0; i--) {
				const r = rockets[i];
				r.y += r.vy;
				r.vy *= 0.985;
				const trail = ctx.createLinearGradient(r.x, r.y, r.x, r.y + 40);
				trail.addColorStop(0, r.color);
				trail.addColorStop(1, 'transparent');
				ctx.strokeStyle = trail;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(r.x, r.y);
				ctx.lineTo(r.x, r.y + 40);
				ctx.stroke();
				if (r.y <= r.targetY) {
					burst(r.x, r.y, r.color);
					rockets.splice(i, 1);
				}
			}
			for (let i = sparks.length - 1; i >= 0; i--) {
				const s = sparks[i];
				s.vx *= 0.97;
				s.vy = s.vy * 0.97 + 0.06;
				s.x += s.vx;
				s.y += s.vy;
				s.life -= 0.012;
				if (s.life <= 0) {
					sparks.splice(i, 1);
					continue;
				}
				ctx.globalAlpha = s.life;
				ctx.strokeStyle = s.color;
				ctx.lineWidth = s.size * 1.6;
				ctx.beginPath();
				ctx.moveTo(s.x - s.vx * 4, s.y - s.vy * 4);
				ctx.lineTo(s.x, s.y);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		window.addEventListener('resize', resize);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', resize);
		};
	});

	// 初めてコンプリート状態を見たときだけ自動で再生する。
	onMount(() => {
		const key = `kmc-advent-complete-${year}`;
		if (!localStorage.getItem(key)) {
			localStorage.setItem(key, '1');
			open = true;
		}
	});
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

{#if open}
	<div
		class="fixed inset-0 z-50 grid place-items-center bg-night-950/70 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="complete-title"
		transition:fade={{ duration: 500 }}
	>
		<canvas bind:this={canvas} class="pointer-events-none absolute inset-0 size-full" aria-hidden="true"></canvas>
		<button type="button" class="absolute inset-0 cursor-default" aria-hidden="true" tabindex="-1" onclick={() => (open = false)}></button>

		<div class="relative px-6 text-center" in:scale={{ start: 0.85, duration: 700, delay: 200 }}>
			<svg viewBox="0 0 120 120" class="mx-auto size-28 sm:size-36" aria-hidden="true">
				<defs>
					<radialGradient id="c-glow">
						<stop offset="0%" stop-color="#fff3c9" stop-opacity="0.9" />
						<stop offset="100%" stop-color="#f8cf73" stop-opacity="0" />
					</radialGradient>
				</defs>
				<circle cx="60" cy="60" r="58" fill="url(#c-glow)" class="c-halo" />
				<path
					class="c-star"
					pathLength="1"
					d="M60 12l11.8 33.7L107 48l-28 21.4L89 104 60 83.6 31 104l10-34.6L13 48l35.2-2.3z"
				/>
			</svg>

			<p class="mt-4 font-display text-sm tracking-[0.4em] text-gold-300/90">ADVENT CALENDAR {year}</p>
			<h2 id="complete-title" class="mt-2 flex justify-center font-display text-5xl font-semibold sm:text-7xl" aria-label="COMPLETE">
				{#each LETTERS as ch, i (i)}
					<span class="letter text-shimmer" style="--i: {i}">{ch}</span>
				{/each}
			</h2>
			<p class="mx-auto mt-5 max-w-md text-sm leading-relaxed text-slate-200 sm:text-base">
				25日間、<b class="text-gold-200">{authors}人</b>で<b class="text-gold-200">{articles}本</b>の記事を灯しました。<br />
				参加してくれたみなさん、読んでくれたみなさん、ありがとう！
			</p>
			<button bind:this={closeButton} type="button" class="btn btn-gold relative mt-7" onclick={() => (open = false)}>
				ツリーを見る
			</button>
		</div>
	</div>
{/if}

<style>
	.c-star {
		fill: transparent;
		stroke: #ffe3a3;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		filter: drop-shadow(0 0 12px #f8cf73);
		animation:
			c-draw 1.4s 0.3s ease forwards,
			c-fill 0.6s 1.5s ease forwards;
	}
	@keyframes c-draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes c-fill {
		to {
			fill: #fff3c9;
		}
	}
	.c-halo {
		transform-origin: center;
		transform-box: fill-box;
		animation: c-halo 2.4s ease-in-out infinite;
	}
	@keyframes c-halo {
		50% {
			transform: scale(1.2);
			opacity: 0.6;
		}
	}
	.letter {
		display: inline-block;
		animation: letter 0.8s cubic-bezier(0.3, 1.6, 0.5, 1) both;
		animation-delay: calc(1s + var(--i) * 70ms);
	}
	@keyframes letter {
		from {
			opacity: 0;
			transform: translateY(30px) scale(0.6);
		}
	}
</style>
