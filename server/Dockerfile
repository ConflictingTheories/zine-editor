# SVRN Publisher API
FROM node:22-slim

# sqlite3 (knex dialect) needs a compiler at install time even when production
# runs on Postgres — the dialect module is only *required* when configured.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

# Server-only deps (NOT the workspace root: that pulls electron/vite).
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Server code + migrations. Frontend is served from APP_DIST when provided
# (separate build), so it is intentionally NOT baked in here.
COPY server/*.cjs ./
COPY server/migrations/ ./migrations/

ENV NODE_ENV=production
ENV PORT=3000

# Writable locations: sqlite fallback, disk asset store, svrn packages.
RUN mkdir -p /app/server/data /app/server/data/assets /app/server/data/svrn-packages
VOLUME ["/app/server/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Migrations run on boot (server.cjs: db.migrate.latest()).
CMD ["node", "server.cjs"]
