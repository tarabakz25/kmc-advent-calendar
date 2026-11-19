<script lang="ts">
	import { STATUS_LABEL, type SlotStatus } from '#lib/design.ts';
	import StatusIcon from './StatusIcon.svelte';

	let { counts, detail = false }: { counts: Record<SlotStatus, number>; detail?: boolean } = $props();

	const ITEMS: { key: SlotStatus; note: string }[] = [
		{ key: 'open', note: '登録できます' },
		{ key: 'res', note: '記事を準備中' },
		{ key: 'reg', note: '公開日待ち' },
		{ key: 'done', note: '読めます' }
	];
</script>

<ul aria-label="ステータスの内訳" class="legend">
	{#each ITEMS as item (item.key)}
		<li class="lg">
			<span class="stb stb-{item.key}"><StatusIcon status={item.key} />{STATUS_LABEL[item.key]}</span>
			<span class="lg-n">{counts[item.key]}</span>
			{#if detail}<span class="lg-d">{item.note}</span>{/if}
		</li>
	{/each}
</ul>

<style>
	.legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.lg {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 14px 6px 6px;
		border-radius: 99px;
		background: #fff;
		color: var(--color-pine);
	}
	.lg-n {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
	}
	.lg-d {
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
