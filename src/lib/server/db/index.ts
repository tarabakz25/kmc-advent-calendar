import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Vercel ではリクエストごとに関数インスタンスが増えるので、接続はプーラー経由
// （Neon の -pooler / Supabase の 6543 番など）にする。プーラーの transaction モードでは
// prepared statement が使えないため prepare: false にしている。
const client = postgres(DATABASE_URL, { prepare: false, max: 5 });

export const db = drizzle(client, { schema });
