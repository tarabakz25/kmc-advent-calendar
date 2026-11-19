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

## Vercel へのデプロイ

Vercel 上では自動で `@sveltejs/adapter-vercel`（東京リージョン `hnd1`）でビルドされます。Docker 用の設定はそのまま残っています。

1. **DB を用意する**: Vercel のダッシュボード → Storage → **Neon**(Postgres) を作ってプロジェクトに接続する(`DATABASE_URL` が自動で入ります)。Supabase などでも可。サーバーレスなので **プーラー経由の接続文字列**(Neon なら host に `-pooler` が付くもの)を使ってください。
2. **プロジェクトを作る**: GitHub リポジトリを Vercel に Import する(Framework は SvelteKit が自動で選ばれます)。CLI なら `vercel link`。
3. **環境変数を設定する**(Settings → Environment Variables、または `vercel env add`)

   | 変数 | 内容 |
   | --- | --- |
   | `DATABASE_URL` | 1 の接続文字列(Neon を接続した場合は自動) |
   | `ORIGIN` | 本番 URL(例: `https://kmc-advent.vercel.app`) |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google ログイン(下記)。リダイレクト URI は `<ORIGIN>/api/auth/callback/google` |
   | `CRON_SECRET` | `openssl rand -hex 32`。Slack 通知の Cron 用 |
   | `SLACK_BOT_TOKEN` / `SLACK_CHANNEL_ID` / `SLACK_POST_HOUR` | Slack 通知(任意) |

4. **テーブルを作る**(初回と、スキーマを変えたあと。手元から本番 DB に流します)

   ```sh
   vercel env pull .env.production.local
   bun --env-file=.env.production.local run db:migrate
   ```

5. デプロイ: `main` に push すれば自動でデプロイされます(CLI なら `vercel --prod`)。

Slack 通知は、Vercel では常駐できないので次の2つで動きます。

- **Vercel Cron**(`vercel.json`)が毎日 8:00 JST に `/api/cron/slack` を呼び、公開日を迎えた記事を投稿する(Hobby プランでは Cron は1日1回まで)
- 公開日を過ぎてから URL が登録されたときは、その場で投稿する

`SLACK_POST_HOUR` を変える場合は、`vercel.json` の `schedule`(UTC)も合わせてください。

## 学内サーバーへのデプロイ(Docker)

サーバーに Docker が入っていれば、これだけで動きます。

```sh
git clone https://github.com/tarabakz25/kmc-advent-calendar.git && cd kmc-advent-calendar
./deploy.sh
```

初回は公開URLと Google の OAuth クライアントID/シークレットを聞かれ、`.env` を作ります(`BETTER_AUTH_SECRET` と DB のパスワードは自動生成)。そのあと DB 起動 → マイグレーション → アプリ起動(ポート3000)まで行います。**更新するときも `./deploy.sh` を実行するだけ**です(`git pull` からやり直します)。

[Task](https://taskfile.dev/) が入っていれば次のコマンドも使えます。

| コマンド | 内容 |
| --- | --- |
| `task deploy` | `./deploy.sh` と同じ(フルデプロイ) |
| `task reload` | フロントだけ直したとき用。`git pull` してアプリを作り直すだけ(DB・マイグレーションには触らないので速い) |
| `task watch` | GitHub に push されたら自動で反映し続ける。変更が `src/`・`static/` だけなら reload、それ以外を含めば deploy。tmux の中などで動かしておく |
| `task stop` | 全部止める(DB のデータは残る) |

手作業でやる場合は `cp .env.example .env` して、`.env` を本番用に編集します。

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

### 独自ドメインで公開(Cloudflare Tunnel)

ポート開放やリバースプロキシなしで `https://advent.marusaba.net` のように公開できます。HTTPS 証明書も Cloudflare が用意します。

1. Cloudflare に `marusaba.net` を追加し、表示された2つのネームサーバーを、ドメインを取った会社(さくら等)の管理画面で設定する
2. Cloudflare の「Zero Trust」→「ネットワーク」→「Tunnels」→ トンネルを作成(種類は Cloudflared)。表示されるトークン(`eyJ...`)を `.env` の `TUNNEL_TOKEN` に入れる
3. 同じ画面の「公開ホスト名」で、ホスト名 `advent.marusaba.net`、サービス `HTTP` / `app:3000` を追加する
4. `.env` の `ORIGIN` を `https://advent.marusaba.net` にし、Google の「承認済みのリダイレクト URI」に `https://advent.marusaba.net/api/auth/callback/google` を追加する
5. `./deploy.sh`(または `docker compose up -d --build`)を実行する。トンネルもアプリと一緒に起動します

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

### Slack 通知(任意)

その日の記事が公開されたら(公開日になり、URL が登録されたら)、Slack のチャンネルに1記事1回だけ投稿します。URL の登録が遅れた記事も、登録された時点で投稿されます。

1. [Slack API](https://api.slack.com/apps) → **Create New App** → **From a manifest** → ワークスペースを選び、[`slack/manifest.yml`](slack/manifest.yml) の中身を貼り付けて作成
2. **Install to Workspace** して、表示された **Bot User OAuth Token**(`xoxb-...`)を `.env` の `SLACK_BOT_TOKEN` に入れる
3. 投稿先チャンネルの ID(チャンネル名を右クリック →「チャンネル詳細」の一番下、`C...`)を `SLACK_CHANNEL_ID` に入れる。非公開チャンネルなら `/invite @KMC Advent Calendar` で招待する
4. `./deploy.sh` で反映。`docker compose run --rm slack bun scripts/slack-bot.ts --test` でテスト投稿できます
5. 実際の通知と同じ見た目で試すなら `bun run slack:test`(サンプル記事を投稿。DB は変更しない)。`--dry-run` で投稿せずに中身だけ確認できます。文面は [`src/lib/server/slack-templates.ts`](src/lib/server/slack-templates.ts) で変えられます

- 投稿は `SLACK_POST_HOUR`(JST、既定 8 時)以降。0 にすると日付が変わった直後に投稿します。
- 設定しなければ `slack` コンテナは何もせず待機します。

## 毎年の更新

`src/lib/calendar.ts` の `CALENDAR_YEAR` を変えると、新しい年の空のカレンダーになります(去年のデータは残ります)。
