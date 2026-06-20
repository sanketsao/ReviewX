# ReviewSX — Claude Code Project Guide

## What this product does

ReviewSX lets any prototype builder share a running prototype with reviewers — with zero setup on the reviewer's side. The reviewer gets a link, opens it in a browser, clicks elements to leave pinned feedback, and follows a guided tour the builder authored. No cloning, no installs, no accounts.

Three actions the builder takes:
1. **Publish** — guided walkthrough ("tour") of what to look at, authored once
2. **Position** — reviewers leave pinned comments on any element
3. **Produce feedback** — builder sees all comments in the VS Code sidebar in real-time

## Who it's for

### Target Customer 1 — Startup / solo founder

- **Builder (User1):** built a prototype, running on localhost, pushed to a public GitHub repo
- **Reviewer (User2):** boss or investor, usually travelling, no VS Code, just needs a link
- **How it works:** Builder hits "Publish to GitHub Pages" → shares the URL → reviewer opens it in any browser, sees the overlay and tour, leaves comments → builder sees feedback in VS Code sidebar
- **Storage:** ReviewSX hosted inbox at `inbox.reviewsx.app` (free, each project isolated by a unique key)
- **IP sensitivity:** Low — startup is fine with a public GitHub repo and the shared hosted inbox

### Target Customer 2 — Mid-market (50-200 employees)

- **Builder (User3):** prototype on localhost, in a GitHub repo (could be private)
- **Reviewer (User4):** busy manager, prefers a company-hosted link, won't clone repos
- **Company has:** AWS or Azure infrastructure, an Identity Provider (Okta, Azure AD, etc.)
- **How it works:** IT deploys the ReviewSX inbox via Docker Compose to their own AWS/Azure, pointing at their existing managed Postgres. Builder configures the VS Code extension to use the company's self-hosted inbox URL. Reviewer gets the link, SSO handles auth.
- **Storage:** Self-hosted inbox on company infrastructure — data never leaves their network
- **IP sensitivity:** High — private repo, internal hosting, SSO required

## Architecture

```
Reviewer browser ──(GitHub Pages URL or Tailscale Funnel URL)──▶ Prototype HTML
                                                                       │
                                              ReviewSX overlay injected │
                                              (Shadow DOM, no style bleed)
                                                                       │
                                              Feedback POSTed to ──────▼
                                              inbox.reviewsx.app (hosted)
                                              OR self-hosted inbox (enterprise)
                                                                       │
VS Code sidebar ◀──────────── polls / file-watches ────────────────────┘
```

Two serve modes:
- **Static:** serve a directory; inject overlay into every HTML page
- **Proxy:** reverse-proxy a running dev server (Vite, Next.js, etc.); inject overlay into HTML responses; HMR passes through untouched

## Monorepo layout

```
packages/
  overlay/          Shadow-DOM overlay UI (TS → IIFE). Builds overlay.js + reviewsx.js
  server/           Injecting proxy + static server + feedback API + tunnel + CLI
  reviewsx/         Public npm/CDN snippet package (dist/reviewsx.js)
  vscode-extension/ VS Code authoring commands + feedback TreeView

deploy/
  fly/              Fly.io Dockerfile + fly.toml for hosted inbox
  docker-compose/   Enterprise self-host: bundled Postgres or external Postgres

skills/reviewsx/    Claude Code auto-inject skill (/reviewsx slash command)
```

Builder prototype data lives in the **prototype's repo** (not ours):
```
<prototype>/.protofeedback/
  tour.json       guided steps: { selector, title, body, order }
  feedback.json   comments: { id, anchor, text, author, status, createdAt }
  secret.json     TOFU project token (gitignored)

<prototype>/.reviewsx/
  config.json     { project, publish: { endpoint } }
```

## How to build

```bash
# Install deps
npm install

# Build overlay bundles (overlay.js + reviewsx.js)
npm run build -w @protofeedback/overlay

# Build server
npm run build -w @protofeedback/server

# Build + package VS Code extension (VSIX)
cd packages/vscode-extension
npm run bundle
node build-vsix.mjs
# → protofeedback-vscode-0.1.0.vsix
```

## Live infrastructure — DO NOT RENAME

These names are in the live Fly.io deployment. Changing them requires a migration:

| Thing | Value | Why frozen |
|---|---|---|
| Fly app | `reviewx-inbox` | Can't rename Fly apps |
| Fly volume | `reviewx_data` | Would lose live SQLite data |
| SQLite file | `reviewx.sqlite` | Live data on the volume |
| Env vars | `REVIEWX_*` | Set as Fly secrets, changing requires `fly secrets set` |
| Hosted inbox URL | `https://inbox.reviewsx.app` | Builders have this saved in `.reviewsx/config.json` |

## Current deployment state

- **Hosted inbox:** `https://inbox.reviewsx.app` → `reviewx-inbox.fly.dev` (Fly.io, scale-to-zero, 256MB, SQLite on persistent volume)
- **Domain:** `reviewsx.app` on Cloudflare (DNS only, no proxy)
- **Tunnel for live sharing:** Tailscale Funnel (primary), cloudflared quick tunnel (fallback)
- **GitHub Pages publish:** one-click from VS Code; pushes to `reviewsx-pages` orphan branch

## Key source files

| File | What it does |
|---|---|
| `packages/overlay/src/app.ts` | Main overlay UI — tour mode, feedback mode, pin rendering |
| `packages/overlay/src/backend.ts` | Storage abstraction — local file, localStorage, or REST inbox |
| `packages/server/src/server.ts` | Static server + reverse proxy + HTML injection |
| `packages/server/src/inbox.ts` | Multi-tenant feedback API (rate limiting, TOFU auth) |
| `packages/server/src/publish.ts` | Static export + overlay injection for GitHub Pages |
| `packages/server/src/gh-pages.ts` | GitHub Pages deploy via API |
| `packages/server/src/tunnel.ts` | Tailscale Funnel + cloudflared tunnel wrappers |
| `packages/vscode-extension/src/extension.ts` | All VS Code commands (start, share, publish, stop, inbox setup) |
| `packages/vscode-extension/src/feedbackView.ts` | Sidebar TreeView — groups feedback by open/resolved |

## Test scenarios (manual)

### Customer 1 flow (startup / GitHub Pages)
1. Open a static prototype folder in VS Code
2. Click **Start with overlay** → browser opens with overlay toolbar
3. Switch to Feedback mode → click an element → leave a comment → submit
4. Verify comment appears in VS Code sidebar under "Open"
5. Click **Publish to GitHub Pages** → confirm modal → wait for deploy → open URL
6. On a different machine/browser: open the GitHub Pages URL → tour auto-starts → leave feedback
7. Back in VS Code: refresh sidebar → new feedback appears from hosted inbox

### Customer 2 flow (enterprise self-host)
1. Deploy inbox via `docker compose up -d` in `deploy/docker-compose/`
2. In VS Code: click server icon → "Self-host (enterprise)" → "Docker Compose" → enter URL
3. Repeat feedback flow → verify feedback goes to self-hosted inbox, not hosted inbox

### Tailscale Funnel share
1. Start prototype with overlay
2. Click broadcast icon → "Opening public URL via Tailscale Funnel…"
3. Copy URL → open on another device → overlay appears → leave feedback → appears in sidebar

## What's next (not yet built)

- VS Code Marketplace listing (VSIX ready, publisher account needed)
- reviewsx.app landing page
- SSO/Identity Provider integration for enterprise (Customer 2)
- JetBrains plugin
- Marketing agent for reviewsx.app
