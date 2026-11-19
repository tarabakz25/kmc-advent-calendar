<script lang="ts">
	import { isPostPath, platformOf, type PublicEntry } from '#lib/calendar.ts';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import Avatar from './Avatar.svelte';

	let { entries, hovered = $bindable(null) }: { entries: PublicEntry[]; hovered?: number | null } =
		$props();

	let order = $state<'new' | 'old'>('new');

	// 読めるようになった順。同時刻なら日付順。
	const items = $derived(
		entries
			.filter((e) => e.publishedAt && e.url)
			.toSorted((a, b) => {
				const diff = Date.parse(a.publishedAt!) - Date.parse(b.publishedAt!) || a.day - b.day;
				return order === 'new' ? -diff : diff;
			})
	);

	const fmt = new Intl.DateTimeFormat('ja-JP', {
		timeZone: 'Asia/Tokyo',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
</script>

<div class="flex min-h-0 flex-col">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h3 class="font-display text-sm tracking-[0.2em] text-gold-300/90 uppercase">Timeline</h3>
		<div class="flex rounded-full bg-white/5 p-0.5 text-[11px]" role="group" aria-label="並び順">
			{#each [['new', '新しい順'], ['old', '古い順']] as const as [key, text] (key)}
				<button
					type="button"
					class="rounded-full px-2.5 py-1 transition {order === key ? 'bg-gold-400 font-semibold text-night-950' : 'text-slate-400 hover:text-slate-100'}"
					aria-pressed={order === key}
					onclick={() => (order = key)}>{text}</button
				>
			{/each}
		</div>
	</div>

	{#if items.length === 0}
		<div class="grid flex-1 place-items-center rounded-2xl bg-white/[0.03] p-6 text-center">
			<div>
				<svg viewBox="0 0 48 48" class="mx-auto size-10 text-gold-300/60" aria-hidden="true">
					<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M24 6l4 12.4L41 20l-10.5 7.6L34 41l-10-8-10 8 3.5-13.4L7 20l13-1.6z" class="empty-star" />
				</svg>
				<p class="mt-3 text-xs leading-relaxed text-slate-400">
					記事が公開されると、<br />ここに投稿順で流れてきます。
				</p>
			</div>
		</div>
	{:else}
		<ol class="no-scrollbar relative min-h-0 flex-1 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]">
			<span class="absolute top-2 bottom-0 left-[7px] w-px bg-gradient-to-b from-gold-400/50 via-white/10 to-transparent" aria-hidden="true"></span>
			{#each items as e, i (e.day)}
				<li animate:flip={{ duration: 400 }} in:fly={{ y: 10, delay: i * 40 }} class="relative pb-1 pl-6">
					<span
						class="absolute top-3 left-[3px] size-[9px] rounded-full ring-4 ring-night-950 {i === 0 && order === 'new' ? 'newest bg-gold-300' : 'bg-gold-400/60'}"
						aria-hidden="true"
					></span>
					<a
						href={e.url}
						target={isPostPath(e.url) ? undefined : '_blank'}
						rel="noopener noreferrer"
						class="block rounded-xl px-2.5 py-2 transition hover:bg-white/[0.05]"
						onpointerenter={() => (hovered = e.day)}
						onpointerleave={() => (hovered = null)}
						onfocus={() => (hovered = e.day)}
						onblur={() => (hovered = null)}
					>
						<span class="flex items-center gap-2 text-[10px] text-slate-500">
							<span class="font-semibold tracking-wider text-gold-300/90">DAY {e.day}</span>
							<span>{fmt.format(new Date(e.publishedAt!))}</span>
						</span>
						<span class="mt-1 line-clamp-2 text-[13px] leading-snug font-semibold text-slate-100">{e.title}</span>
						<span class="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
							<Avatar name={e.author} image={e.image} class="size-4 text-[8px]" />
							<span class="truncate">{e.author}</span>
							<span class="ml-auto shrink-0 text-gold-300/70">{platformOf(e.url!)} ↗</span>
						</span>
					</a>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.newest {
		box-shadow: 0 0 10px 2px rgb(248 207 115 / 0.7);
		animation: ping 2s ease-in-out infinite;
	}
	@keyframes ping {
		50% {
			box-shadow: 0 0 2px 0 rgb(248 207 115 / 0.3);
		}
	}
	.empty-star {
		stroke-dasharray: 140;
		animation: dash 4s ease-in-out infinite alternate;
	}
	@keyframes dash {
		from {
			stroke-dashoffset: 140;
		}
	}
</style>
