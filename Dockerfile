FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
# 同時接続数を絞る。既定(48)だと Docker/Colima の VM ネットワークで接続が落ち、
# bun がバックオフ付きで再試行し続けて 2 分以上かかることがある（絞ると数秒で終わる）。
RUN bun install --frozen-lockfile --network-concurrency=16

COPY . .
# ビルド時にはDBへつながないので、ダミーの値でよい（実際の値は起動時に環境変数で渡す）。
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    ORIGIN=http://localhost:3000 \
    BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime \
    bun run build

# アップロード（1ファイル 4MB まで、`#lib/upload.ts`）が通るよう、本文の上限を既定の 512K から上げる。
ENV NODE_ENV=production PORT=3000 BODY_SIZE_LIMIT=5M
EXPOSE 3000
USER bun
CMD ["bun", "./build/index.js"]
