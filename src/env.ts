import { defineEnvVars } from '@sveltejs/kit/env';

/** 空文字は「未設定」として扱う。 */
const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	GOOGLE_CLIENT_ID: {
		description:
			'Google ログイン用の OAuth クライアントID。GOOGLE_CLIENT_SECRET と両方設定しないとログインできない。',
		schema: optional
	},
	GOOGLE_CLIENT_SECRET: {
		description: 'Google ログイン用の OAuth クライアントシークレット。',
		schema: optional
	}
});
