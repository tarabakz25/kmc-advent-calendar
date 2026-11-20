<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import CalTabs from '#lib/components/CalTabs.svelte';
	import { CAL_LIST, CALENDARS, calName, DAYS, GENRES, genreOf, TITLE_MAX, validateEntry, weekdayOf, withCal } from '#lib/calendar.ts';
	import { colorOf, pad, weekdayEn } from '#lib/design.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// 1: 日付 → 2: 記事の情報 → 3: 確認（URLありのとき）→ 4: 完了
	// svelte-ignore state_referenced_locally
	let step = $state<1 | 2 | 3 | 4>(data.day ? 2 : 1);
	// svelte-ignore state_referenced_locally
	let day = $state<number | null>(data.day);
	// svelte-ignore state_referenced_locally
	let cal = $state(data.cal);
	let draft = $state({ title: '', url: '', genre: '' });
	let err = $state('');
	let busy = $state(false);
	let reserved = $state(false);
	let form = $state<HTMLFormElement>();

	const days = Array.from({ length: DAYS }, (_, i) => i + 1);
	const LABELS = ['日付を選ぶ', '記事の情報', '投稿'];
	const multi = CALENDARS > 1;
	const dateLabel = $derived(
		day ? `${multi ? `${calName(cal)} の ` : ''}${data.year}年12月${day}日（${weekdayOf(day)}）` : ''
	);
	const g = $derived(genreOf(draft.genre));
	/** 開発用の `?today=` などだけを引き継ぐ（日付とカレンダーの指定は外す）。 */
	const q = $derived.by(() => {
		const params = new URLSearchParams(page.url.search);
		params.delete('day');
		params.delete('cal');
		const qs = params.toString();
		return qs ? `?${qs}` : '';
	});
	const taken = $derived(data.taken[cal] ?? {});
	const filled = $derived(
		Object.fromEntries(CAL_LIST.map((c) => [c, Object.keys(data.taken[c] ?? {}).length])) as Record<number, number>
	);

	function pickCal(c: number) {
		if (c === cal) return;
		cal = c;
		day = null;
		err = '';
	}

	function pick(d: number) {
		day = d;
		err = '';
		step = 2;
	}

	/** 入力を確かめて、URLがあれば確認画面へ、なければそのまま予約する。 */
	function next(e: SubmitEvent) {
		e.preventDefault();
		const input = validateEntry(draft.title, draft.url, draft.genre);
		if (!input.ok) {
			err = input.message;
			return;
		}
		err = '';
		if (input.url) step = 3;
		else form?.requestSubmit();
	}

	function restart() {
		day = null;
		draft = { title: '', url: '', genre: '' };
		step = 1;
	}
</script>

<svelte:head>
	<title>参加登録 | KMC Advent Calendar {data.year}</title>
</svelte:head>

<!-- 実際に送るフォーム。各ステップの入力をまとめて送る。 -->
<form
	method="POST"
	bind:this={form}
	hidden
	use:enhance={() => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				reserved = Boolean(result.data?.reserved);
				step = 4;
				await update({ reset: false });
			} else if (result.type === 'failure') {
				err = String(result.data?.message ?? '登録できませんでした。');
				// 他の人に先を越されたときは、日付を選び直してもらう。
				if (result.status === 409) step = 1;
				else step = 2;
				await update({ reset: false });
			} else {
				await update();
			}
		};
	}}
>
	<input type="hidden" name="cal" value={cal} />
	<input type="hidden" name="day" value={day ?? ''} />
	<input type="hidden" name="title" value={draft.title} />
	<input type="hidden" name="url" value={draft.url} />
	<input type="hidden" name="genre" value={draft.genre} />
</form>

<div class="wrap pagein">
	{#if step !== 4}
		<div class="flex flex-col gap-7">
			<div class="flex flex-col gap-2.5">
				<span class="kick">JOIN THE CALENDAR</span>
				<h1 class="m-0 text-[44px] leading-tight font-black text-pine">参加登録</h1>
			</div>

			<ol aria-label="登録の手順" class="steps">
				{#each LABELS as label, i (label)}
					{@const n = i + 1}
					<li class="step" class:step-on={step === n} class:step-done={step > n} aria-current={step === n ? 'step' : undefined}>
						<span class="step-dot">{step > n ? '✓' : n}</span>{label}
					</li>
					{#if n < 3}<li class="bar" aria-hidden="true"></li>{/if}
				{/each}
			</ol>

			{#if step === 1}
				<div class="card fadein">
					<div class="flex flex-col gap-1.5">
						<h2 class="m-0 text-[22px] font-black text-pine">書く日を選んでください</h2>
						<span class="hint">斜線の日はすでに埋まっています。空いている日を選ぶと、そのまま次に進みます。</span>
					</div>
					{#if multi}
						<div class="flex flex-col gap-2">
							<CalTabs {filled} cur={cal} onpick={pickCal} label="書くカレンダー" />
							{#if filled[cal] >= DAYS}
								<span class="hint">{calName(cal)} はすべて埋まっています。ほかのカレンダーなら同じ日付で参加できます。</span>
							{/if}
						</div>
					{/if}
					{#if err}<p role="alert" class="err m-0">{err}</p>{/if}
					<div class="pick" role="radiogroup" aria-label="日付">
						{#each days as d (d)}
							{@const who = taken[d]}
							<button
								class="slot"
								class:slot-sel={day === d}
								onclick={() => pick(d)}
								disabled={Boolean(who)}
								role="radio"
								aria-checked={day === d}
								aria-label="{multi ? `${calName(cal)} ` : ''}12月{d}日{who ? ` 登録済み ${who}` : ' 空き'}"
							>
								<span class="slot-num">{pad(d)}</span>
								<span class="slot-sub">{who ?? (day === d ? '選択中' : weekdayEn(d))}</span>
							</button>
						{/each}
					</div>
				</div>
			{:else if step === 2}
				<form class="card fadein" onsubmit={next} novalidate>
					<div class="flex flex-col gap-1.5">
						<h2 class="m-0 text-[22px] font-black text-pine">記事のことを教えてください</h2>
						<span class="hint">{dateLabel} を担当します。記事URLを入れると「投稿」、空欄のままなら「予約」として登録されます。</span>
					</div>
					<div class="field">
						<span class="field-label">名前</span>
						<span class="name">{data.name}</span>
						<span class="hint">カレンダーには Google アカウントの名前で表示されます。</span>
					</div>
					<div class="field">
						<label for="j-title">記事タイトル *</label>
						<input id="j-title" bind:value={draft.title} maxlength={TITLE_MAX} placeholder="例: 〇〇を作ってみた" autocomplete="off" />
						<span class="hint">仮タイトルでも大丈夫です。あとから変更できます。</span>
					</div>
					<div class="field" role="radiogroup" aria-labelledby="j-genre-l">
						<span id="j-genre-l" class="field-label">ジャンル</span>
						<div class="flex flex-wrap gap-2">
							{#each GENRES as opt (opt.key)}
								<button
									type="button"
									class="gopt"
									role="radio"
									aria-checked={draft.genre === opt.key}
									style="--g: {opt.color}"
									onclick={() => (draft.genre = draft.genre === opt.key ? '' : opt.key)}>{opt.label}</button
								>
							{/each}
						</div>
						<span class="hint">記事一覧ページで、ジャンルごとに絞り込んで読めるようになります。</span>
					</div>
					<div class="field">
						<label for="j-url">記事URL（任意）</label>
						<input id="j-url" type="url" inputmode="url" bind:value={draft.url} placeholder="https://" autocomplete="off" />
						<span class="hint">公開前なら空欄でOK。あとでカレンダーからURLを足すと投稿済みになります。</span>
					</div>
					{#if err}<p role="alert" class="err m-0">{err}</p>{/if}
					<div class="flex flex-wrap justify-between gap-3">
						<button class="btn btn-ghost" type="button" onclick={() => ((step = 1), (err = ''))}>← 日付を選び直す</button>
						<button class="btn btn-main" disabled={busy}>{draft.url.trim() ? '次へ：投稿の確認 →' : 'リンクなしで予約する'}</button>
					</div>
				</form>
			{:else if step === 3 && day}
				<div class="fadein flex flex-col items-center gap-10 pt-2 pb-6">
					<div class="stage">
						<button class="back-ic" onclick={() => (step = 2)} aria-label="入力に戻って修正する">
							<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4L6 9l5 5"></path></svg>
						</button>
						<div class="pv-big c-{colorOf(day, cal)}">
							<span class="flex items-start justify-between">
								<span class="pv-num">{pad(day)}</span>
								<span class="pv-wd">{weekdayEn(day)}</span>
							</span>
							<span class="flex flex-col gap-2">
								{#if g}<span class="gchip" style="--g: {g.color}">{g.label}</span>{/if}
								<span class="font-display text-lg font-bold">{data.name}</span>
								<span class="pv-title">{draft.title}</span>
							</span>
						</div>
					</div>
					{#if err}<p role="alert" class="err m-0">{err}</p>{/if}
					<h2 class="ready">Ready</h2>
					<button class="btn btn-main btn-post" disabled={busy} onclick={() => form?.requestSubmit()}>投稿する</button>
				</div>
			{/if}

			{#if step !== 3}
				<aside aria-label="参加のきまり" class="rules">
					<span class="rs-h">参加のきまり</span>
					<span class="rs-i">テーマは自由。技術でも、日常でも</span>
					<span class="rs-i">記事はどこに書いてもOK（ブログ、Qiita、Zenn、note など）</span>
					<span class="rs-i">書けなくなったら早めに運営へ連絡を</span>
				</aside>
			{/if}
		</div>
	{:else if day}
		<section class="fadein done">
			<div class="done-tile c-{colorOf(day, cal)}">
				<span class="font-display text-7xl leading-none font-bold">{pad(day)}</span>
				<span class="flex flex-col gap-1">
					<span class="font-display text-sm font-bold">{data.name}</span>
					<span class="text-[17px] leading-snug font-bold">{draft.title}</span>
				</span>
			</div>
			<div class="flex flex-col gap-2.5">
				<span class="kick">{reserved ? 'RESERVED' : 'POSTED!'}</span>
				<h1 class="m-0 text-[40px] leading-snug font-black text-pine">DAY {pad(day)} {reserved ? 'を予約しました' : 'に投稿しました'}</h1>
				<p class="m-0 max-w-[520px] text-[15px] leading-loose text-[#3D3830]">
					{#if reserved}
						{dateLabel} があなたの担当日です。記事を公開したら、カレンダーのこの日からURLを追加してください。
					{:else}
						{dateLabel} のカレンダーに、あなたの記事が載りました。
					{/if}
				</p>
			</div>
			<div class="flex flex-wrap justify-center gap-2.5">
				<a class="btn btn-main" href={withCal('/calendar', cal, q)}>カレンダーで見る</a>
				<button class="btn underline underline-offset-4" style="background: transparent; color: var(--color-pine)" onclick={restart}>もう1日登録する</button>
			</div>
		</section>
	{/if}

	<footer class="site-footer">
		<a href="/calendar{q}">← カレンダーに戻る</a>
		<span class="font-display font-bold tracking-[.1em]">#KAMIYAMA_ADVENT_{data.year}</span>
	</footer>
</div>

<style>
	.wrap {
		max-width: 1200px;
		margin: 0 auto;
		padding: 40px 24px 64px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}
	.kick {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: var(--color-muted);
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		font-weight: 700;
		color: #8a8274;
	}
	.step-dot {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: 14px;
		box-shadow: inset 0 0 0 1.5px #b9b1a3;
		transition:
			background 0.3s,
			color 0.3s;
	}
	.step-on,
	.step-done {
		color: var(--color-pine);
	}
	.step-on .step-dot {
		background: var(--color-pine);
		color: var(--color-cream);
		box-shadow: none;
	}
	.step-done .step-dot {
		background: var(--color-mint);
		color: var(--color-pine);
		box-shadow: none;
	}
	.bar {
		flex: 1 1 24px;
		height: 2px;
		background: var(--color-line);
		min-width: 16px;
	}
	.card {
		background: #fff;
		border-radius: 4px;
		padding: 32px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	@media (max-width: 560px) {
		.card {
			padding: 22px;
		}
	}
	.name {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 700;
		min-height: 50px;
		display: flex;
		align-items: center;
		padding: 0 16px;
		border-radius: 4px;
		background: var(--color-cream);
		color: var(--color-ink);
	}
	.pick {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
	}
	@media (max-width: 560px) {
		.pick {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	.slot {
		min-height: 84px;
		border: 0;
		border-radius: 4px;
		padding: 10px 12px;
		font: inherit;
		text-align: left;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		background: #fff;
		color: var(--color-pine);
		box-shadow: inset 0 0 0 1.5px var(--color-line);
		transition:
			transform 0.2s,
			box-shadow 0.2s,
			background 0.2s;
	}
	.slot:hover {
		transform: translateY(-3px);
		box-shadow: inset 0 0 0 1.5px var(--color-pine);
	}
	.slot-num {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 700;
		line-height: 1;
	}
	.slot-sub {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.slot:disabled {
		cursor: not-allowed;
		transform: none;
		background: repeating-linear-gradient(135deg, #ece6dc 0 6px, #e4ddd1 6px 12px);
		color: #8a8274;
		box-shadow: none;
	}
	.slot-sel,
	.slot-sel:hover {
		background: var(--color-pine);
		color: var(--color-cream);
		box-shadow:
			0 0 0 3px var(--color-cream),
			0 0 0 5px var(--color-pine);
	}

	.stage {
		position: relative;
		width: min(600px, 100%);
	}
	.pv-big {
		min-height: 400px;
		padding: 40px;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 24px;
		box-shadow: 0 44px 80px -44px rgb(15 59 58 / 0.65);
		animation: pvpop 0.6s cubic-bezier(0.2, 1.3, 0.3, 1);
	}
	.pv-num {
		font-family: var(--font-display);
		font-size: 128px;
		font-weight: 700;
		line-height: 0.85;
		letter-spacing: -0.04em;
	}
	.pv-wd {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.14em;
		opacity: 0.75;
		padding-top: 8px;
	}
	.pv-title {
		font-size: 32px;
		line-height: 1.35;
		font-weight: 900;
		overflow-wrap: anywhere;
	}
	@keyframes pvpop {
		from {
			opacity: 0;
			transform: translateY(16px) rotate(-2deg) scale(0.95);
		}
	}
	.back-ic {
		position: absolute;
		left: -60px;
		top: 0;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1.5px solid var(--color-pine);
		background: transparent;
		color: var(--color-pine);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.back-ic:hover {
		background: var(--color-pine);
		color: var(--color-cream);
	}
	@media (max-width: 820px) {
		.back-ic {
			left: 0;
		}
		.stage {
			padding-top: 56px;
		}
	}
	.ready {
		margin: 0;
		font-family: var(--font-display);
		font-size: 80px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--color-pine);
		animation: pvpop 0.7s cubic-bezier(0.2, 1.3, 0.3, 1) 0.15s both;
	}
	.btn-post {
		min-height: 60px;
		padding: 0 56px;
		font-size: 17px;
		border-radius: 99px;
		box-shadow: 0 16px 30px -16px rgb(15 59 58 / 0.7);
	}
	.btn-post:hover {
		transform: translateY(-2px);
	}
	.rules {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 22px;
		font-size: 13px;
		line-height: 1.7;
		color: #3d3830;
	}
	.rs-h {
		font-weight: 700;
		color: var(--color-pine);
		padding: 2px 10px;
		border-radius: 99px;
		box-shadow: inset 0 0 0 1.5px var(--color-pine);
		font-size: 12px;
	}
	.rs-i::before {
		content: '・';
	}
	.done {
		min-height: 640px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 28px;
		text-align: center;
		padding: 40px 0;
	}
	.done-tile {
		width: 220px;
		height: 220px;
		border-radius: 6px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		text-align: left;
		animation: drop 0.8s cubic-bezier(0.2, 1.4, 0.3, 1);
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-60px) rotate(-8deg) scale(0.8);
		}
	}
</style>
