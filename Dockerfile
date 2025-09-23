# Stage 1: Base image with pnpm
FROM node:22-alpine AS base
RUN npm install -g pnpm@10.17.1
WORKDIR /app

# Stage 2: Dependencies installation
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Development stage
FROM base AS dev
# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Create directories that will be used by volume mounts
RUN mkdir -p src dist

EXPOSE 3000

# Default command - will be overridden by docker-compose
CMD ["pnpm", "run", "start:dev"]

# Stage 4: Build stage
FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 5: Production dependencies
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Stage 6: Production stage
FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package.json ./

USER nestjs

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main"]
