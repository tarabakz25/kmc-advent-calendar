<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;

	onMount(() => {
		// 動きが苦手な人の設定を尊重して、雪は降らせない。
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		if (motion.matches) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		type Flake = { x: number; y: number; r: number; speed: number; sway: number; phase: number };
		let width = 0;
		let height = 0;
		let flakes: Flake[] = [];
		let frame = 0;

		const spawn = (initial: boolean): Flake => ({
			x: Math.random() * width,
			y: initial ? Math.random() * height : -10,
			r: 0.8 + Math.random() * 2.2,
			speed: 0.25 + Math.random() * 0.9,
			sway: 0.3 + Math.random() * 0.8,
			phase: Math.random() * Math.PI * 2
		});

		function resize() {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			// 画面の広さに応じた量（スマホは控えめ）。
			const count = Math.round(Math.min(110, Math.max(35, (width * height) / 16000)));
			flakes = Array.from({ length: count }, () => spawn(true));
		}

		function tick(time: number) {
			ctx!.clearRect(0, 0, width, height);
			for (const f of flakes) {
				f.y += f.speed;
				f.x += Math.sin(time / 1800 + f.phase) * f.sway * 0.35;
				if (f.y > height + 10) Object.assign(f, spawn(false));
				ctx!.beginPath();
				ctx!.fillStyle = `rgba(255,255,255,${0.35 + f.r * 0.2})`;
				ctx!.arc(f.x, f.y, f.r, 0, Math.PI * 2);
				ctx!.fill();
			}
			frame = requestAnimationFrame(tick);
		}

		const onVisibility = () => {
			cancelAnimationFrame(frame);
			if (!document.hidden) frame = requestAnimationFrame(tick);
		};

		resize();
		frame = requestAnimationFrame(tick);
		window.addEventListener('resize', resize);
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', resize);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<canvas bind:this={canvas} aria-hidden="true" class="pointer-events-none fixed inset-0 z-[1] h-full w-full"></canvas>
