<script lang="ts">
	/** 文字を読ませたいページでは、景色を控えめにする。 */
	let { dim = false }: { dim?: boolean } = $props();

	// 神山の夜景。月・流れ星・山の稜線・杉・家の灯りをすべて SVG で描く。

	/** 手前の尾根に並ぶ家。x と、尾根に合わせた屋根の高さ y。 */
	const houses = [
		{ x: 150, y: 252 },
		{ x: 196, y: 250 },
		{ x: 520, y: 252 },
		{ x: 566, y: 248 },
		{ x: 612, y: 247 },
		{ x: 930, y: 248 },
		{ x: 1210, y: 246 },
		{ x: 1256, y: 247 }
	];

	/** 中景の杉。x, 根元の y, 高さ。 */
	const cedars = [
		[60, 214, 34],
		[92, 210, 42],
		[118, 214, 30],
		[330, 206, 38],
		[356, 202, 46],
		[388, 206, 32],
		[700, 190, 40],
		[728, 188, 50],
		[760, 192, 36],
		[1060, 196, 44],
		[1092, 200, 34],
		[1330, 190, 40],
		[1362, 186, 48],
		[1396, 190, 34]
	] as const;
</script>

<div class="scenery pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-700 {dim ? 'opacity-25' : ''}" aria-hidden="true">
	<!-- 月 -->
	<svg class="moon absolute max-sm:hidden top-[9%] right-[7%] size-24 sm:size-28 lg:top-[5%] lg:right-auto lg:left-[46%]" viewBox="0 0 120 120">
		<defs>
			<radialGradient id="moon-glow">
				<stop offset="0%" stop-color="#fff6d8" stop-opacity="0.55" />
				<stop offset="45%" stop-color="#f8cf73" stop-opacity="0.12" />
				<stop offset="100%" stop-color="#f8cf73" stop-opacity="0" />
			</radialGradient>
			<mask id="moon-cut">
				<rect width="120" height="120" fill="#fff" />
				<circle cx="74" cy="50" r="22" fill="#000" />
			</mask>
		</defs>
		<circle cx="60" cy="60" r="60" fill="url(#moon-glow)" class="moon-halo" />
		<circle cx="60" cy="60" r="24" fill="#fff3c9" mask="url(#moon-cut)" />
	</svg>

	<!-- 流れ星 -->
	<svg class="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 100 100">
		<defs>
			<linearGradient id="meteor" x1="0" x2="1">
				<stop offset="0%" stop-color="#fff" stop-opacity="0" />
				<stop offset="100%" stop-color="#fff" stop-opacity="0.9" />
			</linearGradient>
		</defs>
		<line class="meteor" x1="0" y1="0" x2="9" y2="3" stroke="url(#meteor)" stroke-width="0.18" style="--x: 18; --y: 6; --d: 0s" />
		<line class="meteor" x1="0" y1="0" x2="9" y2="3" stroke="url(#meteor)" stroke-width="0.14" style="--x: 55; --y: 2; --d: 7s" />
		<line class="meteor" x1="0" y1="0" x2="9" y2="3" stroke="url(#meteor)" stroke-width="0.16" style="--x: 36; --y: 14; --d: 13s" />
	</svg>

	<!-- 山並み -->
	<svg
		class="absolute inset-x-0 bottom-0 h-[30vh] min-h-40 w-full"
		viewBox="0 0 1440 320"
		preserveAspectRatio="xMidYMax slice"
	>
		<defs>
			<linearGradient id="ridge-far" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#1b2563" stop-opacity="0.75" />
				<stop offset="100%" stop-color="#0a1030" stop-opacity="0.2" />
			</linearGradient>
			<linearGradient id="ridge-mid" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#111847" />
				<stop offset="100%" stop-color="#0a1030" />
			</linearGradient>
			<linearGradient id="ridge-near" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#0a1030" />
				<stop offset="100%" stop-color="#060919" />
			</linearGradient>
			<radialGradient id="window-glow">
				<stop offset="0%" stop-color="#ffe3a3" stop-opacity="0.7" />
				<stop offset="100%" stop-color="#f8cf73" stop-opacity="0" />
			</radialGradient>
		</defs>

		<path
			class="ridge ridge-far"
			fill="url(#ridge-far)"
			d="M0 170 C120 120 220 90 340 130 S560 60 700 110 S940 70 1080 120 S1320 80 1440 130 V320 H0Z"
		/>
		<path
			class="ridge ridge-mid"
			fill="url(#ridge-mid)"
			d="M0 220 C140 170 260 160 380 200 S620 140 760 190 S1000 150 1140 200 S1340 170 1440 190 V320 H0Z"
		/>
		<g fill="#0d1440">
			{#each cedars as [x, y, h], i (i)}
				<path d="M{x} {y - h} L{x + h * 0.28} {y} H{x - h * 0.28}Z" />
			{/each}
		</g>
		<path
			class="ridge ridge-near"
			fill="url(#ridge-near)"
			d="M0 270 C160 240 300 250 460 262 S760 230 920 255 S1220 240 1440 250 V320 H0Z"
		/>

		{#each houses as h, i (i)}
			<g transform="translate({h.x} {h.y})">
				<circle cx="9" cy="10" r="18" fill="url(#window-glow)" class="lamp" style="--d: {i * 0.7}s" />
				<path d="M-2 4 L9 -6 L20 4Z" fill="#070b22" />
				<rect x="0" y="3" width="18" height="13" fill="#070b22" />
				<rect x="4" y="7" width="4" height="4" rx="0.5" fill="#ffe3a3" class="lamp" style="--d: {i * 0.7}s" />
				<rect x="10" y="7" width="4" height="4" rx="0.5" fill="#f8cf73" class="lamp" style="--d: {i * 0.7 + 1.3}s" />
			</g>
		{/each}
	</svg>
</div>

<style>
	.moon {
		animation: moon-rise 2.4s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	.moon-halo {
		transform-origin: center;
		animation: halo 6s ease-in-out infinite;
	}
	@keyframes moon-rise {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
	}
	@keyframes halo {
		50% {
			transform: scale(1.12);
			opacity: 0.75;
		}
	}

	.ridge {
		animation: ridge-in 1.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	.ridge-mid {
		animation-delay: 0.15s;
	}
	.ridge-near {
		animation-delay: 0.3s;
	}
	@keyframes ridge-in {
		from {
			opacity: 0;
			transform: translateY(40px);
		}
	}

	.lamp {
		animation: lamp 5s ease-in-out infinite;
		animation-delay: var(--d);
	}
	@keyframes lamp {
		0%,
		100% {
			opacity: 1;
		}
		45% {
			opacity: 0.55;
		}
		55% {
			opacity: 0.95;
		}
	}

	.meteor {
		opacity: 0;
		transform: translate(calc(var(--x) * 1px), calc(var(--y) * 1px));
		animation: meteor 18s linear infinite;
		animation-delay: var(--d);
	}
	@keyframes meteor {
		0% {
			opacity: 0;
			transform: translate(calc(var(--x) * 1px), calc(var(--y) * 1px));
		}
		1% {
			opacity: 1;
		}
		5% {
			opacity: 0;
			transform: translate(calc(var(--x) * 1px + 18px), calc(var(--y) * 1px + 6px));
		}
		100% {
			opacity: 0;
		}
	}
</style>
