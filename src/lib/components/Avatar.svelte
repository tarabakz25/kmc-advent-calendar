<script lang="ts">
	let {
		name,
		image,
		class: cls = 'size-6 text-[10px]',
		plain = false
	}: {
		name: string;
		image: string | null;
		class?: string;
		/** 画像がないとき、色付きではなく白地に頭文字で見せる（カレンダーのタイル用）。 */
		plain?: boolean;
	} = $props();

	let failed = $state(false);
	const initial = $derived(([...name.replace(/^@/, '')][0] ?? '?').toUpperCase());
	// 画像がない人も見分けられるよう、名前から色を決める。
	const hue = $derived([...name].reduce((h, c) => (h * 31 + c.codePointAt(0)!) % 360, 7));
</script>

{#if image && !failed}
	<!-- Google のアイコンは Referer があると表示されないことがあるため送らない。 -->
	<img
		src={image}
		alt=""
		referrerpolicy="no-referrer"
		class="shrink-0 rounded-full object-cover {cls}"
		onerror={() => (failed = true)}
	/>
{:else if plain}
	<span
		class="grid shrink-0 place-items-center rounded-full bg-white font-display font-bold text-pine {cls}"
		aria-hidden="true">{initial}</span
	>
{:else}
	<span
		class="grid shrink-0 place-items-center rounded-full font-bold text-white/90 {cls}"
		style="background: linear-gradient(135deg, hsl({hue} 55% 42%), hsl({(hue + 40) % 360} 60% 30%))"
		aria-hidden="true">{initial}</span
	>
{/if}
