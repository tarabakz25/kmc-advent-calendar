#!/usr/bin/env bash
# リモート（GitHub）に新しいコミットが push されたら自動で反映する。
#
#   ./watch.sh        （既定は 60 秒ごとに確認。WATCH_INTERVAL=30 ./watch.sh で変更可）
#
# 変更が src/ と static/ の中だけなら ./deploy.sh --reload（アプリの作り直しだけ）、
# それ以外（drizzle/ のマイグレーション、compose.yaml、Dockerfile など）を含むなら ./deploy.sh でフルデプロイする。
# サーバーで動かし続けるときは tmux の中で起動するか、nohup ./watch.sh > watch.log 2>&1 & で。
set -uo pipefail
cd "$(dirname "$0")"

interval=${WATCH_INTERVAL:-60}
say() { printf '\033[1;32m==>\033[0m [%s] %s\n' "$(date '+%F %T')" "$*"; }

git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1 || {
	echo "エラー: 追跡ブランチがありません（git branch --set-upstream-to=origin/main など）" >&2
	exit 1
}

say "リモートの更新を ${interval} 秒ごとに確認します（Ctrl+C で終了）"
while true; do
	if git fetch --quiet; then
		# リモートにだけあるコミットがあるときだけ反映する
		if [[ $(git rev-list --count 'HEAD..@{u}') -gt 0 ]]; then
			changed=$(git diff --name-only 'HEAD...@{u}')
			# src/ と static/ 以外のファイル（grep -qv は実装によって結果が変わるので出力の有無で見る）
			if [[ -n $(grep -vE '^(src|static)/' <<<"$changed") ]]; then
				say "新しいコミットがあります（フロント以外の変更を含むのでフルデプロイ）"
				./deploy.sh || say "デプロイに失敗しました。次の確認でまた試します"
			else
				say "新しいコミットがあります（フロントだけなのでリロード）"
				./deploy.sh --reload || say "リロードに失敗しました。次の確認でまた試します"
			fi
		fi
	else
		say "git fetch に失敗しました。次の確認でまた試します"
	fi
	sleep "$interval"
done
