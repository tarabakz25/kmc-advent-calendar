<script lang="ts">
	import { page } from '$app/state';
	import { CALENDARS, calName, genreOf } from '#lib/calendar.ts';
	import { pad, weekdayEn } from '#lib/design.ts';
	import { parse, toView } from '#lib/markdown.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import BgDeco from '#lib/components/BgDeco.svelte';
	import Markdown from '#lib/components/Markdown.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const post = $derived(data.post);
	const g = $derived(genreOf(post.genre));
	const pv = $derived(toView(parse(post.body)));
	const q = $derived(page.url.search);

	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyLink() {
		let msg = 'リンクをコピーしました';
		try {
			await navigator.clipboard.writeText(page.url.origin + page.url.pathname);
		} catch {
			msg = 'コピーできませんでした';
		}
		clearTimeout(toastTimer);
		toast = msg;
		toastTimer = setTimeout(() => (toast = ''), 2200);
	}
</script>

<svelte:head>
	<title>{post.title} | KMC Advent Calendar {data.year}</title>
</svelte:head>

<div class="pagein">
	<section class="hero" aria-label="記事の情報">
		<svg
			class="hero-deco"
			viewBox="0 0 1440 320"
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
		>
			<defs>
				<pattern id="pdots" width="26" height="26" patternUnits="userSpaceOnUse"
					><circle cx="3" cy="3" r="1.3" fill="#CFE3D3" opacity=".12"></circle></pattern
				>
			</defs>
			<rect width="1440" height="320" fill="url(#pdots)"></rect>
			<path d="M1440 0H1180A260 260 0 0 0 1440 260Z" fill="var(--accent)" opacity=".22"></path>
			<circle
				cx="1260"
				cy="250"
				r="120"
				fill="none"
				stroke="#CFE3D3"
				stroke-width="1.5"
				opacity=".18"
			></circle>
			<path
				d="M0 300Q180 260 360 300T720 300T1080 300T1440 300"
				fill="none"
				stroke="#CFE3D3"
				stroke-width="1.5"
				opacity=".15"
			></path>
		</svg>
		<div class="hero-in">
			<div class="hero-day">
				<span class="hero-num">{pad(post.day)}</span>
				<span class="hero-date">{CALENDARS > 1 ? `CAL ${post.cal} · ` : ''}DEC {pad(post.day)} · {weekdayEn(post.day)} · {data.year}</span>
			</div>
			<div class="hero-main">
				<h1 class="hero-title">{post.title}</h1>
				<div class="hero-meta">
					<span class="who"
						><Avatar
							name={post.author}
							image={post.image}
							class="size-9 text-[15px]"
							plain
						/>{post.author}</span
					>
					{#if g}<span class="gchip" style="--g: {g.color}">{g.label}</span>{/if}
				</div>
			</div>
		</div>
	</section>

	<div class="content">
		<BgDeco />
		<div class="wrap">
			{#if post.mine && (post.status !== 'submitted' || post.locked)}
				<p class="notice" role="note">
					{#if post.status !== 'submitted'}
						これは下書きのプレビューです。あなたにだけ表示されています。エディタで「投稿する」を押すと公開されます。
					{:else}
						公開日（12月{post.day}日）までは、あなたにだけ表示されています。
					{/if}
				</p>
			{/if}

			<article class="paper" aria-label="記事本文">
				<div class="body">
					<Markdown view={pv.view} />
				</div>
				<div class="foot">
					<span class="tags">KMC Advent Calendar {data.year} · {CALENDARS > 1 ? `${calName(post.cal)} の ` : ''}{pad(post.day)} 日目の記事</span>
					<span class="flex flex-wrap gap-2">
						<button class="pill pill-ghost" onclick={copyLink}>リンクをコピー</button>
						{#if post.mine}<a class="pill pill-pine" href="/write/{post.day}{q}">記事を編集</a>{/if}
					</span>
				</div>
			</article>

			<aside class="side" aria-label="記事のナビゲーション">
				<div class="box">
					<h2 class="box-t">AUTHOR</h2>
					<span class="who who-dark"
						><Avatar
							name={post.author}
							image={post.image}
							class="size-9 text-[15px]"
						/>{post.author}</span
					>
				</div>
				<a class="back" href="/calendar{q}">← カレンダーに戻る</a>
			</aside>
		</div>
	</div>
</div>

{#if toast}<div class="toast" role="status">{toast}</div>{/if}

<style>
	.hero {
		position: relative;
		background: var(--color-pine);
		color: var(--color-cream);
		overflow: hidden;
	}
	.hero-deco {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.hero-in {
		position: relative;
		max-width: 1080px;
		margin: 0 auto;
		padding: 48px 24px 44px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 20px 40px;
	}
	.hero-day {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: none;
	}
	.hero-num {
		font-family: var(--font-display);
		font-size: 112px;
		font-weight: 700;
		line-height: 0.85;
		letter-spacing: -0.04em;
		color: var(--accent);
	}
	.hero-date {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.16em;
		color: var(--color-mint);
	}
	.hero-main {
		flex: 1 1 420px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.hero-title {
		margin: 0;
		font-size: 36px;
		line-height: 1.35;
		font-weight: 900;
		color: #fff;
		overflow-wrap: anywhere;
	}
	.hero-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		font-size: 14px;
		color: var(--color-mint);
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		color: #fff;
	}
	.who-dark {
		color: var(--color-ink);
	}
	.wrap {
		max-width: 1080px;
		margin: 0 auto;
		padding: 40px 24px 72px;
		display: flex;
		flex-wrap: wrap;
		gap: 32px;
		align-items: flex-start;
	}
	.notice {
		flex: 1 1 100%;
		margin: 0;
		padding: 12px 18px;
		border-radius: 10px;
		background: #fbecd0;
		color: #5a4310;
		font-size: 14px;
		line-height: 1.6;
	}
	.paper {
		flex: 999 1 560px;
		min-width: 0;
		background: #fff;
		border-radius: 12px;
		box-shadow: inset 0 0 0 1px var(--color-line);
	}
	.body {
		padding: 40px 48px 48px;
	}
	.side {
		flex: 1 1 240px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
		position: sticky;
		top: 16px;
	}
	.box {
		background: #fff;
		border-radius: 12px;
		box-shadow: inset 0 0 0 1px var(--color-line);
		padding: 20px;
	}
	.box-t {
		margin: 0 0 10px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--color-muted);
	}
	.back {
		font-size: 14px;
		font-weight: 700;
		padding: 8px 4px;
	}
	.foot {
		border-top: 1px solid #e7e0d4;
		padding: 24px 48px 32px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.tags {
		font-size: 13px;
		color: var(--color-muted);
	}
	.pill {
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		min-height: 44px;
		padding: 0 20px;
		border-radius: 99px;
		border: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		text-decoration: none;
		transition:
			transform 0.15s,
			background 0.15s;
	}
	.pill:hover {
		transform: translateY(-1px);
	}
	.pill-pine {
		background: var(--color-pine);
		color: var(--color-cream);
	}
	.pill-pine:hover {
		background: var(--color-pine-dark);
		color: var(--color-cream);
	}
	.pill-ghost {
		background: #fff;
		color: var(--color-pine);
		box-shadow: inset 0 0 0 1.5px var(--color-pine);
	}
	.pill-ghost:hover {
		color: var(--color-pine);
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: 28px;
		transform: translateX(-50%);
		padding: 12px 20px;
		border-radius: 99px;
		background: var(--color-night);
		color: var(--color-cream);
		font-size: 14px;
		font-weight: 700;
		z-index: 20;
	}
	@media (max-width: 600px) {
		.body {
			padding: 28px 20px 36px;
		}
		.foot {
			padding: 20px;
		}
		.hero-num {
			font-size: 80px;
		}
		.hero-title {
			font-size: 28px;
		}
	}
	@media (max-width: 860px) {
		.side {
			position: static;
		}
	}
</style>
