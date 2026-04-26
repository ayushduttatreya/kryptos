# ──────────────────────────────────────────────
# Stage 1 — deps: install production dependencies
# ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ──────────────────────────────────────────────
# Stage 2 — build: copy source and build
# ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
RUN npm ci --only=production

# ──────────────────────────────────────────────
# Stage 3 — production: minimal final image
# ──────────────────────────────────────────────
FROM node:20-alpine AS production

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S kryptos && \
    adduser -S kryptos -u 1001

WORKDIR /app

# Copy only what is needed — no devDeps, no tests, no source maps
COPY --from=build --chown=kryptos:kryptos /app/node_modules ./node_modules
COPY --from=build --chown=kryptos:kryptos /app/src ./src
COPY --from=build --chown=kryptos:kryptos /app/package.json ./

USER kryptos

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "src/index.js"]
