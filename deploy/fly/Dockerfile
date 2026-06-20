# syntax=docker/dockerfile:1
# Build the ReviewX shared inbox server.
# Run from the MONOREPO ROOT: docker build -f deploy/fly/Dockerfile .

FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies (workspace-aware)
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/overlay/package.json ./packages/overlay/
COPY packages/server/package.json ./packages/server/
RUN npm ci --include=optional

# Copy source and build
COPY packages/overlay ./packages/overlay
COPY packages/server ./packages/server
RUN npm run build --workspace=@protofeedback/overlay
RUN npm run build --workspace=@protofeedback/server

# ---- Runtime image ----
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/overlay/dist ./packages/overlay/dist
COPY --from=builder /app/packages/overlay/package.json ./packages/overlay/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY package.json ./

# Persistent data lives on a mounted volume (Fly / Docker run -v)
VOLUME ["/data"]

ENV PORT=4400
ENV HOST=0.0.0.0
ENV REVIEWX_STORAGE=sqlite
ENV REVIEWX_DATA_DIR=/data

EXPOSE 4400
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4400/health || exit 1

CMD ["node", "packages/server/dist/cli.js", "--inbox"]
