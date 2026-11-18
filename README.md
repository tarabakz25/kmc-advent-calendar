# KMC Advent Calendar

神山まるごと高専のアドベントカレンダー。記事は各メディア(Qiita / Zenn / note など)で書き、このサイトにはそのURLを登録して一覧できるようにします。

- ログインは **Google アカウントのみ**で、`@kamiyama.ac.jp`(サブドメイン可)限定です。パスワードはありません。
- 1日1枠。予約 → 執筆 → URL登録。公開日になると、カレンダーから記事へ直接飛べます。
- SvelteKit(Svelte 5) + Tailwind 4 + Drizzle(Postgres) + better-auth。

## 開発

```sh
bun install
cp .env.example .env     # GOOGLE_CLIENT_ID / SECRET を入れる（下記「Google でログイン」）
docker compose up -d db  # Postgres
bun run db:push          # テーブル作成
bun run dev              # http://localhost:5173
```

- `?today=2026-12-10` を付けると、開発中だけ日付を差し替えて見た目を確認できます。
- ログインには Google の設定が必要です。開発中は `http://localhost:5173/api/auth/callback/google` をリダイレクト URI に登録してください。

## 学内サーバーへのデプロイ(Docker)

サーバーに Docker が入っていれば、これだけで動きます。

```sh
git clone <このリポジトリ> && cd kmc-advent-calendar
cp .env.example .env
```

`.env` を本番用に編集します。

| 変数 | 内容 |
| --- | --- |
| `ORIGIN` | 利用者がアクセスするURL(例: `https://advent.example.kamiyama.ac.jp`)。ログインリンクもこのURLで作られます |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` で作った値 |
| `POSTGRES_PASSWORD` | DBのパスワード |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google ログイン(下記)。これがないとログインできません |

```sh
docker compose up -d --build                       # DBとアプリを起動(ポート3000)
docker compose run --rm app bun run db:migrate     # 初回と、スキーマ更新のあとに実行
```

- アプリは `3000` 番ポートで待ち受けます。学内で使うホスト名やHTTPSは、サーバー既存のリバースプロキシ(nginx / Caddy など)から `localhost:3000` へ流してください。
- 更新: `git pull && docker compose up -d --build && docker compose run --rm app bun run db:migrate`
- バックアップ: `docker compose exec db pg_dump -U postgres kmc_advent > backup.sql`

### Google でログイン(学校の Google アカウントで1クリック)

スタッフの作業は要らず、自分の Google アカウントで設定できます。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作る
2. 「Google Auth Platform」→ 対象を **外部** にして、アプリ名とサポートメールを入れ、**本番環境に公開**する(メールとプロフィールだけの権限なので審査は不要)
3. 「クライアント」→ 作成 → 種類は **ウェブアプリケーション**
4. 「承認済みのリダイレクト URI」に `<ORIGIN>/api/auth/callback/google` を追加する
5. 表示された値を `.env` の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` に入れて、アプリを再起動する

注意点:

- リダイレクト URI は、`localhost` 以外では **`https://` の公開ドメイン**だけ使えます(`http://192.168.x.x` や `.local` は不可)。手元での開発・確認は `http://localhost:5173/api/auth/callback/google` で動きます。
- 学校の Google Workspace 側で「未承認のサードパーティアプリ」を制限していると、生徒がログインしようとしてブロックされます。その場合は管理者にこのクライアントIDの許可を頼んでください。
- 学校のドメイン以外のアカウント(個人の Gmail など)は、ログインできません。

## 毎年の更新

`src/lib/calendar.ts` の `CALENDAR_YEAR` を変えると、新しい年の空のカレンダーになります(去年のデータは残ります)。
