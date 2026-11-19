/**
 * Slack に投稿するメッセージの文面（テンプレート）。
 * 公開のお知らせ（published）・毎朝の日次投稿（daily）・URL 未登録のリマインド（reminder）・
 * コンプリートのお知らせ（complete）がある。
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
 * （`bun run slack:test --dry-run` が JSON を出力する。`bun run slack:test` で実際に投稿。
 *  日次メッセージは `--kind daily --today 2026-11-26`、リマインドは `--kind reminder` で試せる）。
 *
 * mrkdwn の書き方: *太字*  _斜体_  <URL|リンクの文字>  :絵文字:
 */
export const SLACK_TEMPLATES = {
	/** 公開日を迎えた記事のお知らせ。 */
	published: {
		/** 一番上の見出し（太字で表示）。 */
		headline: ':christmas_tree: KMC Advent Calendar {year}　{day}日目の記事が公開されました！',
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

	/**
	 * チャンネルに投稿する日次メッセージ。開始の5日前・前日はカウントダウン、期間中は毎朝明日の予告。
	 * 使える置き換え（上の一覧に加えて）:
	 *   {daysLeft}  開始までの日数            例: 12
	 *   {days}      空いている日の一覧        例: 12/3(木)、12/5(土)
	 *   {count}     空いている日の数          例: 2
	 * 明日の予告（tomorrow / tomorrowOpen）では {day} {weekday} {title} {author} は明日の枠のもの。
	 */
	daily: {
		/** 開始前の見出し（5日前）。 */
		countdown: ':christmas_tree: KMC Advent Calendar {year} 開始まであと {daysLeft}日！',
		/** 開始前日の見出し。 */
		countdownTomorrow: ':christmas_tree: KMC Advent Calendar {year} いよいよ明日から開始です！',
		/** 期間中、明日の枠が予約済みのときの見出し。 */
		tomorrow: ':calendar: 明日 12月{day}日({weekday}) は {author} さんの「{title}」です！',
		/** 期間中、明日の枠が空いているときの見出し。 */
		tomorrowOpen: ':calendar: 明日 12月{day}日({weekday}) の枠がまだ空いています！',
		/** 明日より後に空き枠があるときの募集。 */
		openSlots: ':raising_hand: まだ空いている日（{count}枠）: {days}',
		/** 開始前に全枠が埋まったとき。 */
		full: ':tada: 全枠が埋まりました！',
		/** 一番下のリンク。{calendar} が空なら表示しない。 */
		footer: '<{calendar}|カレンダーを見る・予約する>'
	},

	/**
	 * 担当日が近いのに記事の URL が登録されていない人へのリマインド（3日前と前日）。
	 * 本人への DM と、Slack のユーザーが見つからなかったときのチャンネル投稿で同じ文面を使う。
	 * 使える置き換え（上の一覧に加えて）:
	 *   {when}  担当日まで      例: 3日後 / 明日
	 *   {page}  登録ページの URL（ORIGIN 未設定なら空）
	 */
	reminder: {
		/** 本文。 */
		text: ':pencil: {author} さん、{when}（12月{day}日({weekday})）はあなたの担当日です！\n記事「{title}」の URL がまだ登録されていません。書き終わったら登録をお願いします。',
		/** 一番下のリンク。{page} が空なら表示しない。 */
		footer: '<{page}|URL を登録する>'
	},

	/**
	 * 全日程の記事が出揃ったときのお知らせ（最終日の翌日以降に1回だけ）。
	 * 使える置き換え（上の一覧に加えて）:
	 *   {count}     記事の数              例: 25
	 *   {authors}   書いた人の数          例: 22
	 *   {articles}  記事一覧ページの URL（ORIGIN 未設定なら空）
	 * 記事の一覧（item）では {day} {title} {url} {author} がその記事のもの。
	 */
	complete: {
		/** 一番上の見出し（太字で表示）。 */
		headline: ':christmas_tree: KMC Advent Calendar {year} Completed! :christmas_tree:',
		/** 記事の一覧はスレッドに流すことを伝える一言。 */
		threadHint: ':thread: 全記事の一覧はスレッドへ',
		/** スレッドに流す記事の一覧の見出し。 */
		listHeader: ':christmas_tree: KMC Advent Calendar {year} 全{count}記事',
		/** 記事の一覧の1行（スレッドに流す）。 */
		item: '{day}日目　<{url}|{title}>　by {author}',
		/** 一覧の下のお礼。 */
		thanks: '書いてくれた {authors} 人のみなさん、読んでくれたみなさん、ありがとうございました！',
		/** 一番下のリンク。{articles} が空なら表示しない。 */
		footer: '<{articles}|記事一覧を見る>'
	},

	/** `bun scripts/slack-bot.ts --test` の投稿。 */
	test: ':christmas_tree: KMC Advent Calendar の Slack 連携のテスト投稿です。'
} as const;
