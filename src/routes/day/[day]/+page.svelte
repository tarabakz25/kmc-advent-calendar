<script lang="ts">
	import { enhance } from '$app/forms';
	import { DAYS, GENRES, genreOf, platformOf, TITLE_MAX, weekdayOf } from '#lib/calendar.ts';
	import { colorOf, pad, STATUS_LABEL, statusOf, weekdayEn } from '#lib/design.ts';
	import type { PageProps } from './$types';

	// カレンダーではモーダルで開くが、直接リンクや JS なしのときはこのページで予約・編集する。
	let { data, form }: PageProps = $props();

	let submitting = $state(false);

	const entry = $derived(data.entry);
	const heading = $derived(`12月${data.day}日（${weekdayOf(data.day)}）`);
	const loginHref = $derived(`/login?redirectTo=${encodeURIComponent(`/day/${data.day}`)}`);
	const genre = $derived(genreOf(entry?.genre));

	// 失敗したときは入力途中の値を残す。
	const titleValue = $derived(form && 'title' in form ? form.title : (entry?.title ?? ''));
	const urlValue = $derived(form && 'url' in form ? form.url : (entry?.url ?? ''));
	// svelte-ignore state_referenced_locally
	let genreValue = $state(form && 'genre' in form ? String(form.genre) : (data.entry?.genre ?? ''));
</script>

<svelte:head>
	<title>{heading} | KMC Advent Calendar {data.year}</title>
</svelte:head>

<div class="wrap pagein">
	<a href="/calendar" class="backlink">← カレンダーに戻る</a>

	<div class="dtile c-{colorOf(data.day)}">
		<span class="flex items-start justify-between gap-3">
			<span class="dnum">{pad(data.day)}</span>
			<span class="flex flex-col items-end gap-2.5 pt-1.5">
				<span class="font-display text-xs font-bold tracking-[.12em] opacity-80">{data.year}.12.{pad(data.day)} {weekdayEn(data.day)}（{weekdayOf(data.day)}）</span>
				<span class="dstatus">{STATUS_LABEL[statusOf(entry ?? undefined, data.today)]}</span>
			</span>
		</span>
		{#if entry && !entry.mine}
			<span class="flex flex-col gap-2.5">
				{#if genre}<span class="gchip" style="--g: {genre.color}">{genre.label}</span>{/if}
				<span class="font-display text-[17px] font-bold">{entry.author}</span>
				<h1 class="m-0 text-[28px] leading-snug font-black">{entry.title}</h1>
				{#if entry.url && !data.isFuture}
					<a href={entry.url} target="_blank" rel="noopener noreferrer" class="btn dyes mt-2.5 self-start">{platformOf(entry.url)} で読む ↗</a>
				{:else}
					<span class="text-sm font-bold opacity-80">{data.isFuture ? '公開日をお楽しみに。' : 'いま執筆中です。もう少しお待ちください。'}</span>
				{/if}
			</span>
		{:else}
			<h1 class="m-0 text-[28px] leading-snug font-black">{heading}</h1>
		{/if}
	</div>

	{#if !entry && !data.loggedIn}
		<div class="card">
			<h2 class="m-0 text-xl font-black text-pine">この日はまだ空いています</h2>
			<p class="m-0 text-sm leading-relaxed text-muted">学校の Google アカウントでログインすると、この日を予約できます。</p>
			<a href={loginHref} class="btn btn-main self-start">ログインして予約する</a>
		</div>
	{:else if !entry || entry.mine}
		<form
			method="POST"
			action="?/save"
			class="card"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<div class="flex flex-col gap-1.5">
				<h2 class="m-0 text-xl font-black text-pine">{entry ? 'あなたの記事' : 'この日を予約する'}</h2>
				<span class="hint">記事は好きなサイトで書いて、URLをここに登録してください。URLは書き終わってからでも大丈夫です。</span>
			</div>
			<div class="field">
				<label for="d-title">記事タイトル（仮でもOK）</label>
				<input id="d-title" name="title" required maxlength={TITLE_MAX} value={titleValue} placeholder="例: はじめてのRustで作る自作OS" />
			</div>
			<div class="field" role="radiogroup" aria-labelledby="d-genre-l">
				<span id="d-genre-l" class="field-label">ジャンル</span>
				<input type="hidden" name="genre" value={genreValue} />
				<div class="flex flex-wrap gap-2">
					{#each GENRES as g (g.key)}
						<button
							type="button"
							class="gopt"
							role="radio"
							aria-checked={genreValue === g.key}
							style="--g: {g.color}"
							onclick={() => (genreValue = genreValue === g.key ? '' : g.key)}>{g.label}</button
						>
					{/each}
				</div>
			</div>
			<div class="field">
				<label for="d-url">記事URL（任意）</label>
				<input id="d-url" name="url" type="url" inputmode="url" value={urlValue} placeholder="https://zenn.dev/..." />
				<span class="hint">Qiita / Zenn / note / はてなブログ / GitHub など。公開日になると、カレンダーからこのURLに飛べます。</span>
			</div>

			{#if form?.message}
				<p role="alert" class="err m-0">{form.message}</p>
			{:else if form && 'saved' in form && form.saved}
				<p role="status" class="m-0 text-sm font-bold text-pine">保存しました。</p>
			{/if}

			<div class="flex flex-wrap items-center gap-2.5">
				<button class="btn btn-main" disabled={submitting}>{entry ? '更新する' : '予約する'}</button>
				{#if entry}
					<button
						class="btn btn-warn ml-auto"
						formaction="?/cancel"
						formnovalidate
						onclick={(e) => {
							if (!confirm('予約を取り消しますか？')) e.preventDefault();
						}}>この枠を空ける</button
					>
				{/if}
			</div>
		</form>
	{/if}

	<nav class="flex justify-between text-sm font-bold">
		{#if data.day > 1}<a href="/day/{data.day - 1}">← {data.day - 1}日</a>{:else}<span></span>{/if}
		{#if data.day < DAYS}<a href="/day/{data.day + 1}">{data.day + 1}日 →</a>{/if}
	</nav>
</div>

<style>
	.wrap {
		max-width: 640px;
		margin: 0 auto;
		padding: 32px 20px 64px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.backlink {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		color: var(--color-muted);
		text-decoration: none;
		align-self: flex-start;
	}
	.backlink:hover {
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.dtile {
		border-radius: 14px;
		min-height: 260px;
		padding: 30px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 26px;
		box-shadow: 0 30px 50px -34px rgb(15 59 58 / 0.6);
	}
	.dnum {
		font-family: var(--font-display);
		font-size: 110px;
		font-weight: 700;
		line-height: 0.82;
		letter-spacing: -0.05em;
	}
	.dstatus {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 5px 11px;
		border-radius: 99px;
		background: rgb(255 255 255 / 0.88);
		color: var(--color-ink);
	}
	.dyes {
		border-radius: 99px;
		background: var(--color-ink);
		color: var(--color-cream);
	}
	.dyes:hover {
		background: #000;
		color: var(--color-cream);
	}
	.card {
		background: #fff;
		border-radius: 10px;
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
</style>
