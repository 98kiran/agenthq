# ── Build stage ──
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV STANDALONE=true
RUN npm run build

# ── Production stage ──
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy build output and deps
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/schema.sql ./schema.sql

# Create data dir for SQLite
RUN mkdir -p data

EXPOSE 3000
CMD ["node", "server.js"]
