import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	// 画面に出すのは表示名とアイコンだけ。メールアドレスなどはクライアントに送らない。
	viewer: locals.user ? { name: locals.user.name, image: locals.user.image ?? null } : null
});
