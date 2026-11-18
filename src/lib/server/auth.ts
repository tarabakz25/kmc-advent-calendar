import {
	BETTER_AUTH_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	ORIGIN
} from '$app/env/private';
import { isSchoolEmail, SCHOOL_EMAIL_DOMAIN } from '#lib/calendar.ts';
import { db } from '#lib/server/db/index.ts';
import { getRequestEvent } from '$app/server';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';

const NOT_SCHOOL_EMAIL = `@${SCHOOL_EMAIL_DOMAIN} のメールアドレスでのみ利用できます。`;

/** Google ログインは、クライアントID/シークレットが両方あるときだけ有効。 */
export const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	// ログインは Google のみ。パスワード登録を残すと、メール確認なしで任意のアドレスで
	// アカウントを作れてしまうため無効にしている。
	emailAndPassword: { enabled: false },
	socialProviders: googleEnabled
		? {
				google: {
					clientId: GOOGLE_CLIENT_ID!,
					clientSecret: GOOGLE_CLIENT_SECRET!,
					// Google Workspace のアカウントだけに絞る（個人の Gmail は不可）。
					// 学校のドメインかどうかは、下の databaseHooks で必ず確認する。
					hd: '*',
					prompt: 'select_account'
				}
			}
		: {},
	databaseHooks: {
		user: {
			create: {
				// どの経路でも、学校のアドレス以外ではアカウントを作らせない。
				before: async (user) => {
					if (!isSchoolEmail(user.email)) {
						throw new APIError('FORBIDDEN', { message: NOT_SCHOOL_EMAIL });
					}
				}
			}
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
