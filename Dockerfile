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

# Build better-sqlite3 on the target platform; the Next.js build runs on amd64 and would otherwise trace the wrong native addon.
FROM node:22-alpine AS native-sqlite
WORKDIR /app
ARG BETTER_SQLITE3_VERSION
RUN test -n "${BETTER_SQLITE3_VERSION}" \
  && apk add --no-cache --virtual .build-deps g++ make python3 \
  && npm_config_build_from_source=true npm install \
    --no-save \
    --omit=dev \
    --package-lock=false \
    "better-sqlite3@${BETTER_SQLITE3_VERSION}" \
  && mkdir /native \
  && cp node_modules/better-sqlite3/build/Release/better_sqlite3.node /native/ \
  && rm -rf node_modules /root/.cache /root/.npm \
  && apk del .build-deps

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
  /native/better_sqlite3.node \
  ./node_modules/better-sqlite3/build/Release/better_sqlite3.node

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
