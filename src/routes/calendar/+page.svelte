<script lang="ts">
	import CalendarBoard from '#lib/components/CalendarBoard.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import { statusCounts } from '#lib/design.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const counts = $derived(statusCounts(data.entries, data.today));
</script>

<svelte:head>
	<title>カレンダー | KMC Advent Calendar {data.year}</title>
</svelte:head>

<!-- 広い画面ではヘッダーを除いた残りの高さに、25日分すべてを収める。 -->
<div class="calroot">
	<div class="cal-head pagein">
		<h1 class="font-display m-0 text-4xl leading-tight font-bold tracking-tight text-pine">Calendar</h1>
		<Legend {counts} />
	</div>
	<CalendarBoard entries={data.entries} today={data.today} fit />
</div>

<style>
	.cal-head {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px 24px 0;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px 32px;
	}
	@media (min-width: 901px) and (min-height: 620px) {
		.calroot {
			/* 共通ヘッダーの高さ（84px）を引いた残り */
			height: calc(100dvh - 84px);
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
	}
</style>
