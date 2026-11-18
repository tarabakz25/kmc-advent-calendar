FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# ビルド時にはDBへつながないので、ダミーの値でよい（実際の値は起動時に環境変数で渡す）。
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    ORIGIN=http://localhost:3000 \
    BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime \
    bun run build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER bun
CMD ["bun", "./build/index.js"]
