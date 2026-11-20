<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { CALENDAR_YEAR, CALENDARS, calName, GENRES, genreOf, isLocked, isPostPath, TITLE_MAX, weekdayOf, withCal, type PublicEntry } from '#lib/calendar.ts';
	import { colorOf, colorValues, pad, STATUS_LABEL, statusOf, weekdayEn } from '#lib/design.ts';
	import Avatar from './Avatar.svelte';

	let {
		cal = 1,
		day,
		entry,
		today,
		onclose
	}: { cal?: number; day: number; entry: PublicEntry | undefined; today: string; onclose: () => void } = $props();

	let closing = $state(false);
	let editing = $state(false);
	let busy = $state(false);
	let err = $state('');
	let draft = $state({ title: '', url: '', genre: '' });
	let closeBtn = $state<HTMLButtonElement>();

	const colors = $derived(colorValues(colorOf(day, cal)));
	const status = $derived(statusOf(entry, today));
	const genre = $derived(genreOf(entry?.genre));
	// 公開日までは、本人の記事でもリンクにしない。
	const locked = $derived(isLocked(day, today));
	const readable = $derived(!locked && !!entry?.url);
	const calPre = $derived(CALENDARS > 1 ? `CAL ${cal} · ` : '');
	const dateLabel = $derived(`${calPre}${CALENDAR_YEAR}.12.${pad(day)} ${weekdayEn(day)}（${weekdayOf(day)}）`);
	const joinHref = $derived.by(() => {
		const params = new URLSearchParams(page.url.search);
		params.set('day', String(day));
		params.set('cal', String(cal));
		return `/join?${params}`;
	});
	/** 保存・取り消しの送信先。`?/save` のあとに `&cal=2` を付ける。 */
	const action = (name: string) => `/day/${day}?/${name}${cal === 1 ? '' : `&cal=${cal}`}`;

	$effect(() => {
		closeBtn?.focus();
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});

	function close() {
		if (closing) return;
		closing = true;
		setTimeout(onclose, 260);
	}

	function startEdit() {
		draft = { title: entry?.title ?? '', url: entry?.url ?? '', genre: entry?.genre ?? '' };
		err = '';
		editing = true;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window {onkeydown} />

<button class="scrim" class:out={closing} onclick={close} aria-label="閉じる" tabindex="-1"></button>
<div class="sheet" class:out={closing} role="dialog" aria-modal="true" aria-label="{CALENDARS > 1 ? `${calName(cal)} ` : ''}12月{day}日の枠">
	<button class="mclose" bind:this={closeBtn} onclick={close} aria-label="閉じる">
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"
			><path d="M4 4l10 10M14 4L4 14"></path></svg
		>
	</button>

	<div class="mtile" style="background: {colors.bg}; color: {colors.fg}">
		<span class="flex items-start justify-between gap-3">
			<span class="mt-num">{pad(day)}</span>
			<span class="flex flex-col items-end gap-2.5 pt-1.5">
				<span class="mt-date">{dateLabel}</span>
				<span class="mt-status">{STATUS_LABEL[status]}</span>
			</span>
		</span>

		{#if entry}
			<span class="flex flex-col gap-2.5">
				{#if genre}<span class="gchip" style="--g: {genre.color}">{genre.label}</span>{/if}
				<span class="flex items-center gap-2.5">
					<Avatar name={entry.author} image={entry.image} class="uav uav-lg" plain />
					<span class="mt-name">{entry.author}</span>
				</span>
				{#if readable}
					<a class="mt-title" href={entry.url} target={isPostPath(entry.url) ? undefined : '_blank'} rel="noopener noreferrer">{entry.title}</a>
				{:else}
					<span class="mt-title">{entry.title}</span>
				{/if}
				<span class="mt-2.5 flex flex-wrap gap-2.5">
					{#if readable}
						<a class="btn mt-yes" href={entry.url} target={isPostPath(entry.url) ? undefined : '_blank'} rel="noopener noreferrer"
							>記事を読む<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"
								><path d="M5 11L11 5M6 5h5v5"></path></svg
							></a
						>
					{:else if !entry.mine}
						<span class="mt-note">{locked ? '公開日をお楽しみに。' : 'いま執筆中です。もう少しお待ちください。'}</span>
					{/if}
					{#if entry.mine && !editing}
						<button class="btn mt-no" onclick={startEdit}>編集する</button>
						<a class="btn mt-no" href={withCal(`/write/${day}`, cal, page.url.search)}>エディタで書く</a>
					{/if}
				</span>
			</span>
		{:else}
			<span class="flex flex-col gap-2">
				<span class="mt-title">予約がありません。</span>
				<span class="mt-name" style="opacity: .85">DAY {pad(day)} に JOIN しますか？</span>
				<span class="mt-2.5 flex flex-wrap gap-2.5">
					<a class="btn mt-yes" href={joinHref}>はい</a>
					<button class="btn mt-no" onclick={close}>いいえ</button>
				</span>
			</span>
		{/if}
	</div>

	{#if editing && entry?.mine}
		<form
			method="POST"
			action={action('save')}
			class="mbody fadein"
			use:enhance={() => {
				busy = true;
				return async ({ result }) => {
					busy = false;
					if (result.type === 'success') {
						await invalidateAll();
						editing = false;
					} else if (result.type === 'redirect') {
						await invalidateAll();
						close();
					} else if (result.type === 'failure') {
						err = String(result.data?.message ?? '保存できませんでした。');
					} else {
						err = '保存できませんでした。時間をおいてもう一度お試しください。';
					}
				};
			}}
		>
			<div class="field">
				<label for="m-title">記事タイトル</label>
				<input id="m-title" name="title" required maxlength={TITLE_MAX} bind:value={draft.title} placeholder="例: 〇〇を作ってみた" autocomplete="off" />
			</div>
			<div class="field" role="radiogroup" aria-labelledby="m-genre-l">
				<span id="m-genre-l" class="field-label">ジャンル</span>
				<input type="hidden" name="genre" value={draft.genre} />
				<div class="flex flex-wrap gap-1.5">
					{#each GENRES as g (g.key)}
						<button
							type="button"
							class="gopt"
							role="radio"
							aria-checked={draft.genre === g.key}
							style="--g: {g.color}"
							onclick={() => (draft.genre = draft.genre === g.key ? '' : g.key)}>{g.label}</button
						>
					{/each}
				</div>
			</div>
			<div class="field">
				<label for="m-url">記事URL</label>
				<input id="m-url" name="url" type="url" inputmode="url" bind:value={draft.url} placeholder="https://" autocomplete="off" />
				<span class="hint">公開日になると、カレンダーからこのURLに飛べます。</span>
			</div>
			{#if err}<p role="alert" class="err">{err}</p>{/if}
			<div class="flex flex-wrap items-center gap-2.5">
				<button class="btn btn-main" disabled={busy}>保存する</button>
				<button class="btn btn-ghost" type="button" onclick={() => (editing = false)}>キャンセル</button>
				<button
					class="btn btn-warn ml-auto"
					formaction={action('cancel')}
					formnovalidate
					disabled={busy}
					onclick={(e) => {
						if (!confirm('この枠を空けますか？')) e.preventDefault();
					}}>この枠を空ける</button
				>
			</div>
		</form>
	{/if}
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 1000;
		border: 0;
		background: rgb(15 30 29 / 0.55);
		cursor: pointer;
		animation: fade 0.25s ease-out;
	}
	.sheet {
		position: fixed;
		z-index: 1001;
		left: 50%;
		top: 50%;
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		transform: translate(-50%, -50%);
		animation: pop 0.38s cubic-bezier(0.2, 0.9, 0.25, 1.2);
	}
	.scrim.out {
		animation: fadeout 0.26s ease-in forwards;
		pointer-events: none;
	}
	.sheet.out {
		animation: popout 0.26s cubic-bezier(0.4, 0, 0.8, 0.4) forwards;
		pointer-events: none;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes fadeout {
		to {
			opacity: 0;
		}
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translate(-50%, -44%) scale(0.94);
		}
	}
	@keyframes popout {
		to {
			opacity: 0;
			transform: translate(-50%, -46%) scale(0.94);
		}
	}
	.mtile {
		border-radius: 14px;
		min-height: 300px;
		padding: 30px 30px 28px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 26px;
		box-shadow: 0 40px 70px -30px rgb(0 0 0 / 0.6);
	}
	.mt-num {
		font-family: var(--font-display);
		font-size: 120px;
		font-weight: 700;
		line-height: 0.82;
		letter-spacing: -0.05em;
	}
	.mt-date {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		opacity: 0.8;
		text-align: right;
	}
	.mt-status {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 5px 11px;
		border-radius: 99px;
		background: rgb(255 255 255 / 0.88);
		color: var(--color-ink);
	}
	.mt-name {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 700;
	}
	.mt-title {
		font-size: 28px;
		line-height: 1.35;
		font-weight: 900;
		color: inherit;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a.mt-title:hover {
		color: inherit;
		opacity: 0.8;
	}
	.mt-note {
		font-size: 14px;
		font-weight: 700;
		opacity: 0.8;
		align-self: center;
	}
	.mt-yes {
		min-width: 120px;
		border-radius: 99px;
		background: var(--color-ink);
		color: var(--color-cream);
	}
	.mt-yes:hover {
		background: #000;
		color: var(--color-cream);
		transform: translateY(-2px);
	}
	.mt-no {
		min-width: 120px;
		border-radius: 99px;
		background: transparent;
		color: inherit;
		box-shadow: inset 0 0 0 1.5px currentColor;
	}
	.mt-no:hover {
		background: rgb(255 255 255 / 0.18);
	}
	.mbody {
		margin-top: 10px;
		padding: 26px 28px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		background: var(--color-cream);
		border-radius: 14px;
		box-shadow: 0 30px 50px -30px rgb(0 0 0 / 0.5);
		max-height: calc(100dvh - 400px);
		overflow: auto;
	}
	.mclose {
		position: absolute;
		top: -50px;
		right: -50px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 0;
		padding: 0;
		background: var(--color-cream);
		color: var(--color-pine);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 10px 24px -10px rgb(0 0 0 / 0.5);
		transition:
			transform 0.2s,
			background 0.2s,
			color 0.2s;
	}
	.mclose:hover {
		background: var(--color-pine);
		color: var(--color-cream);
		transform: rotate(90deg);
	}
	@media (max-width: 680px) {
		.mclose {
			top: -56px;
			right: 0;
		}
	}
	@media (max-width: 560px) {
		.mt-num {
			font-size: 88px;
		}
		.mt-title {
			font-size: 22px;
		}
	}
</style>
