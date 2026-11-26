import { sql } from 'drizzle-orm';
import {
	check,
	customType,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

/**
 * アドベントカレンダーの1日分の枠。
 * 記事は外部メディアに書くか、このサイトのエディタで書く（本文は `body`）。
 */
export const entry = pgTable(
	'entry',
	{
		id: serial('id').primaryKey(),
		year: integer('year').notNull(),
		/** どのカレンダーの枠か（1 始まり）。1つ目が埋まったら同じ日付の枠をもう1セット足す（`CALENDARS`）。 */
		cal: integer('cal').notNull().default(1),
		day: integer('day').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		/** 記事のURL。予約だけ先にして、書き終わってから登録できるよう null を許す。 */
		url: text('url'),
		/**
		 * サイト内のエディタで書いた本文（Markdown）。外部メディアに書く人は null のまま。
		 * 「投稿する」と `url` が `/posts/{day}`（カレンダー 2 以降は `/posts/{day}?cal={cal}`）になり、
		 * ほかの記事と同じように公開される。
		 */
		body: text('body'),
		/** 記事のジャンル（`GENRES` のキー）。未選択なら null。 */
		genre: text('genre'),
		/** URL が最初に登録された時刻（タイムラインの「投稿順」に使う）。URL を消すと null に戻る。 */
		postedAt: timestamp('posted_at'),
		/** Slack に公開のお知らせを投稿した時刻。二重投稿を防ぐ。 */
		slackNotifiedAt: timestamp('slack_notified_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [
		// カレンダーごとに1日1枠。同時に予約されても DB 側で必ず1人に絞る。
		unique('entry_year_cal_day_unique').on(t.year, t.cal, t.day),
		check('entry_day_range', sql`${t.day} between 1 and 25`),
		check('entry_cal_range', sql`${t.cal} >= 1`)
	]
);

/**
 * Slack に送ったリマインドなどの記録。同じ key は1回しか送らない（二重送信防止）。
 * key の例: `daily:2026-11-20`（日次投稿）, `remind:12:3`（entry 12 の3日前リマインド）,
 * `full:2026:1`（カレンダー 1 の全枠埋まり）, `complete:2026:1`（カレンダー 1 のコンプリート）
 */
export const slackLog = pgTable('slack_log', {
	key: text('key').primaryKey(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * エディタから上げた画像・ファイル。Vercel でも Docker でも同じように動くよう、中身ごと DB に置く。
 * `/uploads/{id}/{name}` で配信する（`src/routes/uploads/[id]/[name]/+server.ts`）。
 */
export const upload = pgTable(
	'upload',
	{
		/** 推測されにくいランダムな ID。 */
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		mime: text('mime').notNull(),
		size: integer('size').notNull(),
		data: bytea('data').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [index('upload_user_id_idx').on(t.userId)]
);

export * from './auth.schema';
