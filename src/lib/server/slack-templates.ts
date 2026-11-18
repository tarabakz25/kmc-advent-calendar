/**
 * Slack に投稿するメッセージの文面（テンプレート）。
 * 文言を変えたいときはこのファイルだけ編集すればよい。
 *
 * `{名前}` の部分が実際の値に置き換わる。使える置き換え:
 *
 *   {year}      カレンダーの年            例: 2026
 *   {day}       日付（12月の何日か）      例: 3
 *   {weekday}   曜日                      例: 木
 *   {title}     記事タイトル
 *   {url}       記事の URL
 *   {author}    書いた人の名前
 *   {genre}     ジャンル（未選択なら空）  例: テクノロジー
 *   {platform}  掲載先                    例: Zenn
 *   {calendar}  カレンダーページの URL（ORIGIN 未設定なら空）
 *
 * 見た目は https://app.slack.com/block-kit-builder で確認できる
 * （`bun run slack:test --dry-run` が JSON を出力する。`bun run slack:test` で実際に投稿）。
 *
 * mrkdwn の書き方: *太字*  _斜体_  <URL|リンクの文字>  :絵文字:
 */
export const SLACK_TEMPLATES = {
	/** 公開日を迎えた記事のお知らせ。 */
	published: {
		/** 一番上の見出し（太字で表示）。 */
		headline:
			':christmas_tree: KMC Advent Calendar {year}　12月{day}日({weekday}) の記事が公開されました！',
		/** 記事タイトル（太字・リンク付きで表示）。 */
		title: '<{url}|{title}>',
		/** タイトルの下に小さく並ぶ情報。空になった項目は省かれる。 */
		meta: ['by {author}', '{genre}', '{platform}'],
		/** メタ情報の区切り。 */
		separator: '  ·  ',
		/** 一番下のリンク。{calendar} が空なら表示しない。 */
		footer: '<{calendar}|カレンダーを見る>',
		/** 通知やスクリーンリーダー用のプレーンテキスト。 */
		fallback: '{headline}\n{title} {url}'
	},

	/** `bun scripts/slack-bot.ts --test` の投稿。 */
	test: ':christmas_tree: KMC Advent Calendar の Slack 連携のテスト投稿です。'
} as const;
