<script lang="ts">
	let { name, image }: { name: string; image: string | null } = $props();

	let open = $state(false);
	let failed = $state(false);
	let root: HTMLDivElement;

	const initial = $derived([...name][0] ?? '?');

	function onWindowClick(event: MouseEvent) {
		if (open && !root.contains(event.target as Node)) open = false;
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			open = false;
			root.querySelector('button')?.focus();
		}
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="relative" bind:this={root}>
	<button
		type="button"
		class="gh-av font-display text-base font-bold"
		aria-label="アカウントメニュー"
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		{#if image && !failed}
			<!-- Google のアイコンは Referer があると表示されないことがあるため送らない。 -->
			<img src={image} alt="" referrerpolicy="no-referrer" class="size-full object-cover" onerror={() => (failed = true)} />
		{:else}
			{initial}
		{/if}
	</button>

	{#if open}
		<div role="menu" class="menu">
			<p class="truncate px-4 py-3 text-sm text-muted">{name} さん</p>
			<form method="POST" action="/logout" class="border-t border-line">
				<button role="menuitem" class="w-full px-4 py-3 text-left text-sm font-bold text-pine transition hover:bg-cream">
					ログアウト
				</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.menu {
		position: absolute;
		right: 0;
		z-index: 30;
		margin-top: 8px;
		width: 14rem;
		overflow: hidden;
		border-radius: 6px;
		background: #fff;
		box-shadow: 0 24px 44px -22px rgb(0 0 0 / 0.45);
		animation: fadein 0.2s ease-out;
	}
</style>
