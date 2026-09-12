ARG BUILDER_PLATFORM=linux/amd64

FROM --platform=${BUILDER_PLATFORM} node:22-alpine AS deps
WORKDIR /app
ARG BUN_VERSION=1.3.14
RUN apk add --no-cache g++ make python3 \
  && npm install --global bun@${BUN_VERSION}

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN bun run build

# Prepare better-sqlite3 on the target platform; the Next.js build runs on amd64.
FROM node:22-alpine AS native-sqlite
WORKDIR /app
ARG BETTER_SQLITE3_VERSION
RUN test -n "${BETTER_SQLITE3_VERSION}" \
  && npm install \
    --no-save \
    --omit=dev \
    --ignore-scripts \
    --package-lock=false \
    "better-sqlite3@${BETTER_SQLITE3_VERSION}" \
  && addon="prebuilds/linuxmusl-$(node -p process.arch).node" \
  && if [ ! -f "node_modules/better-sqlite3/${addon}" ]; then \
    apk add --no-cache g++ make python3 && \
    npm exec --yes --package=node-gyp@12.2.0 -- \
      node-gyp rebuild --release --directory=node_modules/better-sqlite3 || exit 1; \
    addon="build/Release/better_sqlite3.node"; \
  fi \
  && node -e 'const db = require("better-sqlite3")(); db.prepare("SELECT 1").get(); db.close()' \
  && mkdir -p "/native/$(dirname "${addon}")" \
  && cp "node_modules/better-sqlite3/${addon}" "/native/${addon}" \
  && rm -rf node_modules /root/.cache /root/.npm

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/GabeDuarteM/blocky-ui"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=native-sqlite --chown=nextjs:nodejs \
  /native/ \
  ./node_modules/better-sqlite3/

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
