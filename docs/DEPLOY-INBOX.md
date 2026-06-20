# Deploy the shared inbox (Phase 4)

The BYO path hosts each **prototype** on the builder's own GitHub Pages (free, their
account). The only thing **you** run is one small **inbox** that collects feedback for all
of them. It's tiny (a few hundred MB RAM, a SQLite file on a volume) and scales to zero
when idle — realistically **~$0–5/month** for many projects.

You only do this **once**. After it, every `reviewx publish … --target github-pages
--endpoint https://<your-inbox>` points reviewers' feedback at it.

## What you need
- A **Fly.io account** (free signup). *(Render/Railway work too — see bottom.)*
- `flyctl` installed: `brew install flyctl`

## Steps (from `deploy/`)
```bash
cd deploy
fly auth login
fly launch --copy-config --no-deploy      # pick a unique app name (e.g. acme-reviewx-inbox)
fly volumes create reviewx_data --size 1 --region iad
fly deploy
```
Your inbox is now at **`https://<app-name>.fly.dev`**. Verify:
```bash
curl https://<app-name>.fly.dev/health      # {"ok":true,"storage":"sqlite (...)"}
```

## Optional hardening
- **Admin key** (lets you resolve/export across all projects):
  `fly secrets set REVIEWX_ADMIN_TOKEN=$(openssl rand -hex 16)`
- **Enterprise / data residency:** switch to Postgres — set `REVIEWX_STORAGE=postgres` and
  `fly secrets set DATABASE_URL=postgres://…` (e.g. a Fly Postgres or Neon). The Docker
  image already supports it (see `docker-compose.yml` for the local Postgres demo).

## Using it
```bash
reviewx publish ./my-prototype --target github-pages \
  --repo myorg/my-prototype \
  --endpoint https://<app-name>.fly.dev
```
→ prototype on `https://myorg.github.io/my-prototype/`, feedback collected in your inbox.

## Alternatives
- **Render:** New → Web Service → from this repo's `Dockerfile`; add a disk mounted at
  `/data`; set the same env vars. HTTPS + a `*.onrender.com` URL automatically.
- **Railway / any Docker host:** deploy the `Dockerfile`, mount a volume at `/data`, expose
  port 4400, set `HOST=0.0.0.0`.
