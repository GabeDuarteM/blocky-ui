ARG BUILDER_PLATFORM=linux/amd64

# 1) base image for the final container (native, multi-arch)
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# 2) builder base (FORCED to amd64 due to nextjs build issues on armv6/v7)
FROM --platform=${BUILDER_PLATFORM} node:22-alpine AS base-build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# 3) deps + build, all on amd64 still
FROM base-build AS deps-build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

FROM deps-build AS builder
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm build

# 4) the runner stage, multi-arch from now on
FROM base AS runner
ENV NODE_ENV=production

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
