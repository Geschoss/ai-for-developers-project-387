# syntax=docker/dockerfile:1
# Node version matches mise.toml.
FROM node:24.22.1-slim AS build
WORKDIR /repo
COPY mise.toml ./
RUN npm install --global "pnpm@$(sed -n 's/^pnpm = "\(.*\)"/\1/p' mise.toml)"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY spec/package.json spec/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter backend... --filter frontend...
COPY spec spec
COPY backend backend
COPY frontend frontend
# Vite and Nest follow `extends` to this file. It sits outside both packages.
COPY tsconfig.base.json ./
RUN pnpm --filter frontend --filter backend build \
 && pnpm --filter backend deploy --legacy --prod /app

FROM node:24.22.1-slim
ENV NODE_ENV=production PORT=3000 SPA_DIR=/app/public
WORKDIR /app
# Hexlet starts the image with only PORT and no database. Postgres stays idle
# when DATABASE_URL is already set (Render, compose).
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
COPY --from=build /repo/frontend/dist ./public
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
