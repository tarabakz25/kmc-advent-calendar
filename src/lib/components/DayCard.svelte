<script lang="ts">
	import { dayOffset, platformOf, stateOf, weekdayOf, type PublicEntry } from '#lib/calendar.ts';
	import Avatar from './Avatar.svelte';

	let {
		day,
		entry,
		today,
		highlighted = false
	}: { day: number; entry: PublicEntry | undefined; today: string; highlighted?: boolean } = $props();

	const state = $derived(stateOf(entry, day, today));
	const offset = $derived(dayOffset(day, today));
	const isToday = $derived(offset === 0);
	const isPast = $derived(offset < 0);
	const weekend = $derived(['土', '日'].includes(weekdayOf(day)));

	// 公開済みなら記事へ直接、それ以外は日別ページ（予約・編集）へ。
	const external = $derived(state === 'published');
	const href = $derived(external ? entry!.url! : `/day/${day}`);
	const label = $derived(String(day).padStart(2, '0'));
</script>

<!-- 枠線は使わず、上の1本線と数字で見せる。 -->
<div id="day-{day}" class="group relative h-full">
	<a
		{href}
		target={external ? '_blank' : undefined}
		rel={external ? 'noopener noreferrer' : undefined}
		class="relative flex h-full min-h-28 flex-col gap-2 overflow-hidden rounded-b-xl px-2.5 pt-3 pb-2.5 transition-colors duration-300 lg:min-h-0
			{isToday ? 'bg-gold-400/[0.07]' : highlighted ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}"
		aria-label="12月{day}日{entry ? `、${entry.author}さん、${entry.title}` : '、空き枠'}"
	>
		<span
			class="rule absolute inset-x-0 top-0 origin-left
				{isToday ? 'h-0.5 bg-gold-400' : state === 'published' ? 'h-px bg-gold-300/70' : 'h-px bg-white/20'}"
			aria-hidden="true"
		></span>

		<span class="flex items-baseline gap-1.5">
			<span
				class="font-display text-2xl leading-none font-medium tabular-nums xl:text-[1.75rem]
					{isToday ? 'text-gold-300' : state === 'published' ? 'text-gold-200' : isPast ? 'text-slate-600' : 'text-slate-300'}"
				>{label}</span
			>
			<span class="text-[10px] {weekend ? 'text-rose-300/70' : 'text-slate-500'}">{weekdayOf(day)}</span>
			{#if state === 'published'}
				<span class="lit ml-auto self-center text-[10px] font-semibold text-gold-300">
					{platformOf(entry!.url!)} ↗
				</span>
			{:else if state === 'reserved'}
				<span class="ml-auto self-center text-[10px] text-mint-300/80">{isPast || isToday ? '執筆中' : '予約済み'}</span>
			{:else if isToday}
				<span class="ml-auto self-center text-[9px] font-bold tracking-widest text-gold-300">TODAY</span>
			{/if}
		</span>

		{#if entry}
			<!-- アイコンの右に名前とタイトルを重ねて、低い画面でも行数を節約する -->
			<span class="flex min-h-0 min-w-0 items-start gap-2">
				<Avatar name={entry.author} image={entry.image} class="size-7 text-[11px] ring-1 {state === 'published' ? 'ring-gold-300/60' : 'ring-white/15'}" />
				<span class="flex min-w-0 flex-col gap-0.5">
					<span class="truncate text-[11px] leading-tight text-slate-400">{entry.author}</span>
					<span
						class="line-clamp-3 text-[13px] leading-snug font-semibold [@media(max-height:860px)]:lg:line-clamp-2 [@media(max-height:740px)]:lg:line-clamp-1
							{state === 'published' ? 'text-slate-50 decoration-gold-300/60 underline-offset-2 group-hover:underline' : 'text-slate-300'}"
					>
						{entry.title}
					</span>
				</span>
			</span>
		{:else if !isPast}
			<span class="mt-auto flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition duration-300 group-hover:text-gold-300">
				<svg viewBox="0 0 24 24" class="size-3 fill-none stroke-current stroke-[2.5] transition duration-300 group-hover:rotate-90" stroke-linecap="round" aria-hidden="true">
					<path d="M12 5v14M5 12h14" />
				</svg>
				予約する
			</span>
		{/if}
	</a>

	{#if entry?.mine && external}
		<!-- 公開済みは記事へ直行するので、自分の分だけ編集の入口を別に置く。 -->
		<a href="/day/{day}" class="absolute right-2.5 bottom-2 text-[10px] text-slate-400 hover:text-gold-300 hover:underline">編集</a>
	{/if}
</div>

<style>
	.rule {
		animation: rule 0.9s cubic-bezier(0.6, 0, 0.2, 1) both;
		animation-delay: calc(0.2s + var(--i, 0) * 30ms);
	}
	@keyframes rule {
		from {
			transform: scaleX(0);
		}
	}
	.lit {
		text-shadow: 0 0 8px rgb(248 207 115 / 0.6);
	}
</style>
