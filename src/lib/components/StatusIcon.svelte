<script lang="ts">
	import type { SlotStatus } from '#lib/design.ts';

	let { status, size = 12 }: { status: SlotStatus; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
	{#if status === 'open'}
		<circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1.6"></circle>
	{:else if status === 'res'}
		<circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
		<path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor"></path>
	{:else if status === 'reg'}
		<circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
		<path d="M6 3.4V6l1.8 1.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
	{:else}
		<path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8"></path>
	{/if}
</svg>
