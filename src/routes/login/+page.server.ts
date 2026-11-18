import { safeRedirect } from '#lib/calendar.ts';
import { auth, googleEnabled } from '#lib/server/auth.ts';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const redirectTo = safeRedirect(url.searchParams.get('redirectTo'));
	if (locals.user) return redirect(303, redirectTo);
	return {
		redirectTo,
		googleEnabled,
		// 学校以外のアカウントを選んだときなど、Google から失敗して戻ってきたとき。
		googleFailed: url.searchParams.get('from') === 'google'
	};
};

export const actions: Actions = {
	/** Google の認証画面へ進む。戻ってきたとき、学校以外のアドレスはアカウント作成の段階で弾かれる。 */
	google: async ({ request }) => {
		if (!googleEnabled) return fail(404, { message: 'Google ログインは設定されていません。' });
		const form = await request.formData();
		const redirectTo = safeRedirect(form.get('redirectTo'));

		const result = await auth.api.signInSocial({
			body: {
				provider: 'google',
				callbackURL: redirectTo,
				errorCallbackURL: `/login?from=google&redirectTo=${encodeURIComponent(redirectTo)}`
			},
			headers: request.headers
		});
		if (!result.url) return fail(500, { message: 'Google ログインを開始できませんでした。' });
		// 外部への移動は、行き先を Google の認証画面だけに限って許可する。
		return redirect(303, result.url, { external: ['https://accounts.google.com'] });
	}
};
