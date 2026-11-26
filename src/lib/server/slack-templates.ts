/**
 * Slack に投稿するメッセージの文面（テンプレート）。
 * 公開のお知らせ（published）・毎朝の日次投稿（daily）・URL 未登録のリマインド（reminder）・
 * 全枠が埋まったお知らせ（full）・コンプリートのお知らせ（complete）がある。
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
 *   {calName}   どのカレンダーか（カレンダーが1つだけなら空） 例: 2枚目のカレンダー
 *
 * 見た目は https://app.slack.com/block-kit-builder で確認できる
 * （`bun run slack:test --dry-run` が JSON を出力する。`bun run slack:test` で実際に投稿。
 *  日次メッセージは `--kind daily --today 2026-11-26`、リマインドは `--kind reminder` で試せる）。
 *
 * mrkdwn の書き方: *太字*  _斜体_  <URL|リンクの文字>  :絵文字:
 */
export const SLACK_TEMPLATES = {
	/**
	 * 公開日を迎えた記事のお知らせ。同じ日の記事が同時に公開されたら（カレンダーが複数あるとき）、
	 * 1つのメッセージに記事を並べる。title と meta は記事ごとに繰り返す。
	 */
	published: {
		/** 一番上の見出し（太字で表示）。 */
		headline: ':christmas_tree: KMC Advent Calendar {year}　{day}日目の記事が公開されました！',
		/** 記事タイトル（太字・リンク付きで表示）。 */
		title: '<{url}|{title}>',
		/** タイトルの下に小さく並ぶ情報。空になった項目は省かれる。 */
		meta: ['by {author}', '{calName}', '{genre}', '{platform}'],
		/** メタ情報の区切り。 */
		separator: '  ·  ',
		/** 一番下のリンク。{calendar} が空なら表示しない。 */
		footer: '<{calendar}|カレンダーを見る>',
		/** 通知やスクリーンリーダー用のプレーンテキスト。記事ごとに fallbackItem を改行でつなげる。 */
		fallback: '{headline}\n{items}',
		fallbackItem: '{title} {url}'
	},

	/**
	 * チャンネルに投稿する日次メッセージ。開始の5日前・前日はカウントダウン、期間中は毎朝明日の予告。
	 * 使える置き換え（上の一覧に加えて）:
	 *   {daysLeft}  開始までの日数            例: 12
	 *   {days}      空いている日の一覧        例: 12/3(木)、12/5(土)
	 *   {count}     空いている日の数          例: 2
	 * 明日の予告（tomorrow / tomorrowOpen / tomorrowMany）では {day} {weekday} {title} {author} は明日の枠のもの。
	 * カレンダーが複数あるとき、明日の枠が2つ以上埋まっていれば tomorrowMany に tomorrowItem を並べ、
	 * 空き枠の募集はカレンダーごとに openSlotsCal で1行ずつ出す。
	 */
	daily: {
		/** 開始前の見出し（5日前）。 */
		countdown: ':christmas_tree: KMC Advent Calendar {year} 開始まであと {daysLeft}日！',
		/** 開始前日の見出し。 */
		countdownTomorrow: ':christmas_tree: KMC Advent Calendar {year} いよいよ明日から開始です！',
		/** 期間中、明日の枠が予約済みのときの見出し。 */
		tomorrow: ':calendar: 明日 12月{day}日({weekday}) は {author} さんの「{title}」です！',
		/** 期間中、明日の枠が2つ以上埋まっているときの見出し（{count} は記事の数）。 */
		tomorrowMany: ':calendar: 明日 12月{day}日({weekday}) は {count} 本の記事が公開されます！',
		/** tomorrowMany の下に並べる1行。 */
		tomorrowItem: '• {author} さんの「{title}」（{calName}）',
		/** 期間中、明日の枠が空いているときの見出し。 */
		tomorrowOpen: ':calendar: 明日 12月{day}日({weekday}) の枠がまだ空いています！',
		/** 明日より後に空き枠があるときの募集。 */
		openSlots: ':raising_hand: まだ空いている日（{count}枠）: {days}',
		/** カレンダーが複数あるときの募集（カレンダーごとに1行）。 */
		openSlotsCal: ':raising_hand: {calName}でまだ空いている日（{count}枠）: {days}',
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
	 * カレンダーが複数あるときは {calName} も使える。
	 */
	reminder: {
		/** 本文。 */
		text: ':pencil: {author} さん、{when}（12月{day}日({weekday})）はあなたの担当日です！\n記事「{title}」の URL がまだ登録されていません。書き終わったら登録をお願いします。',
		/** 一番下のリンク。{page} が空なら表示しない。 */
		footer: '<{page}|URL を登録する>'
	},

	/**
	 * カレンダーの全枠が予約で埋まったときのお知らせ（カレンダーごと・最終日までに1回だけ）。
	 * 使える置き換え（上の一覧に加えて）:
	 *   {nth}      何枚目のカレンダーか  例: 1
	 *   {next}     次のカレンダーの番号  例: 2
	 *   {count}    枠の数                例: 25
	 *   {authors}  書く人の数            例: 22
	 * {calendar} はそのカレンダーのページ、{nextCalendar} は次のカレンダーのページ（無ければ空）。
	 * ラインナップ（item）では {day} {weekday} {title} {author} がその枠のもの。
	 */
	full: {
		/** 一番上の見出し（太字で表示）。 */
		headline: ':tada: KMC Advent Calendar {year}　{nth}枚目のカレンダーが埋まりました！ :tada:',
		/** 見出しの下の一言。 */
		thanks: '{authors} 人のみなさん、参加ありがとうございます！ 公開をお楽しみに :christmas_tree:',
		/** 次のカレンダーがあるときに添える一言（最後のカレンダーなら出さない）。 */
		nextOpen: ':raising_hand: {next}枚目のカレンダーで引き続き予約できます！',
		/** ラインナップはスレッドに流すことを伝える一言。 */
		threadHint: ':thread: ラインナップはスレッドへ',
		/** スレッドに流すラインナップの見出し。 */
		listHeader: ':calendar: KMC Advent Calendar {year}　{nth}枚目のカレンダーのラインナップ',
		/** ラインナップの1行（スレッドに流す）。 */
		item: '12/{day}({weekday})　{title}　by {author}',
		/** 一番下のリンク。{calendar} が空なら表示しない。 */
		footer: '<{calendar}|カレンダーを見る>',
		/** 次のカレンダーへのリンク。{nextCalendar} が空なら表示しない。 */
		nextFooter: '<{nextCalendar}|{next}枚目のカレンダーで予約する>'
	},

	/**
	 * カレンダーの全日程の記事が出揃ったときのお知らせ（カレンダーごと・最終日の翌日以降に1回だけ）。
	 * 使える置き換え（上の一覧に加えて）:
	 *   {nth}       何枚目のカレンダーか  例: 1
	 *   {count}     記事の数              例: 25
	 *   {authors}   書いた人の数          例: 22
	 *   {articles}  記事一覧ページの URL（ORIGIN 未設定なら空）
	 * 記事の一覧（item）では {day} {title} {url} {author} がその記事のもの。
	 */
	complete: {
		/** 一番上の見出し（太字で表示）。 */
		headline:
			':christmas_tree: KMC Advent Calendar {year}　{nth}枚目のカレンダー Completed! :christmas_tree:',
		/** 記事の一覧はスレッドに流すことを伝える一言。 */
		threadHint: ':thread: 全記事の一覧はスレッドへ',
		/** スレッドに流す記事の一覧の見出し。 */
		listHeader: ':christmas_tree: KMC Advent Calendar {year}　{nth}枚目のカレンダー 全{count}記事',
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
