import { sql } from 'drizzle-orm';
import { check, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

/**
 * アドベントカレンダーの1日分の枠。
 * 記事そのものは外部メディアにあり、ここには「誰が・どの日に・何を・どこに書くか」だけを持つ。
 */
export const entry = pgTable(
	'entry',
	{
		id: serial('id').primaryKey(),
		year: integer('year').notNull(),
		day: integer('day').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		/** 記事のURL。予約だけ先にして、書き終わってから登録できるよう null を許す。 */
		url: text('url'),
		/** 記事のジャンル（`GENRES` のキー）。未選択なら null。 */
		genre: text('genre'),
		/** URL が最初に登録された時刻（タイムラインの「投稿順」に使う）。URL を消すと null に戻る。 */
		postedAt: timestamp('posted_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [
		// 1日につき1枠。同時に予約されても DB 側で必ず1人に絞る。
		unique('entry_year_day_unique').on(t.year, t.day),
		check('entry_day_range', sql`${t.day} between 1 and 25`)
	]
);

export * from './auth.schema';
