<script lang="ts">
	// パターン ID がページ内で重ならないように。
	const id = `dots-${Math.random().toString(36).slice(2, 8)}`;
</script>

<svg class="bgdeco" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	<defs>
		<pattern {id} width="26" height="26" patternUnits="userSpaceOnUse">
			<circle cx="3" cy="3" r="1.3" fill="#0F3B3A" opacity=".13"></circle>
		</pattern>
	</defs>
	<rect x="0" y="0" width="1600" height="1000" fill="url(#{id})"></rect>
	<g class="bd-spin" style="transform-origin: 70px 150px">
		<circle cx="70" cy="150" r="190" fill="none" stroke="#CFE3D3" stroke-width="46" stroke-dasharray="2 22"></circle>
	</g>
	<circle cx="70" cy="150" r="120" fill="none" stroke="#0F3B3A" stroke-width="1.5" opacity=".14"></circle>
	<path d="M1600 1000H1330A270 270 0 0 1 1600 730Z" fill="var(--accent)" opacity=".16"></path>
	<path d="M1600 1000H1420A180 180 0 0 1 1600 820Z" fill="var(--accent)" opacity=".22"></path>
	<path d="M1600 300A140 140 0 0 0 1600 580Z" fill="#CFE3D3" opacity=".7"></path>
	<path d="M0 860Q200 800 400 860T800 860T1200 860T1600 860" fill="none" stroke="#0F3B3A" stroke-width="1.5" opacity=".12"></path>
	<path d="M0 900Q200 840 400 900T800 900T1200 900T1600 900" fill="none" stroke="#0F3B3A" stroke-width="1.5" opacity=".08"></path>
	<g fill="none" stroke="#0F3B3A" stroke-width="1.6" opacity=".22">
		<g class="bd-tw" style="transform-origin: 1480px 120px"><path d="M1480 104v32M1464 120h32M1469 109l22 22M1491 109l-22 22"></path></g>
		<g class="bd-tw" style="transform-origin: 300px 640px; animation-delay: -3s"><path d="M300 628v24M288 640h24M292 632l16 16M308 632l-16 16"></path></g>
		<g class="bd-tw" style="transform-origin: 1240px 560px; animation-delay: -6s"><path d="M1240 550v20M1230 560h20"></path></g>
		<g class="bd-tw" style="transform-origin: 760px 70px; animation-delay: -2s"><path d="M760 60v20M750 70h20"></path></g>
	</g>
	<circle cx="1380" cy="190" r="7" fill="var(--accent)" opacity=".5"></circle>
	<circle cx="180" cy="520" r="5" fill="#0F3B3A" opacity=".25"></circle>
	<circle cx="1010" cy="930" r="9" fill="none" stroke="var(--accent)" stroke-width="2" opacity=".45"></circle>
</svg>
