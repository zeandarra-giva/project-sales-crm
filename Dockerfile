# ---- Install iii engine ----
FROM debian:bookworm-slim AS iii-builder
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://install.iii.dev/iii/main/install.sh | sh

# ---- Build Steps ----
FROM node:20-bookworm-slim AS app-build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY config.yaml motia.config.ts prisma.config.ts ./
COPY tsconfig.json ./
COPY steps/ ./steps/
COPY lib/ ./lib/
COPY types.d.ts ./

RUN npx motia dev

# ---- Build Frontend ----
FROM node:20-bookworm-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Production ----
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy iii engine binary
COPY --from=iii-builder /root/.local/bin/iii /usr/local/bin/iii

# Copy node_modules and prisma
COPY --from=app-build /app/package.json /app/package-lock.json* ./
COPY --from=app-build /app/node_modules ./node_modules
COPY --from=app-build /app/prisma ./prisma

# Regenerate Prisma client for this platform
RUN npx prisma generate

# Copy built motia steps
COPY --from=app-build /app/dist ./dist

# Copy production config
COPY config-production.yaml ./config.yaml

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 3111 3112 3113

CMD ["sh", "-c", "npx prisma migrate deploy && iii --config config.yaml"]
