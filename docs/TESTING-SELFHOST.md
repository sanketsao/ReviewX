# Testing the self-hosted inbox

The enterprise self-host path is the same Docker image everywhere — local, AWS,
Azure, any Docker host. Validate it locally first; the cloud only changes *where*
the container runs, not how it behaves.

## Tier 1 — Local Docker + bundled Postgres (do this first)

```bash
cd deploy/docker-compose
cp .env.example .env
```

Edit `.env` — set `POSTGRES_PASSWORD` and `REVIEWX_ADMIN_TOKEN` to any strong
values (generate with `openssl rand -hex 16`). Then:

```bash
docker compose up -d
```

> zsh note: don't paste trailing `# comments` after a command — zsh treats `#`
> literally on the command line and the command will fail.

Wait ~15s for Postgres to go healthy, then verify:

```bash
curl http://localhost:4400/health
# → {"ok":true,"storage":"postgres (postgres://reviewsx:***@db:5432/reviewsx)"}
```

### Verification checklist

```bash
ADMIN=$(grep REVIEWX_ADMIN_TOKEN .env | cut -d= -f2)

# 1. Create feedback (reviewer — no token needed)
FID=$(curl -s -X POST http://localhost:4400/feedback \
  -H 'Content-Type: application/json' \
  -d '{"text":"test","anchor":{"selector":"body"},"project":"demo","author":"R","page":"/"}' \
  | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# 2. List it
curl -s "http://localhost:4400/feedback?project=demo"

# 3. Persistence — restart, then confirm the comment is still there
docker compose restart && sleep 10
curl -s "http://localhost:4400/feedback?project=demo"

# 4. Auth — claim a project with a token, then confirm lockdown
curl -s -X POST http://localhost:4400/feedback -H 'Content-Type: application/json' \
  -d '{"text":"x","anchor":{"selector":"body"},"project":"auth","author":"R","page":"/"}'
#   claim:
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH "http://localhost:4400/feedback/<ID>" \
  -H "X-PF-Token: secret123" -H 'Content-Type: application/json' \
  -d '{"status":"resolved","project":"auth"}'                       # 200
#   no token   → 401
#   wrong token → 403
#   secret123  → 200
```

Expected: feedback persists across restart; once a project is claimed by a token,
privileged ops (resolve/edit/export) require it. The deployment-wide
`REVIEWX_ADMIN_TOKEN` always works for admin ops on any project.

### Teardown

```bash
docker compose down          # keep data (volume persists)
docker compose down -v       # also delete the Postgres volume
```

## Tier 2 — External managed Postgres (proves the BYO-DB path)

Use a free Postgres (Supabase or Neon free tier — both give a `DATABASE_URL`,
no card). This is exactly how AWS RDS / Azure Database / Cloud SQL look to the app.

```bash
# in .env, set DATABASE_URL to the managed instance, then:
docker compose -f docker-compose.yml -f docker-compose.external-pg.yml up -d
```

Run the same checklist. If it passes here, it passes on any managed Postgres.

## Tier 3 — Real cloud (only for an end-to-end demo)

The app can't tell Tier 3 from Tier 2 — only do this if you want a live cloud URL.

- **Azure** (easiest free path): Azure Container Apps (point at the image) +
  Azure Database for PostgreSQL flexible server. Set `DATABASE_URL`,
  `REVIEWX_STORAGE=postgres`, `REVIEWX_ADMIN_TOKEN` as app settings.
- **AWS**: ECS Fargate or App Runner + RDS PostgreSQL (free tier eligible).
  Same env vars.

Point a test prototype's `data-endpoint` at the deployed URL and confirm feedback
lands and the VS Code sidebar shows it.
