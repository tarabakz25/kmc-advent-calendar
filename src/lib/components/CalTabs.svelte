<script lang="ts">
	import { CAL_LIST, CALENDARS, calName, DAYS } from '#lib/calendar.ts';

	/**
	 * カレンダーの切り替えタブ。各カレンダーの埋まり具合（メーター・n / 25・FULL）と全体の枠数を出す。
	 * トップ・カレンダーページ・参加登録で使う。
	 */
	let {
		filled,
		cur,
		onpick,
		label = 'カレンダー'
	}: {
		/** カレンダー番号 → 埋まっている枠の数。 */
		filled: Record<number, number>;
		cur: number;
		onpick: (cal: number) => void;
		label?: string;
	} = $props();

	const total = $derived(CAL_LIST.reduce((sum, c) => sum + (filled[c] ?? 0), 0));
</script>

<div class="ctabs" role="tablist" aria-label={label}>
	{#each CAL_LIST as c (c)}
		{@const n = filled[c] ?? 0}
		<button
			type="button"
			class="ctab"
			class:ctab-on={c === cur}
			role="tab"
			aria-selected={c === cur}
			aria-label="{calName(c)}（{n} / {DAYS} 枠）"
			onclick={() => onpick(c)}
		>
			<span class="ctab-name">{calName(c)}</span>
			<span class="ctab-meter" aria-hidden="true"><span style="width: {Math.round((n / DAYS) * 100)}%"></span></span>
			<span class="ctab-n" aria-hidden="true">{n}<span> / {DAYS}</span></span>
			{#if n >= DAYS}<span class="ctab-full" aria-hidden="true">FULL</span>{/if}
		</button>
	{/each}
	<span class="ctotal">全体<b>{total}</b><span>/ {CALENDARS * DAYS}</span>枠</span>
</div>

<style>
	.ctabs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.ctab {
		font: inherit;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 14px 0 16px;
		border-radius: 99px;
		border: 0;
		background: #fff;
		color: var(--color-pine);
		box-shadow: inset 0 0 0 1.5px var(--color-line);
		cursor: pointer;
		transition:
			background 0.2s,
			box-shadow 0.2s,
			transform 0.15s,
			color 0.2s;
	}
	.ctab:hover {
		box-shadow: inset 0 0 0 1.5px var(--color-pine);
		transform: translateY(-1px);
	}
	.ctab-on,
	.ctab-on:hover {
		background: var(--color-pine);
		color: var(--color-cream);
		box-shadow: 0 10px 20px -12px rgb(15 59 58 / 0.7);
	}
	.ctab-name {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
	}
	.ctab-meter {
		width: 48px;
		height: 6px;
		border-radius: 99px;
		background: rgb(15 59 58 / 0.14);
		overflow: hidden;
		flex: none;
	}
	.ctab-on .ctab-meter {
		background: rgb(243 238 230 / 0.22);
	}
	.ctab-meter > span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: var(--accent);
		transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.ctab-n {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
	}
	.ctab-n > span {
		opacity: 0.65;
		font-weight: 500;
	}
	.ctab-full {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		padding: 3px 7px;
		border-radius: 99px;
		background: var(--accent);
		color: #1b1b1b;
	}
	.ctotal {
		margin-left: auto;
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-muted);
		white-space: nowrap;
	}
	.ctotal b {
		font-family: var(--font-display);
		font-size: 20px;
		color: var(--color-pine);
	}
	.ctotal span {
		font-family: var(--font-display);
		font-size: 14px;
	}
	@media (min-width: 901px) and (min-height: 620px) {
		:global(.calfit) .ctab {
			min-height: 40px;
		}
	}
</style>
