#!/usr/bin/env bash
# 学内サーバーへのデプロイ・更新を1コマンドで行う。
#
#   ./deploy.sh
#
# 初回: .env を対話式で作り（秘密の値は自動生成）、DB とアプリを起動してマイグレーションまで行う。
# 2回目以降: git pull → ビルド → マイグレーション → 再起動。.env はそのまま使う。
#
# 対話なしで初回セットアップしたいときは、環境変数で渡す:
#   ORIGIN=https://advent.example.kamiyama.ac.jp GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mエラー:\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker が入っていません。https://docs.docker.com/engine/install/ を参照してください。"
docker compose version >/dev/null 2>&1 || die "docker compose (v2) が使えません。"
command -v openssl >/dev/null || die "openssl が必要です。"

# ───── .env（初回だけ作る） ─────
if [[ ! -f .env ]]; then
	say ".env を作成します"
	ask() { # ask 変数名 説明 — 環境変数があればそれを使い、なければ聞く
		local name=$1 label=$2 value=${!1:-}
		while [[ -z $value ]]; do read -rp "$label: " value; done
		printf '%s' "$value"
	}
	origin=$(ask ORIGIN "公開URL（例: https://advent.example.kamiyama.ac.jp）")
	origin=${origin%/}
	client_id=$(ask GOOGLE_CLIENT_ID "Google OAuth クライアントID")
	client_secret=$(ask GOOGLE_CLIENT_SECRET "Google OAuth クライアントシークレット")

	umask 077
	cat > .env <<EOF
ORIGIN="$origin"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
GOOGLE_CLIENT_ID="$client_id"
GOOGLE_CLIENT_SECRET="$client_secret"
EOF
	say ".env を作成しました（パスワード類は自動生成。Google の「承認済みのリダイレクト URI」に ${origin}/api/auth/callback/google を登録してください）"
else
	say "既存の .env を使います"
fi

# ───── 最新のコードを取得 ─────
if [[ -d .git ]] && git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
	say "最新のコードを取得しています（git pull）"
	git pull --ff-only
fi

# ───── ビルド → DB起動 → マイグレーション → アプリ起動 ─────
say "アプリをビルドしています"
docker compose build app

say "DB を起動しています"
docker compose up -d --wait db

say "DB のマイグレーションを実行しています"
docker compose run --rm --no-deps app bun run db:migrate

say "アプリを起動しています"
docker compose up -d app

# ───── 起動確認 ─────
for _ in $(seq 1 30); do
	if curl -fsS -o /dev/null http://127.0.0.1:3000/; then
		say "起動しました → http://<このサーバー>:3000 （公開URLはリバースプロキシから localhost:3000 へ）"
		exit 0
	fi
	sleep 2
done
docker compose logs --tail 50 app
die "アプリが応答しません。上のログを確認してください。"
