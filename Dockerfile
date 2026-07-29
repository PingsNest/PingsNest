# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build React SPA + compile server TypeScript
COPY . .
RUN npm run build
RUN npx tsc --project tsconfig.server.json

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Create app directory with proper ownership for non-root node user
RUN chown -R node:node /app

# Switch to unprivileged non-root node user for container security
USER node

# Only install production dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts from builder stage
COPY --chown=node:node --from=builder /app/dist        ./dist
COPY --chown=node:node --from=builder /app/dist-server ./dist-server

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Health check probes for container liveness and readiness
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "dist-server/server/index.js"]

