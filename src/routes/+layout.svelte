<script lang="ts">
	import './layout.css';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import SiteNav from '#lib/components/SiteNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	/** トップはキービジュアルの中にナビを置くので、共通ヘッダーを出さない。 */
	const showHeader = $derived(page.url.pathname !== '/');

	// ページ切り替えをふわっとつなぐ（対応ブラウザのみ）。
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#0B2A29" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
	/>
</svelte:head>

{#if showHeader}
	<header class="gh">
		<SiteNav viewer={data.viewer} />
	</header>
{/if}

{@render children()}
