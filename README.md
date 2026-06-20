# ReviewSX

**Zero-install feedback + guided-tour overlay for web prototypes.** Share a running
prototype; reviewers leave **pinned, threaded UI feedback** and walk a **guided tour** —
no clone, no account, no extension. Built for non-developers sharing vibe-coded prototypes.

The overlay mounts in a **Shadow DOM** (so it never collides with the prototype's CSS) and
has two modes — **Feedback** (click any element → drop a numbered comment with replies and
resolve/archive) and **Tour** (a guided walkthrough that follows the author's steps, even
across tabs/routes).

Two personas, auto-detected:
- **Author** (localhost) — full tools: review comments, build tours, export.
- **Reviewer** (shared link) — just "Give feedback" and "Take the tour".

---

## Three ways to use it

The overlay is one universal client; only where feedback is **stored** changes.

| Tier | Best for | Storage | Hosting |
|------|----------|---------|---------|
| **CLI + tunnel** | Live review sessions, solo devs | Local JSON files | None — your machine, via a tunnel |
| **CDN snippet** | Startups, "just paste a tag" | Browser, or a hosted inbox | Optional inbox |
| **Self-hosted inbox** | Small enterprises (data residency) | SQLite or **your Postgres** | You run a container |

### 1. CLI + tunnel (no backend)

Serve a static prototype or reverse-proxy a dev server; share a public URL.

```bash
npm install && npm run build

# static directory
node packages/server/dist/cli.js ./my-prototype --share

# or front an existing dev server (Vite/Next/CRA…)
node packages/server/dist/cli.js --proxy http://localhost:5173 --share
```

Feedback is written to `./my-prototype/.protofeedback/*.json`. `--share` opens a
`*.trycloudflare.com` URL so reviewers need nothing installed.

### 2. CDN snippet

Drop one tag into any page. With no endpoint it stores per-browser (great for "try it");
add `data-endpoint` to collect shared feedback in an inbox.

```html
<!-- reviewer copy -->
<script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx
        data-endpoint="https://inbox.example.com" data-project="my-proto"></script>

<!-- author copy: add a private token for resolve/edit/export -->
<script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx data-role="author"
        data-endpoint="https://inbox.example.com" data-project="my-proto"
        data-token="keep-this-private"></script>
```

Config can also be set via a `window.ReviewSX = { endpoint, project, role, token }` object.

### 3. Self-hosted inbox (file / SQLite / Postgres)

One deployment collects feedback from snippet prototypes on any origin, namespaced by
`project`. Pick a storage engine:

```bash
# JSON files (default)
node packages/server/dist/cli.js --inbox --data-dir ./data

# single SQLite file (durable, queryable, one container)
node packages/server/dist/cli.js --inbox --storage sqlite --data-dir ./data

# your Postgres (bring-your-own-database)
node packages/server/dist/cli.js --inbox --storage postgres \
  --database-url postgres://user:pass@host:5432/reviewsx
```

**Docker / Compose** (enterprise BYO-DB demo — inbox + Postgres in one command):

```bash
docker compose up --build      # inbox on :4400, persisting to Postgres
# or just the inbox with SQLite on a volume:
docker build -t reviewx-inbox .
docker run -p 4400:4400 -e REVIEWX_STORAGE=sqlite -v reviewx-data:/data reviewx-inbox
```

Inbox configuration is env-driven (container-friendly):

| Env | Purpose |
|-----|---------|
| `PORT`, `HOST` | Bind address (`HOST=0.0.0.0` in containers) |
| `REVIEWX_STORAGE` | `file` \| `sqlite` \| `postgres` |
| `REVIEWX_DATA_DIR`, `REVIEWX_SQLITE_PATH` | File / SQLite location |
| `DATABASE_URL` | Postgres connection string |
| `REVIEWX_WRITE_RATE_LIMIT` | Max writes per IP per minute (default 60) |
| `REVIEWX_ADMIN_TOKEN` | Deployment-wide admin key (author ops, any project) |
| `REVIEWX_JWT_SECRET` | Accept HS256 JWTs (from your IdP) for author ops |

---

## Auth model

- **Reviewer feedback (POST) is always open** — that's the zero-install promise. Abuse is
  bounded by per-IP rate limiting.
- **Author ops** (resolve/edit, tours, settings, export) require one of:
  - a **per-project token** — trust-on-first-use: the first tokened request claims the
    project (stored with the data, in your DB); after that it must match;
  - the **deployment admin key** (`REVIEWX_ADMIN_TOKEN`); or
  - a valid **HS256 JWT** (`REVIEWX_JWT_SECRET`) — so an enterprise can authorize with
    tokens its own backend issues. (RS256/JWKS/full OIDC are out of scope.)

---

## Monorepo layout

```
packages/
  overlay/          # Shadow-DOM overlay; builds overlay.js (server) + reviewsx.js (CDN)
  server/           # injecting static/proxy server, /__pf API, --inbox, storage adapters
  reviewsx/          # public npm/CDN snippet package (dist/reviewsx.js)
  vscode-extension/ # authoring commands + feedback view
skills/reviewsx/     # Claude Code auto-inject skill
examples/           # static-proto, finance-app (multi-tab SPA), snippet-demo
```

Storage is pluggable behind a `StorageAdapter` interface (`packages/server/src/store.ts`):
file (`Store`), `SqliteStore`, `PostgresStore` — all interchangeable.

## Develop

```bash
npm ci
npm run build           # all workspaces
npm test                # server unit tests (file + sqlite + postgres-via-pg-mem + jwt)
npm run typecheck -w @protofeedback/overlay
```

## License

MIT
