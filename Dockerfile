FROM node:22-alpine AS base
COPY package.json pnpm-lock.yaml ./
RUN corepack install
RUN corepack enable
WORKDIR /app

# Dev image size: ~700mb
FROM base AS dev
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

FROM base AS prod-build
COPY package.json pnpm-lock.yaml ./
# We use dev dependencies in building because nest-cli is a dev dependency
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Prod image size: ~330mb
# We cut dev dependencies and pnpm itself
FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
WORKDIR /app

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-build --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package.json ./

USER nestjs
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/main"]
