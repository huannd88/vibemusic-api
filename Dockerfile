# =============================================================
# VibeMusic API — Multi-stage production Dockerfile
# =============================================================
# Supports both API and Worker modes via APP_ROLE env:
#   APP_ROLE=api     → REST + WebSocket (multi-instance)
#   APP_ROLE=worker  → Cronjobs only    (single-instance)
#   APP_ROLE=all     → Both (dev/single-server)
# =============================================================

# ─── Stage 1: Builder ────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (layer caching)
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json tsconfig.build.json* nest-cli.json* ./
COPY src ./src/
RUN npm run build

# ─── Stage 2: Production ─────────────────────────────

FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy dependency files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev && \
    npx prisma generate && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist/

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Default env
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_ROLE=api

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
