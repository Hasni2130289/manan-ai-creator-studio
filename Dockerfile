# Manan AI Creator Studio
# Multi-stage build: frontend (Vite) -> server (Node + Express + FFmpeg)

# ---- Stage 1: build the frontend ----
FROM node:24 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
# npm ci needs a lockfile; fall back to npm install until one is committed
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: production runtime (server + ffmpeg) ----
FROM node:24-slim
WORKDIR /app

# ffmpeg is required for the Faceless Video Maker render path
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Server dependencies (production only)
COPY server/package*.json ./server/
RUN cd server && (if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi)

# Server source + built frontend (served by the server from ../frontend/dist)
COPY server/ ./server/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/api/health').then(r => { process.exit(r.ok ? 0 : 1) }).catch(() => process.exit(1))"

CMD ["node", "server/src/index.js"]
