import { DAYS, GENRES, phaseOf, type PublicEntry } from './calendar.ts';
import { statusOf } from './design.ts';

/** 最終レポートは開催が終わった翌日（12月26日 0 時 JST）から見られる。 */
export function isReportOpen(today: string): boolean {
	return phaseOf(today).kind === 'after';
}

export type ReportWriter = { name: string; image: string | null };

export type ReportStats = {
	/** 公開された記事の数（URL が登録されて公開日を過ぎたもの）。 */
	published: number;
	/** 予約も含めて埋まった枠の数。 */
	filled: number;
	/** 埋まった枠の割合（%）。 */
	coverage: number;
	writers: ReportWriter[];
	genres: { key: string; label: string; color: string; n: number }[];
	/** いちばん多かったジャンル。ジャンルが1つも付いていなければ null。 */
	topGenre: { key: string; label: string } | null;
	/** 枠が埋まった日。ツリーの飾りとモザイクに使う。 */
	filledDays: number[];
};

export function reportStats(entries: PublicEntry[], today: string): ReportStats {
	const published = entries.filter((e) => statusOf(e, today) === 'done').length;

	// PublicEntry には利用者 ID を載せていないので、表示名とアイコンの組で同じ人をまとめる。
	const writers = new Map<string, ReportWriter>();
	for (const e of entries) writers.set(`${e.author}\n${e.image ?? ''}`, { name: e.author, image: e.image });

	const genres = GENRES.map((g) => ({
		key: g.key,
		label: g.label,
		color: g.color,
		n: entries.filter((e) => e.genre === g.key).length
	}));
	// 同数なら GENRES の並び順で先のものを選ぶ（sort は安定）。
	const top = [...genres].sort((a, b) => b.n - a.n)[0];

	return {
		published,
		filled: entries.length,
		coverage: Math.round((entries.length / DAYS) * 100),
		writers: [...writers.values()],
		genres,
		topGenre: top && top.n > 0 ? { key: top.key, label: top.label } : null,
		filledDays: entries.map((e) => e.day)
	};
}
