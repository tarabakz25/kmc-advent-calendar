<script lang="ts">
	import { SCHOOL_EMAIL_DOMAIN } from '#lib/calendar.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>ログイン | KMC Advent Calendar</title>
</svelte:head>

<div class="wrap pagein">
	<div class="card">
		<span class="font-display text-[13px] font-bold tracking-[.2em] text-muted">SIGN IN</span>
		<h1 class="m-0 text-[32px] font-black text-pine">ログイン</h1>
		<p class="m-0 text-sm leading-relaxed text-[#3D3830]">
			<b class="text-pine">@{SCHOOL_EMAIL_DOMAIN}</b> の Google アカウントでログインします。初めての方は、ログインすると自動で登録されます。
		</p>

		{#if data.googleFailed}
			<p role="alert" class="err m-0">ログインできませんでした。@{SCHOOL_EMAIL_DOMAIN} のアカウントを選んでください。</p>
		{/if}

		{#if data.googleEnabled}
			<!-- 外部サイトへ移動するので enhance は使わず、通常のフォーム送信にする。 -->
			<form method="POST" action="?/google">
				<input type="hidden" name="redirectTo" value={data.redirectTo} />
				<button class="btn btn-main w-full gap-3 rounded-full">
					<svg viewBox="0 0 48 48" class="size-5 rounded-full bg-white p-0.5" aria-hidden="true">
						<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
						<path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
						<path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.1z" />
						<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
					</svg>
					Google でログイン
				</button>
			</form>
		{:else}
			<p role="alert" class="m-0 rounded bg-cream px-4 py-3 text-sm text-muted">
				ログインはまだ設定されていません(管理者向け: <code>GOOGLE_CLIENT_ID</code> と <code>GOOGLE_CLIENT_SECRET</code> を設定してください)。
			</p>
		{/if}
	</div>
</div>

<style>
	.wrap {
		max-width: 480px;
		margin: 0 auto;
		padding: 64px 20px;
	}
	.card {
		background: #fff;
		border-radius: 10px;
		padding: 36px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		box-shadow: 0 30px 50px -34px rgb(15 59 58 / 0.5);
	}
</style>
