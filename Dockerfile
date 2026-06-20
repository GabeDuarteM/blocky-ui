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

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/GabeDuarteM/blocky-ui"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
