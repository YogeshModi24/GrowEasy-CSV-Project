FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @groweasy/types build
RUN pnpm --filter @groweasy/api build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app /app
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "--filter", "@groweasy/api", "start"]
