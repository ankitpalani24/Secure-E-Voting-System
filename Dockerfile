# Multi-stage production Dockerfile for Secure E-Voting System
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm ci --omit=dev && cd server && npm ci --omit=dev

# Production image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Security: Run as non-root user
USER node

# Copy application files
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/server/node_modules ./server/node_modules
COPY --chown=node:node server ./server
COPY --chown=node:node client ./client
COPY --chown=node:node package*.json ./
COPY --chown=node:node index.html ./

# Container readiness healthcheck (checks process liveness and DB connectivity)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/readyz || exit 1

EXPOSE 5000

CMD ["node", "server/server.js"]
