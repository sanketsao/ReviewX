# ReviewX hosted inbox — self-hostable feedback collector.
# Build:  docker build -t reviewx-inbox .
# Run:    docker run -p 4400:4400 -e REVIEWX_STORAGE=sqlite -v reviewx-data:/data reviewx-inbox
# BYO-DB: docker run -p 4400:4400 -e REVIEWX_STORAGE=postgres -e DATABASE_URL=postgres://... reviewx-inbox

# ---- build stage: install + compile the whole workspace ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
RUN npm ci
RUN npm run build
# Drop dev tooling (typescript/esbuild/pg-mem); keep prod + optional (http-proxy, pg).
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NODE_NO_WARNINGS=1 \
    HOST=0.0.0.0 \
    PORT=4400 \
    REVIEWX_STORAGE=sqlite \
    REVIEWX_DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json
# Feedback data (sqlite file / per-project json) lives here — mount a volume.
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 4400
# Reviewer ingest is open by design; bound abuse with a per-IP write limit.
CMD ["node", "packages/server/dist/cli.js", "--inbox"]
