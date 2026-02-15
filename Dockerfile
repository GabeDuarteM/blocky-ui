ARG BUILDER_PLATFORM=linux/amd64

# 1) base image for the final container (native, multi-arch)
FROM node:22-alpine AS base
WORKDIR /app

# 2) builder base (FORCED to amd64 due to nextjs build issues on armv6/v7)
FROM --platform=${BUILDER_PLATFORM} oven/bun:1-alpine AS base-build
WORKDIR /app

# 3) deps + build, all on amd64 still
FROM base-build AS deps-build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps-build AS builder
COPY . .
RUN bun run build

# 4) the runner stage, multi-arch from now on
FROM base AS runner
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
