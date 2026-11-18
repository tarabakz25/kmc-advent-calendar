<script lang="ts">
	import { DAYS } from '#lib/calendar.ts';
	import CalendarBoard from '#lib/components/CalendarBoard.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import { statusOf, type SlotStatus } from '#lib/design.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const counts = $derived.by(() => {
		const byDay = new Map(data.entries.map((e) => [e.day, e]));
		const c: Record<SlotStatus, number> = { open: 0, res: 0, done: 0 };
		for (let d = 1; d <= DAYS; d++) c[statusOf(byDay.get(d), data.today)]++;
		return c;
	});
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
