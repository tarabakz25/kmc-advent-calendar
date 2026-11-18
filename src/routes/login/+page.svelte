<script lang="ts">
	import { page } from '$app/state';
	import { CALENDAR_YEAR, DAYS, SCHOOL_EMAIL_DOMAIN } from '#lib/calendar.ts';
	import { colorOf, pad } from '#lib/design.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let busy = $state(false);
	const days = Array.from({ length: DAYS }, (_, i) => i + 1);
</script>

<!-- Google から「戻る」で帰ってきたとき、接続中のままにしない。 -->
<svelte:window onpageshow={() => (busy = false)} />

<svelte:head>
	<title>ログイン | KMC Advent Calendar</title>
</svelte:head>

<div class="wrap">
	<aside class="side" aria-label="KMC ADVENT {CALENDAR_YEAR}">
		<a href="/{page.url.search}" class="brand">KMC ADVENT {CALENDAR_YEAR}</a>
		<div class="mosaic" aria-hidden="true">
			{#each days as d (d)}
				<span class="tile t-{colorOf(d)}" style="animation-delay: {(d - 1) * 0.03}s">{pad(d)}</span>
			{/each}
		</div>
		<div class="flex flex-col gap-2.5">
			<span class="font-display text-[13px] font-bold tracking-[.2em] text-mint"
				>DEC 01 — DEC 25</span
			>
			<p class="m-0 text-[26px] leading-normal font-black">
				25日間、毎日ひとつずつ。<br />神山まるごと高専のアドベントカレンダー。
			</p>
		</div>
	</aside>

	<main class="main">
		<div class="card">
			<div class="flex flex-col gap-2.5">
				<span class="font-display text-[13px] font-bold tracking-[.2em] text-muted">SIGN IN</span>
				<h1 class="m-0 text-[40px] leading-tight font-black text-pine">ログイン</h1>
				<p class="m-0 text-[15px] leading-[1.8] text-[#3D3830]">
					参加登録や記事URLの追加には、学校のGoogleアカウント（@{SCHOOL_EMAIL_DOMAIN}）でのログインが必要です。
				</p>
			</div>

			{#if data.googleFailed}
				<div class="lerr" role="alert">
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						class="mt-[3px] flex-none"
						><circle cx="12" cy="12" r="9"></circle><path d="M12 7.5v5.5M12 16.5v.01"></path></svg
					>
					<span
						><b>このアカウントではログインできません。</b><br
						/>学校のGoogleアカウント（@{SCHOOL_EMAIL_DOMAIN}）を選んで、もう一度お試しください。</span
					>
				</div>
			{/if}

			{#if data.googleEnabled}
				<!-- 外部サイトへ移動するので enhance は使わず、通常のフォーム送信にする。 -->
				<form method="POST" action="?/google" onsubmit={() => (busy = true)}>
					<input type="hidden" name="redirectTo" value={data.redirectTo} />
					<button class="gbtn" disabled={busy} aria-busy={busy}>
						{#if busy}
							<span class="spin" aria-hidden="true"></span>
						{:else}
							<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
								<path
									fill="#EA4335"
									d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
								/>
								<path
									fill="#4285F4"
									d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"
								/>
								<path
									fill="#FBBC05"
									d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.1z"
								/>
								<path
									fill="#34A853"
									d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
								/>
							</svg>
						{/if}
						<span>{busy ? 'Googleに接続中…' : 'Googleでログイン'}</span>
					</button>
				</form>
			{:else}
				<p role="alert" class="m-0 rounded bg-cream px-4 py-3 text-sm text-muted">
					ログインはまだ設定されていません(管理者向け: <code>GOOGLE_CLIENT_ID</code> と
					<code>GOOGLE_CLIENT_SECRET</code> を設定してください)。
				</p>
			{/if}
		</div>
	</main>
</div>

<style>
	.wrap {
		min-height: 100dvh;
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
	}
	.side {
		background: var(--color-night);
		color: var(--color-cream);
		padding: 48px 56px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 40px;
		overflow: hidden;
	}
	.brand {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 16px;
		letter-spacing: 0.06em;
		color: var(--color-cream);
		text-decoration: none;
		align-self: flex-start;
	}
	.brand:hover {
		color: var(--color-mint);
	}
	.mosaic {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
		max-width: 440px;
		width: 100%;
	}
	.tile {
		aspect-ratio: 1;
		border-radius: 4px;
		padding: 8px 10px;
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
		animation: tin 0.6s cubic-bezier(0.2, 1.3, 0.3, 1) both;
	}
	@keyframes tin {
		from {
			opacity: 0;
			transform: translateY(-14px) rotate(-4deg);
		}
	}
	.t-pine {
		background: var(--color-pine);
		color: var(--color-cream);
		box-shadow: inset 0 0 0 1.5px rgb(243 238 230 / 0.25);
	}
	.t-mint {
		background: var(--color-mint);
		color: var(--color-pine);
	}
	.t-coral {
		background: var(--accent);
		color: #1b1b1b;
	}
	.t-paper {
		background: var(--color-cream);
		color: var(--color-pine);
	}
	.main {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
	}
	.card {
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 28px;
		animation: fadein 0.5s ease-out;
	}
	.gbtn {
		font: inherit;
		width: 100%;
		min-height: 56px;
		padding: 0 20px;
		border-radius: 99px;
		border: 1.5px solid var(--color-pine);
		background: #fff;
		color: var(--color-ink);
		font-size: 16px;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		box-shadow: 0 16px 30px -18px rgb(15 59 58 / 0.6);
		transition:
			transform 0.15s,
			box-shadow 0.2s,
			background 0.2s;
	}
	.gbtn:hover {
		transform: translateY(-2px);
		box-shadow: 0 20px 34px -18px rgb(15 59 58 / 0.7);
	}
	.gbtn:active {
		transform: translateY(0);
	}
	.gbtn:disabled {
		cursor: progress;
		transform: none;
		background: #f7f4ee;
	}
	.spin {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2.5px solid var(--color-line);
		border-top-color: var(--color-pine);
		animation: sp 0.8s linear infinite;
	}
	@keyframes sp {
		to {
			transform: rotate(360deg);
		}
	}
	.lerr {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 14px 16px;
		border-radius: 4px;
		background: #fbe7e2;
		color: #7a2414;
		font-size: 13px;
		line-height: 1.7;
		font-weight: 500;
	}
	.lerr b {
		font-weight: 700;
	}
	@media (max-width: 860px) {
		.wrap {
			grid-template-columns: 1fr;
		}
		.side {
			min-height: 320px;
			padding: 32px 24px;
		}
		.mosaic {
			max-width: 340px;
		}
	}
</style>
