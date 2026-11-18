<script lang="ts">
	import { page } from '$app/state';
	import { CALENDAR_YEAR } from '#lib/calendar.ts';
	import UserMenu from './UserMenu.svelte';

	let { viewer }: { viewer: { name: string; image: string | null } | null } = $props();

	// 開発中の ?today= / ?demo= をページを移っても保つ。
	const q = $derived(page.url.search);
	const path = $derived(page.url.pathname);
	const cur = (p: string) => (path === p ? 'page' : undefined);
	const loginHref = $derived(`/login?redirectTo=${encodeURIComponent(path)}`);
</script>

<nav aria-label="メインメニュー" class="gh-in">
	<a href="/{q}" class="gh-brand">KMC ADVENT {CALENDAR_YEAR}</a>
	<span class="gh-links">
		<a href="/calendar{q}" class="gh-link" aria-current={cur('/calendar')}>カレンダー</a>
		<a href="/articles{q}" class="gh-link" aria-current={cur('/articles')}>記事一覧</a>
		<a href="/join{q}" class="gh-cta" aria-current={cur('/join')}>参加登録する</a>
		{#if viewer}
			<UserMenu name={viewer.name} image={viewer.image} />
		{:else}
			<a href={loginHref} class="gh-av" aria-label="ログイン" title="ログイン">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"
					><circle cx="12" cy="8.5" r="3.8"></circle><path d="M4.5 20c1.4-3.6 4.3-5.4 7.5-5.4s6.1 1.8 7.5 5.4"></path></svg
				>
			</a>
		{/if}
	</span>
</nav>
