<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { DAYS } from '#lib/calendar.ts';
	import { ACCENT, colorOf, pad } from '#lib/design.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const st = $derived(data.stats);
	const year = $derived(data.year);
	const home = $derived(`/${page.url.search}`);

	/*
	 * ストーリー形式のスライドショー。7 シーンを自動で送り、左右のタップ・上のバー・矢印キーで移動できる。
	 * Claude Design のキャンバス「05 最終レポート」を移植したもの。
	 */
	type Bg = 'night' | 'coral' | 'pine' | 'mint' | 'cream' | 'dawn';
	const SCENES: { label: string; bg: Bg }[] = [
		{ label: 'イントロ', bg: 'night' },
		{ label: '公開された記事の数', bg: 'coral' },
		{ label: '参加した人数', bg: 'pine' },
		{ label: '埋まった日の割合', bg: 'mint' },
		{ label: 'ジャンルの内訳', bg: 'cream' },
		{ label: 'まとめ', bg: 'pine' },
		{ label: '良いお年を', bg: 'dawn' }
	];
	const LAST = SCENES.length - 1;
	/** 共通ローディングが消えきるまでの時間（Loading.svelte の TOTAL + フェードアウト）。 */
	const LOADER_MS = 2500;
	const FG: Record<Bg, string> = { night: '#F3EEE6', coral: '#1B1B1B', pine: '#F3EEE6', mint: '#0F3B3A', cream: '#0F3B3A', dawn: '#F3EEE6' };

	/** シーンの長さ（ms）。記事や人が多いほど、降ってくる演出が終わるまで長めに見せる。 */
	function durOf(i: number): number {
		if (i === 1) return Math.max(3600, Math.round((1.7 + Math.max(0, st.published - 1) * 0.12 + 0.8) * 1000 + 600));
		if (i === 2) return Math.max(4600, Math.round((1.5 + Math.max(0, st.writers.length - 1) * 0.09 + 2.6) * 1000));
		return [3900, 0, 0, 4000, 5000, 5200, 4500][i];
	}

	let cur = $state(0);
	let prev = $state(0);
	/** 退場アニメーション中のシーン。 */
	let out = $state<number | null>(null);
	let playing = $state(true);
	/** シーンに入り直したらバーのアニメーションをやり直すためのキー。 */
	let nonce = $state(0);
	let counts = $state([0, 0, 0, 0]);
	let backReady = $state(false);

	let timer: ReturnType<typeof setTimeout> | undefined;
	let outTimer: ReturnType<typeof setTimeout> | undefined;
	let backTimer: ReturnType<typeof setTimeout> | undefined;
	let countRaf = 0;
	let startedAt = 0;
	let remain = 0;

	function schedule(ms: number) {
		clearTimeout(timer);
		startedAt = Date.now();
		remain = ms;
		timer = setTimeout(() => {
			if (cur < LAST) go(cur + 1);
		}, ms);
	}

	function go(i: number) {
		i = Math.max(0, Math.min(LAST, i));
		const from = cur;
		clearTimeout(outTimer);
		cur = i;
		prev = from;
		out = from === i ? null : from;
		playing = true;
		nonce++;
		if (from !== i) outTimer = setTimeout(() => (out = null), 750);
		schedule(durOf(i));
		counts[i] = 0;
		const target = i === 1 ? st.published : i === 2 ? st.writers.length : i === 3 ? st.coverage : 0;
		countUp(target, i === 3 ? 2000 : 300, i);
		if (i === 2) startPhys(1500);
		else stopPhys();
	}

	function countUp(target: number, delay: number, key: number) {
		cancelAnimationFrame(countRaf);
		if (!target) return;
		let t0: number | null = null;
		const tick = (now: number) => {
			t0 ??= now;
			const p = Math.max(0, Math.min(1, (now - t0 - delay) / 1300));
			counts[key] = Math.round((1 - Math.pow(1 - p, 3)) * target);
			if (p < 1) countRaf = requestAnimationFrame(tick);
		};
		countRaf = requestAnimationFrame(tick);
	}

	function toggle() {
		if (playing) {
			clearTimeout(timer);
			remain = Math.max(0, remain - (Date.now() - startedAt));
			playing = false;
		} else {
			playing = true;
			schedule(remain || durOf(cur));
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key === 'ArrowRight') go(cur + 1);
		else if (e.key === 'ArrowLeft') go(cur - 1);
		else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) toggle();
		else return;
		e.preventDefault();
	}

	/* ───── 書いた人のアイコンが上から降ってきて積み重なる（簡易物理） ───── */
	const PW = 600;
	const PH = 240;
	const R = 28;
	type Body = { x: number; y: number; vx: number; vy: number; rot: number; vr: number };
	let pb: Body[] = [];
	let bodies = $state.raw<{ x: number; y: number; rot: number }[]>([]);
	let physTimer: ReturnType<typeof setTimeout> | undefined;
	let physRaf = 0;

	function stopPhys() {
		clearTimeout(physTimer);
		cancelAnimationFrame(physRaf);
		physRaf = 0;
	}
	function startPhys(delay: number) {
		stopPhys();
		const n = st.writers.length;
		pb = Array.from({ length: n }, (_, k) => ({
			x: 60 + ((k * 137) % 480),
			y: -820 - k * 70 - ((k * 29) % 60),
			vx: ((k * 53) % 160) - 80,
			vy: 0,
			rot: ((k * 47) % 60) - 30,
			vr: ((k * 31) % 240) - 120
		}));
		bodies = pb.map((b) => ({ x: b.x, y: b.y, rot: b.rot }));
		physTimer = setTimeout(runPhys, delay);
	}
	function runPhys() {
		if (physRaf) return;
		const G = 2200;
		const E = 0.55;
		let last: number | null = null;
		let rest = 0;
		const tick = (now: number) => {
			last ??= now;
			const dt = Math.min(0.033, (now - last) / 1000);
			last = now;
			if (!playing) {
				physRaf = requestAnimationFrame(tick);
				return;
			}
			for (let sub = 0; sub < 2; sub++) {
				const h = dt / 2;
				for (const b of pb) {
					b.vy += G * h;
					b.x += b.vx * h;
					b.y += b.vy * h;
					b.rot += b.vr * h;
					if (b.x < R) (b.x = R), (b.vx = -b.vx * E);
					if (b.x > PW - R) (b.x = PW - R), (b.vx = -b.vx * E);
					if (b.y > PH - R) {
						b.y = PH - R;
						b.vy = -b.vy * E;
						b.vx *= 0.92;
						b.vr = b.vr * 0.8 + b.vx * 0.3;
						if (Math.abs(b.vy) < 60) b.vy = 0;
					}
				}
				for (let i = 0; i < pb.length; i++) {
					for (let j = i + 1; j < pb.length; j++) {
						const a = pb[i];
						const c = pb[j];
						const dx = c.x - a.x;
						const dy = c.y - a.y;
						const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
						if (d >= R * 2) continue;
						const nx = dx / d;
						const ny = dy / d;
						const ov = (R * 2 - d) / 2;
						a.x -= nx * ov;
						a.y -= ny * ov;
						c.x += nx * ov;
						c.y += ny * ov;
						const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
						if (vn < 0) {
							const jv = (-(1 + E) * vn) / 2;
							a.vx -= jv * nx;
							a.vy -= jv * ny;
							c.vx += jv * nx;
							c.vy += jv * ny;
							a.vr -= jv * 0.4;
							c.vr += jv * 0.4;
						}
					}
				}
			}
			let moving = false;
			for (const b of pb) {
				b.vr *= 0.985;
				if (Math.abs(b.vx) + Math.abs(b.vy) > 8) moving = true;
			}
			bodies = pb.map((b) => ({ x: b.x, y: b.y, rot: b.rot }));
			rest = moving ? 0 : rest + dt;
			if (rest > 0.6) {
				physRaf = 0;
				return;
			}
			physRaf = requestAnimationFrame(tick);
		};
		physRaf = requestAnimationFrame(tick);
	}

	/** シーンを描き始めたか。描いた瞬間から CSS アニメーションが走るので、見えるようになるまで描かない。 */
	let started = $state(false);
	let startTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		// URL を直接開いたときは、共通のローディング（Loading.svelte・約 2.5 秒）が上に被さる。
		// イントロが隠れてしまわないよう、消えるのを待ってから始める。サイト内の移動ではすぐ始める。
		const wait = Math.max(0, LOADER_MS - performance.now());
		startTimer = setTimeout(() => {
			started = true;
			backTimer = setTimeout(() => (backReady = true), 5000);
			go(0);
		}, wait);
		return () => {
			clearTimeout(startTimer);
			clearTimeout(timer);
			clearTimeout(outTimer);
			clearTimeout(backTimer);
			cancelAnimationFrame(countRaf);
			stopPhys();
		};
	});

	/* ───── 表示用の値 ───── */
	const filled = $derived(new Set(st.filledDays));
	const initialOf = (name: string) => ([...name.replace(/^@/, '')][0] ?? '?').toUpperCase();
	/** アイコン画像が読めなかった人。頭文字にする。 */
	let broken = $state<Record<number, boolean>>({});

	const ORN_POS = [[100, 48], [92, 60], [108, 58], [84, 72], [114, 71], [100, 86], [86, 96], [114, 95], [76, 113], [100, 99], [124, 112], [64, 116], [136, 114], [100, 128], [86, 140], [114, 138], [72, 152], [100, 147], [128, 150], [56, 168], [86, 168], [114, 168], [144, 166], [44, 169], [156, 169]];
	const ORN_COLORS = [ACCENT, '#F3C65A', '#CFE3D3', '#F3EEE6'];
	const orns = $derived(
		ORN_POS.map(([x, y], k) => ({
			x,
			y,
			fill: filled.has(k + 1) ? ORN_COLORS[k % 4] : 'rgba(11,42,41,.4)',
			delay: `${(1.1 + k * 0.05).toFixed(2)}s`
		}))
	);

	const tiles = $derived(
		Array.from({ length: DAYS }, (_, k) => ({
			num: pad(k + 1),
			cls: filled.has(k + 1) ? `m-${colorOf(k + 1)}` : 'm-empty',
			delay: `${(0.3 + k * 0.06).toFixed(3)}s`
		}))
	);

	const maxN = $derived(Math.max(1, ...st.genres.map((g) => g.n)));
	const genres = $derived(
		st.genres.map((g, k) => ({
			...g,
			h: Math.max(4, Math.round((g.n / maxN) * 100)),
			delay: `${(0.6 + k * 0.35).toFixed(2)}s`,
			delay2: `${(1.4 + k * 0.35).toFixed(2)}s`,
			isTop: st.topGenre?.key === g.key
		}))
	);
	const gEnd = $derived(0.6 + st.genres.length * 0.35);

	const papers = $derived(
		Array.from({ length: st.published }, (_, k) => ({
			x: `${((k * 53) % 120) - 60}px`,
			r: `${((k * 29) % 40) - 20}deg`,
			d: `${(1.7 + k * 0.12).toFixed(2)}s`
		}))
	);

	const PAV_BG = ['#F3EEE6', '#CFE3D3', '#F3C65A', 'var(--accent)'];

	const summary = $derived([
		{ k: '公開された記事', v: st.published, u: '本' },
		{ k: '書いてくれた人', v: st.writers.length, u: '人' },
		{ k: '埋まった日', v: st.coverage, u: '%' },
		{ k: 'いちばん多かったジャンル', v: st.topGenre?.label ?? '—', u: null }
	]);

	function mkRain(n: number, start: number, cs: string[]) {
		return Array.from({ length: n }, (_, k) => ({
			left: `${(k * 37 + k * k * 3) % 100}%`,
			w: `${6 + (k % 4) * 2}px`,
			color: cs[k % cs.length],
			d: `${(start + ((k * 13) % 50) * 0.03).toFixed(2)}s`,
			dur: `${(1.6 + (k % 6) * 0.3).toFixed(1)}s`,
			rot: `${(k * 97) % 900}deg`
		}));
	}
	const rainArticles = mkRain(80, 1.7, ['#F3C65A', '#FFFFFF', '#0F3B3A', '#CFE3D3', '#3B82C4']);
	const rainGenres = mkRain(90, 3.1, ['#F3C65A', '#F06A55', '#3B82C4', '#4C9A6A', '#0F3B3A']);
	const rainNewYear = mkRain(50, 0.8, ['#F3C65A', '#E04A5F', '#F3EEE6', '#F4B6C2']);
	const confetti = Array.from({ length: 120 }, (_, k) => {
		const a = (k / 120) * Math.PI * 2 * 3 + (k % 3) * 0.35;
		const dist = 200 + ((k * 47) % 340);
		return {
			dx: `${Math.round(Math.cos(a) * dist)}px`,
			dy: `${Math.round(Math.sin(a) * dist * 0.7)}px`,
			color: ['#F3C65A', '#0F3B3A', '#FFFFFF', '#CFE3D3'][k % 4],
			rot: `${((k * 83) % 720) - 360}deg`,
			d: `${[1.55, 1.85, 2.2][k % 3].toFixed(2)}s`
		};
	});

	const show = (i: number) => cur === i || out === i;
	const exiting = (i: number) => (out === i ? 'exiting' : '');
</script>

<svelte:head>
	<title>FINAL REPORT | KMC Advent Calendar {year}</title>
	<meta name="description" content="KMC Advent Calendar {year} の25日間をふりかえる最終レポート。" />
</svelte:head>

<svelte:window {onkeydown} />

<div class="rp bg-{SCENES[prev].bg}" class:paused={!playing} style="--accent: {ACCENT}; color: {FG[SCENES[cur].bg]}">
	{#if started}
	<div class="bars" role="group" aria-label="シーンへ移動">
		{#each SCENES as s, k (k)}
			<button class="seek" onclick={() => go(k)} aria-label="{s.label}へ" aria-current={k === cur ? 'step' : undefined}>
				{#key k === cur ? nonce : -1}
					<span class="bar" class:bar-done={k < cur} class:bar-cur={k === cur}>
						<i style="animation-duration: {durOf(k) / 1000}s; animation-play-state: {playing ? 'running' : 'paused'}"></i>
					</span>
				{/key}
			</button>
		{/each}
	</div>
	{/if}
	<div class="topbar">
		<span class="brand">KMC ADVENT {year} · FINAL REPORT</span>
		<span class="ctl">
			{#if backReady}
				<a class="backbtn" href={home}>戻る →</a>
			{:else}
				<a class="cbtn" href={home} aria-label="カレンダーに戻る">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"></path></svg>
				</a>
			{/if}
		</span>
	</div>

	{#if started}
	<button class="tap tap-l" onclick={() => go(cur - 1)} aria-label="前のシーン"></button>
	<button class="tap tap-r" onclick={() => cur < LAST && go(cur + 1)} aria-label="次のシーン"></button>

	{#if show(0)}
		<section class="sc bg-night tx-fade {exiting(0)}" aria-label="イントロ">
			<div class="rays rays-soft" aria-hidden="true"></div>
			<div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none">
				{#each { length: 6 } as _, i (i)}<span class="flake"></span>{/each}
			</div>
			<svg class="xtree" width="200" height="240" viewBox="0 0 200 240" aria-hidden="true">
				<circle cx="100" cy="118" r="100" fill="#CFE3D3" opacity=".06"></circle>
				<ellipse cx="100" cy="200" rx="64" ry="6" fill="#F3EEE6" opacity=".16"></ellipse>
				<rect class="xt-trunk" x="90" y="170" width="20" height="28" fill="#3AA171"></rect>
				<path class="xt-tier xt-3" d="M100 92L176 172L24 172Z" fill="#3AA171"></path>
				<path class="xt-tier xt-2" d="M100 56L152 118L48 118Z" fill="#3AA171"></path>
				<path class="xt-tier xt-1" d="M100 28L130 74L70 74Z" fill="#3AA171"></path>
				<g class="xt-garland" fill="none" stroke="#F3EEE6" stroke-width="2.4" stroke-linecap="round">
					<path d="M80 66Q100 75 121 63"></path>
					<path d="M60 108Q100 123 141 103"></path>
					<path d="M40 160Q100 178 160 155"></path>
				</g>
				{#each orns as o, k (k)}
					<circle class="xt-orn" cx={o.x} cy={o.y} r="4.6" fill={o.fill} style="animation-delay: {o.delay}"></circle>
				{/each}
				<g class="xt-star"><path d="M100 6l5 10.8 11.8 1.3-8.8 8 2.4 11.6L100 31.8l-10.4 5.9L92 26.1l-8.8-8 11.8-1.3z" fill="#F3C65A"></path></g>
			</svg>
			<span class="kick in2">DEC 01 — DEC 25, {year}</span>
			<h1 class="title in2">FINAL<br />REPORT</h1>
			<p class="lead in3">25日間を、ふりかえろう。</p>
		</section>
	{/if}

	{#if show(1)}
		<section class="sc bg-coral tx-circle {exiting(1)}" aria-label="公開された記事の数">
			<div class="rays" aria-hidden="true"></div>
			<div class="rain" aria-hidden="true">
				{#each rainArticles as r, k (k)}<span style="left: {r.left}; width: {r.w}; background: {r.color}; animation-delay: {r.d}; animation-duration: {r.dur}; --rot: {r.rot}"></span>{/each}
			</div>
			<div class="confetti" aria-hidden="true">
				{#each confetti as c, k (k)}<span class="cf" style="--dx: {c.dx}; --dy: {c.dy}; --c: {c.color}; --rot: {c.rot}; --d: {c.d}"></span>{/each}
			</div>
			<span class="kick in1">ARTICLES</span>
			<span class="mega in1 thump">{counts[1]}</span>
			<p class="lead in2">本の記事が公開されました</p>
			<div class="papers" aria-hidden="true">
				{#each papers as p, k (k)}<span class="paper" style="--x: {p.x}; --r: {p.r}; animation-delay: {p.d}"></span>{/each}
			</div>
			{#if st.filled > st.published}
				<p class="sub in4">予約を含めると {st.filled} 本の記事がカレンダーに並びました。</p>
			{/if}
		</section>
	{/if}

	{#if show(2)}
		<section class="sc bg-pine tx-slide {exiting(2)}" aria-label="参加した人数">
			<div class="beams" aria-hidden="true"><span></span><span></span></div>
			<span class="kick in1">WRITERS</span>
			<span class="mega in1">{counts[2]}</span>
			<p class="lead in2">人が書いてくれました</p>
			<div class="phys" aria-hidden="true">
				{#each st.writers as w, k (k)}
					{@const b = bodies[k] ?? { x: 60 + k * 90, y: -200, rot: 0 }}
					<span
						class="pav"
						style="left: {(((b.x - R) / PW) * 100).toFixed(2)}%; top: {(((b.y - R) / PH) * 100).toFixed(2)}%; transform: rotate({Math.round(b.rot)}deg); background: {PAV_BG[k % 4]}"
					>
						{#if w.image && !broken[k]}
							<!-- Google のアイコンは Referer があると表示されないことがあるため送らない。 -->
							<img src={w.image} alt="" referrerpolicy="no-referrer" draggable="false" onerror={() => (broken[k] = true)} />
						{:else}
							{initialOf(w.name)}
						{/if}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	{#if show(3)}
		<section class="sc bg-mint tx-wipe {exiting(3)}" aria-label="埋まった日の割合">
			<span class="kick in1">COVERAGE</span>
			<div class="bigmosaic" aria-hidden="true">
				{#each tiles as t, k (k)}<span class="mt flip {t.cls}" style="animation-delay: {t.delay}">{t.num}</span>{/each}
			</div>
			<span class="rate later ringed">{counts[3]}<small>%</small></span>
			<p class="lead later2">25日中 {st.filled} 日が埋まりました</p>
		</section>
	{/if}

	{#if show(4)}
		<section class="sc bg-cream tx-zoom {exiting(4)}" aria-label="ジャンルの内訳">
			<div class="rain" aria-hidden="true">
				{#each rainGenres as r, k (k)}<span style="left: {r.left}; width: {r.w}; background: {r.color}; animation-delay: {r.d}; animation-duration: {r.dur}; --rot: {r.rot}"></span>{/each}
			</div>
			<span class="kick in1">GENRES</span>
			<div class="vchart">
				{#each genres as g (g.key)}
					<div class="vcol" style="--g: {g.color}; --h: {g.h}">
						<span class="vtrack">
							{#if g.isTop}
								<span class="shock" style="animation-delay: {(gEnd + 1.55).toFixed(2)}s"></span>
								<svg class="crown" width="56" height="44" viewBox="0 0 56 44" aria-hidden="true" style="animation-delay: {(gEnd + 1).toFixed(2)}s">
									<path d="M4 14l12 12L28 4l12 22 12-12-5 26H9z" fill="#F3C65A" stroke="#C9962A" stroke-width="2" stroke-linejoin="round"></path>
									<circle cx="4" cy="14" r="3.5" fill="#F3C65A"></circle>
									<circle cx="28" cy="4" r="3.5" fill="#F3C65A"></circle>
									<circle cx="52" cy="14" r="3.5" fill="#F3C65A"></circle>
									<circle cx="28" cy="32" r="3" fill="#F06A55"></circle>
									<g class="spark" stroke="#F3C65A" stroke-width="2" stroke-linecap="round"><path d="M-6 2l-5-5M62 2l5-5M28 -8v-6"></path></g>
								</svg>
							{/if}
							<span class="vnum" style="animation-delay: {g.delay2}">{g.n}</span>
							<span class="vbar" style="animation-delay: {g.delay}"></span>
						</span>
						<span class="vlabel">{g.label}</span>
					</div>
				{/each}
			</div>
			<p class="lead toplead" style="animation-delay: {(gEnd + 1.8).toFixed(2)}s">
				{#if st.topGenre}いちばん多かったのは「{st.topGenre.label}」{:else}いろんな記事が集まりました{/if}
			</p>
		</section>
	{/if}

	{#if show(5)}
		<section class="sc bg-pine tx-slide {exiting(5)}" aria-label="まとめ">
			<span class="kick in1">SUMMARY</span>
			<p class="lead in1">{year} 年のアドベントカレンダーのまとめ</p>
			<div class="sgrid">
				{#each summary as m, k (k)}
					<div class="scard flipin" style="animation-delay: {(0.5 + k * 0.3).toFixed(1)}s">
						<span class="hk">{m.k}</span>
						{#if m.u !== null}
							<span class="snum">{m.v}<small>{m.u}</small></span>
						{:else}
							<span class="snum snum-t">{m.v}</span>
						{/if}
					</div>
				{/each}
			</div>
			<p class="sub in4" style="animation-delay: 2.2s">25 日間、カレンダーを一緒に埋めてくれてありがとうございました。</p>
		</section>
	{/if}

	{#if show(6)}
		<section class="sc bg-dawn tx-diag ny {exiting(6)}" aria-label="良いお年を">
			<svg class="ny-art" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
				<g fill="#F3EEE6">
					<circle class="tw" cx="90" cy="90" r="2"></circle><circle class="tw t2" cx="240" cy="170" r="1.5"></circle><circle class="tw t3" cx="420" cy="70" r="2"></circle><circle class="tw" cx="530" cy="210" r="1.4"></circle><circle class="tw t2" cx="760" cy="60" r="1.8"></circle><circle class="tw t3" cx="880" cy="190" r="1.5"></circle><circle class="tw" cx="1010" cy="100" r="2.2"></circle><circle class="tw t2" cx="1180" cy="160" r="1.6"></circle><circle class="tw t3" cx="1220" cy="60" r="1.4"></circle><circle class="tw" cx="340" cy="300" r="1.3"></circle><circle class="tw t2" cx="960" cy="320" r="1.3"></circle>
				</g>
				<g transform="translate(330 150)"><g class="fwi" stroke="#F3C65A" stroke-width="3" stroke-linecap="round"><path d="M0 -14V-46M0 14V46M-14 0H-46M14 0H46M10 -10L33 -33M-10 -10L-33 -33M10 10L33 33M-10 10L-33 33"></path></g></g>
				<g transform="translate(960 130)"><g class="fwi f2" stroke="#E04A5F" stroke-width="3" stroke-linecap="round"><path d="M0 -16V-54M0 16V54M-16 0H-54M16 0H54M12 -12L38 -38M-12 -12L-38 -38M12 12L38 38M-12 12L-38 38"></path></g></g>
				<g transform="translate(1130 270)"><g class="fwi f3" stroke="#F4B6C2" stroke-width="2.5" stroke-linecap="round"><path d="M0 -12V-38M0 12V38M-12 0H-38M12 0H38M9 -9L27 -27M-9 -9L-27 -27M9 9L27 27M-9 9L-27 27"></path></g></g>
				<g transform="translate(160 220)"><g class="fwi f4" stroke="#F3EEE6" stroke-width="2.5" stroke-linecap="round"><path d="M0 -12V-36M0 12V36M-12 0H-36M12 0H36M9 -9L26 -26M-9 -9L-26 -26M9 9L26 26M-9 9L-26 26"></path></g></g>
				<g transform="translate(760 250)"><g class="fwi f5" stroke="#F3C65A" stroke-width="2.5" stroke-linecap="round"><path d="M0 -12V-40M0 12V40M-12 0H-40M12 0H40M9 -9L29 -29M-9 -9L-29 -29M9 9L29 29M-9 9L-29 29"></path></g></g>
				<g class="sun">
					<circle cx="640" cy="600" r="230" fill="#F3C65A" opacity=".08"></circle>
					<circle cx="640" cy="600" r="170" fill="#F3C65A" opacity=".14"></circle>
					<circle cx="640" cy="600" r="118" fill="#F3C65A"></circle>
				</g>
				<path d="M0 640Q180 560 380 612T760 592T1280 604V800H0Z" fill="#232B5C"></path>
				<g class="fuji">
					<path d="M330 660L560 432Q590 408 620 414Q650 406 690 420L940 660Z" fill="#2E3A75"></path>
					<path d="M560 432Q590 408 620 414Q650 406 690 420L742 472Q722 462 706 480Q686 460 664 478Q642 458 620 480Q598 460 578 478Q560 462 540 474Z" fill="#F3EEE6"></path>
				</g>
				<path d="M0 700Q320 646 640 688T1280 676V800H0Z" fill="#F3EEE6"></path>
				<path d="M0 740Q300 712 640 736T1280 728V800H0Z" fill="#E6DFD3"></path>
				<g class="belfry">
					<path d="M60 312L240 248L420 312Z" fill="#5A3A26"></path>
					<rect x="74" y="310" width="332" height="14" rx="3" fill="#7A4E33"></rect>
					<rect x="96" y="324" width="14" height="380" fill="#7A4E33"></rect>
					<rect x="376" y="324" width="14" height="380" fill="#7A4E33"></rect>
					<g class="ripple" fill="none" stroke="#F3C65A" stroke-width="2"><circle cx="210" cy="420" r="60"></circle><circle class="r2" cx="210" cy="420" r="60"></circle><circle class="r3" cx="210" cy="420" r="60"></circle></g>
					<g class="bell">
						<rect x="206" y="324" width="8" height="14" fill="#5A3A26"></rect>
						<path d="M172 352Q172 336 210 336Q248 336 248 352L254 456Q256 468 266 472L154 472Q164 468 166 456Z" fill="#C08A3E"></path>
						<path d="M168 392H252M166 430H254" stroke="#8E6328" stroke-width="3"></path>
						<g fill="#8E6328"><circle cx="184" cy="366" r="3"></circle><circle cx="198" cy="366" r="3"></circle><circle cx="222" cy="366" r="3"></circle><circle cx="236" cy="366" r="3"></circle><circle cx="184" cy="378" r="3"></circle><circle cx="198" cy="378" r="3"></circle><circle cx="222" cy="378" r="3"></circle><circle cx="236" cy="378" r="3"></circle></g>
						<circle cx="210" cy="448" r="6" fill="#8E6328"></circle>
					</g>
					<g class="log"><rect x="280" y="440" width="84" height="12" rx="6" fill="#A86E48"></rect><path d="M314 324V440M338 324V440" stroke="#F3EEE6" stroke-width="1.5" opacity=".6"></path></g>
				</g>
				<g class="soba">
					<path class="steam" d="M410 610q-10 -18 0 -36t0 -36" fill="none" stroke="#F3EEE6" stroke-width="3" stroke-linecap="round" opacity=".7"></path>
					<path class="steam s2" d="M440 604q-10 -18 0 -36t0 -36" fill="none" stroke="#F3EEE6" stroke-width="3" stroke-linecap="round" opacity=".7"></path>
					<path class="steam s3" d="M470 610q-10 -18 0 -36t0 -36" fill="none" stroke="#F3EEE6" stroke-width="3" stroke-linecap="round" opacity=".7"></path>
					<path d="M372 640Q440 726 508 640Z" fill="#B23A2E"></path>
					<path d="M384 664Q440 700 496 664" stroke="#F3EEE6" stroke-width="2" fill="none" opacity=".7"></path>
					<ellipse cx="440" cy="640" rx="68" ry="12" fill="#3D2A1F"></ellipse>
					<path d="M392 638Q420 628 440 640T488 636M398 644Q430 634 452 644T484 642" stroke="#C8A26A" stroke-width="3" fill="none"></path>
					<circle cx="462" cy="634" r="8" fill="#F3EEE6"></circle><circle cx="462" cy="634" r="3" fill="#F06A55"></circle>
					<path d="M420 632L470 588M430 634L482 594" stroke="#7A4E33" stroke-width="4" stroke-linecap="round"></path>
					<ellipse cx="440" cy="700" rx="44" ry="7" fill="#0B2A29" opacity=".12"></ellipse>
				</g>
				<g class="kado">
					<path d="M1040 520V660H1070V504Z" fill="#6FB36A"></path>
					<path d="M1074 470V660H1104V454Z" fill="#7CC277"></path>
					<path d="M1108 540V660H1138V524Z" fill="#6FB36A"></path>
					<path d="M1040 520L1070 504L1070 512L1040 528Z M1074 470L1104 454L1104 462L1074 478Z M1108 540L1138 524L1138 532L1108 548Z" fill="#E6F2D8"></path>
					<path d="M1040 590H1070M1074 560H1104M1074 610H1104M1108 600H1138" stroke="#4E8F4B" stroke-width="3"></path>
					<g fill="#2D5A45"><circle cx="1030" cy="648" r="16"></circle><circle cx="1052" cy="636" r="14"></circle><circle cx="1126" cy="636" r="14"></circle><circle cx="1150" cy="648" r="16"></circle><circle cx="1090" cy="640" r="12"></circle></g>
					<g class="plum" fill="#F4B6C2"><circle cx="1036" cy="632" r="5"></circle><circle cx="1146" cy="630" r="5"></circle><circle cx="1062" cy="624" r="4"></circle></g>
					<path d="M1014 652H1166L1154 726H1026Z" fill="#C8A26A"></path>
					<path d="M1022 676H1158M1026 700H1156" stroke="#9A7A44" stroke-width="3"></path>
					<path d="M1018 664H1162" stroke="#B23A2E" stroke-width="6"></path>
				</g>
			</svg>
			<div class="rain rain-loop" aria-hidden="true">
				{#each rainNewYear as r, k (k)}<span style="left: {r.left}; width: {r.w}; background: {r.color}; animation-delay: {r.d}; animation-duration: {r.dur}; --rot: {r.rot}"></span>{/each}
			</div>
			<span class="kick in1" style="position: relative">SEE YOU IN {year + 1}</span>
			<h2 class="ny-title in1">良いお年を。</h2>
			<span class="ny-year in2">
				{year}<svg width="42" height="16" viewBox="0 0 42 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 8h36M32 3l6 5-6 5"></path></svg><b>{year + 1}</b>
			</span>
			<p class="lead in2" style="position: relative; font-size: clamp(16px, 1.8vw, 20px); font-weight: 700">書いてくれた人も、読んでくれた人も、ありがとうございました。</p>
		</section>
	{/if}
	{/if}
</div>

<style>
	.rp {
		position: fixed;
		inset: 0;
		overflow: hidden;
		font-family: 'Noto Sans JP', sans-serif;
		user-select: none;
		transition:
			background 0.6s,
			color 0.6s;
	}
	.rp a {
		color: inherit;
	}
	.bg-night { background: #0b2a29; color: #f3eee6; }
	.bg-coral { background: var(--accent); color: #1b1b1b; }
	.bg-mint { background: #cfe3d3; color: #0f3b3a; }
	.bg-cream { background: #f3eee6; color: #0f3b3a; }
	.bg-pine { background: #0f3b3a; color: #f3eee6; }
	.bg-dawn { background: #161c3f; color: #f3eee6; }
	.sc { position: absolute; inset: 0; z-index: 1; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 96px 40px 80px; text-align: center; }
	.in1, .in2, .in3, .in4 { opacity: 0; animation: up 0.8s cubic-bezier(0.2, 0.9, 0.25, 1) both; }
	.in1 { animation-delay: 0.1s; }
	.in2 { animation-delay: 0.45s; }
	.in3 { animation-delay: 0.85s; }
	.in4 { animation-delay: 1.25s; }
	@keyframes up { from { opacity: 0; transform: translateY(34px); } to { opacity: 1; transform: none; } }
	.kick { font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.26em; opacity: 0.75; }
	.mega { font-family: 'Space Grotesk', sans-serif; font-size: clamp(120px, 22vw, 280px); font-weight: 700; line-height: 0.82; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
	.title { font-family: 'Space Grotesk', sans-serif; font-size: clamp(64px, 11vw, 140px); font-weight: 700; line-height: 0.9; letter-spacing: -0.03em; margin: 0; }
	.lead { font-size: clamp(20px, 2.6vw, 32px); font-weight: 900; line-height: 1.4; margin: 0; }
	.sub { font-size: 15px; line-height: 1.7; opacity: 0.75; margin: 0; }
	.sc > .kick, .sc > .mega, .sc > .lead, .sc > .sub, .sc > .papers, .sc > .title, .sc > .xtree, .sc > .bigmosaic, .sc > .rate, .sc > .vchart, .sc > .sgrid { position: relative; z-index: 1; }

	/* ───── 上のバーと操作 ───── */
	.bars { position: absolute; top: 9px; left: 24px; right: 24px; display: flex; gap: 6px; z-index: 6; }
	.seek { flex: 1; border: 0; background: transparent; padding: 9px 0; cursor: pointer; color: inherit; display: block; }
	.seek:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 4px; }
	.bar { display: block; height: 3px; border-radius: 2px; background: rgb(127 127 127 / 0.3); position: relative; overflow: hidden; transition: transform 0.2s; }
	.seek:hover .bar { transform: scaleY(2); }
	.bar i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: currentColor; }
	.bar-done i { width: 100%; }
	.bar-cur i { animation: fillbar linear forwards; }
	@keyframes fillbar { to { width: 100%; } }
	.topbar { position: absolute; top: 34px; left: 24px; right: 24px; display: flex; justify-content: space-between; align-items: center; z-index: 7; pointer-events: none; }
	.brand { font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; opacity: 0.8; }
	.ctl { pointer-events: auto; display: flex; gap: 8px; }
	.cbtn { width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid currentColor; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; opacity: 0.8; transition: opacity 0.2s, transform 0.2s; }
	.cbtn:hover { opacity: 1; transform: scale(1.06); }
	.backbtn { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border-radius: 99px; border: 1.5px solid currentColor; text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.04em; opacity: 0.9; animation: backin 0.45s cubic-bezier(0.2, 0.8, 0.2, 1); transition: opacity 0.2s, transform 0.2s; }
	.backbtn:hover { opacity: 1; transform: translateX(2px); }
	@keyframes backin { from { opacity: 0; transform: translateX(8px); } to { opacity: 0.9; transform: none; } }
	.tap { position: absolute; top: 80px; bottom: 0; width: 32%; z-index: 5; border: 0; background: transparent; padding: 0; }
	.tap-l { left: 0; cursor: w-resize; }
	.tap-r { right: 0; cursor: e-resize; }
	.tap:focus-visible { outline: 3px solid currentColor; outline-offset: -6px; }

	/* ───── 場面転換 ───── */
	.tx-fade { animation: txfade 0.8s ease both; }
	@keyframes txfade { from { opacity: 0; } to { opacity: 1; } }
	.tx-circle { animation: txcircle 0.9s cubic-bezier(0.7, 0, 0.2, 1) both; }
	@keyframes txcircle { from { clip-path: circle(0% at 80% 50%); } to { clip-path: circle(150% at 80% 50%); } }
	.tx-slide { animation: txslide 0.8s cubic-bezier(0.7, 0, 0.2, 1) both; }
	@keyframes txslide { from { transform: translateX(100%); } to { transform: none; } }
	.tx-wipe { animation: txwipe 0.9s cubic-bezier(0.7, 0, 0.2, 1) both; }
	@keyframes txwipe { from { clip-path: inset(100% 0 0 0); } to { clip-path: inset(0 0 0 0); } }
	.tx-zoom { animation: txzoom 0.9s cubic-bezier(0.2, 0.9, 0.25, 1) both; }
	@keyframes txzoom { from { opacity: 0; transform: scale(1.18); filter: blur(12px); } to { opacity: 1; transform: none; filter: none; } }
	.tx-diag { animation: txdiag 1s cubic-bezier(0.7, 0, 0.2, 1) both; }
	@keyframes txdiag { from { clip-path: polygon(0 0, 0 0, 0 0); } to { clip-path: polygon(0 0, 220% 0, 0 220%); } }
	.sc.exiting { z-index: 0; pointer-events: none; animation: scout 0.7s cubic-bezier(0.4, 0, 0.6, 1) forwards !important; }
	@keyframes scout { 0% { opacity: 1; transform: none; filter: none; } 100% { opacity: 0; transform: scale(0.88) translateY(-20px); filter: blur(12px); } }
	.exiting .kick, .exiting .mega, .exiting .title, .exiting .lead, .exiting .rate, .exiting .ny-title { animation: txtout 0.45s cubic-bezier(0.5, 0, 0.75, 0) forwards !important; }
	@keyframes txtout { to { opacity: 0; transform: translateY(-40px); letter-spacing: 0.1em; } }

	/* ───── イントロ: ツリー ───── */
	.flake { position: absolute; top: -12px; width: 5px; height: 5px; border-radius: 50%; background: #f3eee6; opacity: 0.5; animation: fall linear infinite; }
	.flake:nth-child(1) { left: 8%; animation-duration: 11s; }
	.flake:nth-child(2) { left: 22%; animation-duration: 14s; animation-delay: -5s; width: 3px; height: 3px; }
	.flake:nth-child(3) { left: 40%; animation-duration: 12s; animation-delay: -8s; }
	.flake:nth-child(4) { left: 57%; animation-duration: 16s; animation-delay: -2s; width: 3px; height: 3px; }
	.flake:nth-child(5) { left: 71%; animation-duration: 13s; animation-delay: -10s; }
	.flake:nth-child(6) { left: 86%; animation-duration: 15s; animation-delay: -6s; width: 4px; height: 4px; }
	@keyframes fall { to { transform: translateY(110vh) translateX(-10px); } }
	.xtree { overflow: visible; }
	.xt-tier { transform-box: fill-box; transform-origin: 50% 100%; transform: scale(0); animation: tierin 0.6s cubic-bezier(0.2, 1.4, 0.3, 1) forwards; }
	.xt-3 { animation-delay: 0.3s; }
	.xt-2 { animation-delay: 0.45s; }
	.xt-1 { animation-delay: 0.6s; }
	@keyframes tierin { to { transform: none; } }
	.xt-trunk { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); animation: tierin 0.4s ease-out 0.2s forwards; }
	.xt-garland path { stroke-dasharray: 140; stroke-dashoffset: 140; animation: garland 1.2s ease-out 0.9s forwards; }
	@keyframes garland { to { stroke-dashoffset: 0; } }
	.xt-orn { transform-box: fill-box; transform-origin: center; transform: scale(0); animation: ornpop 0.45s cubic-bezier(0.2, 1.8, 0.3, 1) forwards; }
	@keyframes ornpop { to { transform: scale(1); } }
	.xt-star { transform-box: fill-box; transform-origin: center; opacity: 0; animation: starin 0.7s cubic-bezier(0.2, 1.5, 0.3, 1) 2.5s forwards, starglow 2.4s ease-in-out 3.2s infinite; }
	@keyframes starin { from { opacity: 0; transform: scale(0) rotate(-180deg); } to { opacity: 1; transform: none; } }
	@keyframes starglow { 0%, 100% { filter: drop-shadow(0 0 2px rgb(243 198 90 / 0.4)); } 50% { filter: drop-shadow(0 0 14px rgb(243 198 90 / 0.9)); } }
	.rays { position: absolute; left: 50%; top: 44%; width: 180vmax; height: 180vmax; margin: -90vmax 0 0 -90vmax; background: repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.2) 0deg 7deg, transparent 7deg 20deg); -webkit-mask: radial-gradient(circle, #000 8%, transparent 55%); mask: radial-gradient(circle, #000 8%, transparent 55%); opacity: 0; animation: raysin 1s ease 0.2s forwards, spin 26s linear infinite; pointer-events: none; }
	.rays-soft { background: repeating-conic-gradient(from 0deg, rgb(207 227 211 / 0.08) 0deg 6deg, transparent 6deg 18deg); }
	@keyframes raysin { to { opacity: 1; } }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ───── 記事の数 ───── */
	.confetti { position: absolute; left: 50%; top: 40%; width: 0; height: 0; pointer-events: none; z-index: 1; }
	.cf { position: absolute; left: -5px; top: -3px; width: 10px; height: 6px; border-radius: 2px; background: var(--c); opacity: 0; animation: burst 1.6s cubic-bezier(0.15, 0.7, 0.35, 1) var(--d) forwards; }
	@keyframes burst { 0% { opacity: 1; transform: translate(0, 0) rotate(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 120px)) rotate(var(--rot)); } }
	.thump { animation: up 0.8s cubic-bezier(0.2, 0.9, 0.25, 1) 0.1s both, thump 0.5s cubic-bezier(0.2, 1.6, 0.3, 1) 1.55s, glow 2s ease-in-out 2s infinite; }
	@keyframes thump { 50% { transform: scale(1.12); } }
	@keyframes glow { 50% { text-shadow: 0 0 40px rgb(255 255 255 / 0.55); } }
	.papers { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 520px; min-height: 48px; }
	.paper { position: relative; width: 34px; height: 44px; border-radius: 4px; background: #fff; box-shadow: 0 8px 16px -8px rgb(0 0 0 / 0.4); opacity: 0; animation: paperin 0.8s cubic-bezier(0.2, 1.3, 0.3, 1) forwards; }
	.paper::before { content: ''; position: absolute; left: 7px; right: 7px; top: 9px; height: 14px; background: repeating-linear-gradient(#dcd5c9 0 2px, transparent 2px 6px); }
	.paper::after { content: ''; position: absolute; right: 0; top: 0; width: 10px; height: 10px; background: linear-gradient(225deg, var(--accent) 50%, transparent 50%); }
	@keyframes paperin { from { opacity: 0; transform: translate(var(--x), -60vh) rotate(var(--r)); } to { opacity: 1; transform: none; } }
	.rain { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 2; }
	.rain span { position: absolute; top: -20px; height: 14px; border-radius: 2px; opacity: 0; animation-name: rain; animation-timing-function: linear; animation-fill-mode: forwards; }
	.rain-loop span { animation-iteration-count: infinite; }
	@keyframes rain { 0% { opacity: 1; transform: translateY(0) rotate(0); } 100% { opacity: 1; transform: translateY(110vh) rotate(var(--rot)); } }

	/* ───── 書いた人 ───── */
	.beams { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
	.beams span { position: absolute; bottom: -10%; width: 34vw; height: 130%; background: linear-gradient(to top, rgb(243 198 90 / 0.28), transparent 80%); clip-path: polygon(45% 100%, 55% 100%, 100% 0, 0 0); transform-origin: 50% 100%; animation: beam 3.2s ease-in-out infinite alternate; }
	.beams span:first-child { left: 4%; animation-delay: -1.6s; }
	.beams span:last-child { right: 4%; animation-direction: alternate-reverse; }
	@keyframes beam { from { transform: rotate(-22deg); } to { transform: rotate(22deg); } }
	.phys { position: relative; z-index: 6; width: min(600px, 88vw); aspect-ratio: 600 / 240; border-bottom: 2px solid currentColor; overflow: visible; }
	.pav { position: absolute; width: 9.333%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-size: clamp(14px, 2vw, 22px); font-weight: 700; color: #0f3b3a; box-shadow: 0 6px 14px -6px rgb(0 0 0 / 0.5), inset 0 0 0 3px rgb(255 255 255 / 0.35); will-change: transform, left, top; }
	.pav img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }

	/* ───── 埋まった割合 ───── */
	.bigmosaic { position: relative; overflow: hidden; border-radius: 10px; display: grid; grid-template-columns: repeat(5, 56px); gap: 8px; }
	.bigmosaic::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 40%; left: -60%; background: linear-gradient(100deg, transparent, rgb(255 255 255 / 0.75), transparent); transform: skewX(-15deg); animation: shine 1.1s ease-in-out 1.9s forwards; pointer-events: none; }
	@keyframes shine { to { left: 130%; } }
	.mt { width: 56px; height: 56px; border-radius: 8px; display: flex; align-items: flex-end; justify-content: flex-start; padding: 5px 7px; font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 700; color: #0f3b3a; }
	.m-pine { background: #2a6a66; color: #f3eee6; }
	.m-mint { background: #fff; }
	.m-coral { background: var(--accent); }
	.m-paper { background: #f3eee6; }
	.m-empty { background: rgb(127 127 127 / 0.18); }
	.flip { opacity: 0; transform: perspective(400px) rotateY(90deg); animation: flip 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards; }
	@keyframes flip { to { opacity: 1; transform: perspective(400px) rotateY(0); } }
	.rate { font-family: 'Space Grotesk', sans-serif; font-size: clamp(64px, 9vw, 112px); font-weight: 700; line-height: 0.9; letter-spacing: -0.03em; }
	.rate small { font-size: 0.4em; margin-left: 4px; }
	.later { opacity: 0; animation: up 0.7s cubic-bezier(0.2, 0.9, 0.25, 1) 1.8s both; }
	.later2 { opacity: 0; animation: up 0.7s cubic-bezier(0.2, 0.9, 0.25, 1) 2.4s both; }
	.ringed::before, .ringed::after { content: ''; position: absolute; left: 50%; top: 50%; width: 150px; height: 150px; margin: -75px 0 0 -75px; border-radius: 50%; border: 3px solid currentColor; opacity: 0; animation: ring 1.6s ease-out 2.2s infinite; }
	.ringed::after { animation-delay: 2.7s; }
	@keyframes ring { 0% { opacity: 0.6; transform: scale(0.5); } 100% { opacity: 0; transform: scale(2.4); } }

	/* ───── ジャンル ───── */
	.vchart { display: flex; align-items: flex-end; justify-content: center; gap: clamp(18px, 4vw, 48px); width: min(720px, 100%); }
	.vcol { display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1 1 0; max-width: 120px; }
	.vcol:hover .vbar { filter: brightness(1.1); }
	.vtrack { position: relative; height: 300px; width: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 8px; }
	.vbar { display: block; width: 100%; height: calc(var(--h) * 2.2px); border-radius: 12px 12px 4px 4px; background: var(--g); transform-origin: 50% 100%; transform: scaleY(0); animation: vgrow 1.1s cubic-bezier(0.2, 1.2, 0.3, 1) forwards; }
	@keyframes vgrow { to { transform: scaleY(1); } }
	.vnum { font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; opacity: 0; animation: up 0.6s cubic-bezier(0.2, 0.9, 0.25, 1) both; }
	.vlabel { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
	.vlabel::before { content: ''; width: 9px; height: 9px; border-radius: 50%; background: var(--g); }
	.crown { overflow: visible; opacity: 0; animation: crown 1s cubic-bezier(0.3, 1.5, 0.4, 1) forwards; }
	@keyframes crown { 0% { opacity: 0; transform: translateY(-140px) rotate(-30deg); } 60% { opacity: 1; transform: translateY(6px) rotate(8deg); } 100% { opacity: 1; transform: none; } }
	.crown .spark { opacity: 0; animation: spark 1.2s ease-out infinite; animation-delay: inherit; }
	@keyframes spark { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
	.shock { position: absolute; left: 50%; bottom: calc(var(--h) * 2.2px + 70px); width: 80px; height: 80px; margin-left: -40px; border-radius: 50%; border: 4px solid #f3c65a; opacity: 0; animation: ring 1s ease-out forwards; pointer-events: none; }
	.toplead { opacity: 0; animation: up 0.7s cubic-bezier(0.2, 0.9, 0.25, 1) both; }

	/* ───── まとめ ───── */
	.sgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; width: min(1000px, 100%); }
	.scard { border-radius: 16px; padding: 22px 22px 24px; text-align: left; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; min-height: 170px; background: #f3eee6; color: #0f3b3a; box-shadow: 0 30px 60px -30px rgb(0 0 0 / 0.6); }
	.scard:nth-child(2) { background: var(--accent); color: #1b1b1b; }
	.scard:nth-child(3) { background: #cfe3d3; color: #0f3b3a; }
	.scard:nth-child(4) { background: #f3c65a; color: #1b1b1b; }
	.hk { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; opacity: 0.7; }
	.snum { font-family: 'Space Grotesk', sans-serif; font-size: clamp(44px, 5.6vw, 72px); font-weight: 700; line-height: 0.85; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
	.snum small { font-size: 0.32em; letter-spacing: 0; margin-left: 4px; font-family: 'Noto Sans JP', sans-serif; font-weight: 900; }
	.snum-t { font-family: 'Noto Sans JP', sans-serif; font-size: clamp(22px, 2.4vw, 30px); font-weight: 900; line-height: 1.3; letter-spacing: 0; }
	.flipin { opacity: 0; transform: perspective(900px) rotateY(-80deg); transform-origin: left center; animation: cardflip 0.9s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards, float 4s ease-in-out 1.6s infinite; }
	@keyframes cardflip { to { opacity: 1; transform: perspective(900px) rotateY(0); } }
	@keyframes float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -10px; } }
	@media (max-width: 820px) {
		.sgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	/* ───── 良いお年を ───── */
	.ny { justify-content: flex-start; padding-top: 118px; gap: 16px; }
	.ny-art { position: absolute; inset: 0; width: 100%; height: 100%; }
	.ny-title { position: relative; margin: 0; font-size: clamp(56px, 9vw, 120px); font-weight: 900; line-height: 1.05; letter-spacing: 0.02em; color: #f3eee6; animation: up 0.8s cubic-bezier(0.2, 0.9, 0.25, 1) 0.1s both, nyglow 3.6s ease-in-out 1.2s infinite; }
	@keyframes nyglow { 0%, 100% { text-shadow: 0 6px 30px rgb(0 0 0 / 0.25); } 50% { text-shadow: 0 0 34px rgb(243 198 90 / 0.55), 0 6px 30px rgb(0 0 0 / 0.25); } }
	.ny-year { position: relative; display: inline-flex; align-items: center; gap: 14px; font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 0.08em; opacity: 0; animation: up 0.8s cubic-bezier(0.2, 0.9, 0.25, 1) 0.45s both; }
	.ny-year b { display: inline-block; color: #f3c65a; animation: yr 2.4s ease-in-out 1.4s infinite; }
	@keyframes yr { 50% { transform: scale(1.12); text-shadow: 0 0 18px rgb(243 198 90 / 0.8); } }
	.tw { animation: tw 3s ease-in-out infinite; }
	.t2 { animation-delay: -1s; }
	.t3 { animation-delay: -2s; }
	@keyframes tw { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
	.fwi { transform-box: fill-box; transform-origin: center; opacity: 0; animation: fw 2.4s ease-out 1.4s infinite; }
	.f2 { animation-delay: 2s; }
	.f3 { animation-delay: 2.6s; }
	.f4 { animation-delay: 3.1s; }
	.f5 { animation-delay: 3.6s; }
	@keyframes fw { 0% { transform: scale(0.1); opacity: 0; } 8% { opacity: 1; } 60% { opacity: 0.9; } 100% { transform: scale(1.5); opacity: 0; } }
	.sun { animation: sunrise 3.2s cubic-bezier(0.2, 0.8, 0.2, 1) 0.4s both, sunbob 6s ease-in-out 3.6s infinite; }
	@keyframes sunrise { from { transform: translateY(180px); } to { transform: none; } }
	@keyframes sunbob { 0%, 100% { transform: none; } 50% { transform: translateY(-10px); } }
	.sun circle:first-child { transform-box: fill-box; transform-origin: center; animation: halo 4s ease-in-out 3.6s infinite; }
	@keyframes halo { 50% { transform: scale(1.12); opacity: 0.14; } }
	.fuji { transform-box: fill-box; transform-origin: 50% 100%; animation: fuji 1.2s cubic-bezier(0.2, 0.9, 0.25, 1) 0.3s both; }
	@keyframes fuji { from { transform: translateY(60px) scaleY(0.6); opacity: 0; } to { transform: none; opacity: 1; } }
	.belfry { animation: slidel 1s cubic-bezier(0.2, 0.9, 0.25, 1) 0.5s both; }
	@keyframes slidel { from { transform: translateX(-120px); opacity: 0; } to { transform: none; opacity: 1; } }
	.bell { transform-box: view-box; transform-origin: 210px 324px; animation: swing 3s ease-in-out 1.6s infinite; }
	@keyframes swing { 0%, 100% { transform: rotate(0); } 10% { transform: rotate(5deg); } 25% { transform: rotate(-3deg); } 40% { transform: rotate(1.5deg); } 55% { transform: rotate(0); } }
	.log { transform-box: view-box; transform-origin: 364px 446px; animation: strike 3s ease-in-out 1.6s infinite; }
	@keyframes strike { 0%, 100% { transform: translateX(0); } 6% { transform: translateX(-46px); } 12% { transform: translateX(0); } }
	.ripple circle { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ripple 3s ease-out 1.8s infinite; }
	.ripple .r2 { animation-delay: 2.1s; }
	.ripple .r3 { animation-delay: 2.4s; }
	@keyframes ripple { 0% { opacity: 0.8; transform: scale(0.6); } 60% { opacity: 0; transform: scale(2.4); } 100% { opacity: 0; transform: scale(2.4); } }
	.soba { animation: popup 0.9s cubic-bezier(0.2, 1.4, 0.3, 1) 0.9s both, bob 3.2s ease-in-out 1.8s infinite; }
	@keyframes bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
	.kado { transform-box: fill-box; transform-origin: 50% 100%; animation: popup 0.9s cubic-bezier(0.2, 1.4, 0.3, 1) 1.1s both, sway 4.5s ease-in-out 2s infinite; }
	@keyframes sway { 0%, 100% { rotate: 0deg; } 50% { rotate: 1.6deg; } }
	@keyframes popup { from { transform: translateY(80px); opacity: 0; } to { transform: none; opacity: 1; } }
	.steam { stroke-dasharray: 80; animation: steam 2.4s ease-in-out infinite; }
	.steam.s2 { animation-delay: -0.8s; }
	.steam.s3 { animation-delay: -1.6s; }
	@keyframes steam { 0% { stroke-dashoffset: 80; opacity: 0; transform: translateY(10px); } 40% { opacity: 0.8; } 100% { stroke-dashoffset: 0; opacity: 0; transform: translateY(-24px); } }
	.plum circle { transform-box: fill-box; transform-origin: center; animation: plum 2.4s ease-in-out infinite; }
	@keyframes plum { 50% { transform: scale(1.3); } }

	/* ───── 一時停止（スペースキー） ───── */
	.paused :is(.in1, .in2, .in3, .in4, .flip, .paper, .cf, .vbar, .vnum, .crown, .toplead, .later, .later2, .flipin, .thump, .rays, .beams span, .rain span, .shock, .fwi),
	.paused .bigmosaic::after,
	.paused .ringed::before,
	.paused .ringed::after,
	.paused .ny * {
		animation-play-state: paused !important;
	}

	@media (max-width: 640px) {
		.bigmosaic { grid-template-columns: repeat(5, 46px); gap: 6px; }
		.mt { width: 46px; height: 46px; }
		.vtrack { height: 240px; }
		.vbar { height: calc(var(--h) * 1.6px); }
		.shock { bottom: calc(var(--h) * 1.6px + 70px); }
		.vlabel { font-size: 12px; white-space: normal; }
	}
	@media (prefers-reduced-motion: reduce) {
		.in1, .in2, .in3, .in4 { animation-duration: 0.01s !important; animation-delay: 0s !important; }
		.flake { display: none; }
	}
</style>
