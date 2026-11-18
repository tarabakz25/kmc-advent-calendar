import tailwindcss from '@tailwindcss/vite';
import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Vercel 上のビルドでは Vercel 向け、それ以外（Docker / 手元）は Node(Bun) 向けにビルドする。
			// Vercel はビルド時に VERCEL=1 を入れる。
			adapter: process.env.VERCEL ? vercelAdapter({ regions: ['hnd1'] }) : nodeAdapter()
		})
	]
});
