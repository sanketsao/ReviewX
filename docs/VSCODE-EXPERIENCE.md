# Spec: ReviewX builder experience (VS Code extension)

The CLI is the **engine**; this is the **experience** for non-technical builders
(user1/user3). Goal: no terminal, no manual installs, no token wrangling — just
**two buttons** and a small config. Reviewers (user2/user4) never see any of this.

## Principles

- **Builder-only.** Share/Publish live in the author surface (VS Code). Reviewers
  only ever get a link → the feedback widget (author/reviewer roles already exist).
- **Buttons over commands.** Status-bar items + a sidebar panel + command palette.
- **Secrets are never in the repo or the artifact.** Tokens live in VS Code
  SecretStorage; the published copy is always the reviewer copy (no author token).
- **One-time setup, then one click.** Per-user or per-org config is entered once.

## The two buttons

### ▶ Share  — *"let someone look right now"*
Ephemeral live link to the running prototype. **No account.**
1. Resolve the source (from config, else auto-detect: static `index.html`, or a
   dev server on a port).
2. Start the injecting server (static serve, or reverse-proxy the dev URL) — embeds
   the overlay, author role locally.
3. Ensure `cloudflared` — **auto-downloaded to extension storage on first use** (the
   user never installs anything).
4. Open a Cloudflare *quick tunnel* (anonymous, free) → public URL.
5. Sidebar shows the URL + **Copy** + **Stop**. Recipient opens as **reviewer**.

> Status: engine ready today (`createServer` + `startTunnel`). Extension wraps it.

### ⤴ Publish — *"a link that stays up"*
Persistent hosted copy with the widget baked in. **Branches on the configured mode**
(see below). Always: build a static artifact via `staticExport` (reviewer copy,
`--bundle-widget`), wire it to an inbox, upload, return the link.

## Config

**Project/org config — `.reviewx/config.json`** (committed; safe, no secrets):

```json
{
  "project": "orders-redesign",
  "source": { "type": "static", "dir": "dist" },
  "publish": {
    "mode": "company",
    "endpoint": "https://reviewx.internal.acme.com",
    "target": { "kind": "s3", "bucket": "acme-reviewx", "prefix": "orders-redesign",
                "baseUrl": "https://review.acme.com" }
  }
}
```

- `source.type`: `static` (a dir) · `build` (`{command, dir}`, e.g. `npm run build`→`dist`) · `dev` (`{url}` for proxy/snapshot).
- `publish.mode`: `managed` | `host` | `company`.
- `endpoint`: the **inbox** the widget reports to (managed mode fills this automatically).
- `target`: where the static files go (`cloudflare-pages` | `s3` | `azure-swa` | `netlify`).

**Secrets — VS Code SecretStorage** (never committed): ReviewX login token, host API
token, cloud creds. Set via "Connect…" flows, not by editing files.

## How Publish branches

### `managed` → Publish to ReviewX  *(non-technical default for startups)*
1. Ensure signed in (one-time browser/device-code login to reviewx.app).
2. `staticExport` with `endpoint` = an inbox ReviewX auto-provisions for the project.
3. Upload artifact to ReviewX hosting via API.
4. Return `https://reviewx.app/p/<id>`.
> Builder cost: **one ReviewX signup + one click.** We host + collect feedback.
> Needs: the managed SaaS backend (not built yet).

### `host` → Publish via the account they already have  *(recommended BYO)*
**Lead with GitHub Pages** — the builder already has a GitHub account (the prototype's repo)
and VS Code is already signed in, so there's **no new account, no token, no dashboard**:
1. Get the GitHub session (`getSession("github", ["repo"])`) — reuses VS Code's login.
2. `staticExport` with `endpoint` = our **shared hosted inbox**, `basePath = "/<repo>/"`.
3. Push the artifact to an orphan `reviewx-pages` branch → enable Pages → return
   `https://<owner>.github.io/<repo>/`.
> Builder cost: **one "Allow" click.** Prototype rides on their free GitHub Pages (we serve
> $0 egress); we host only the tiny inbox. Cloudflare/Netlify via OAuth = fallback for
> users without GitHub. (Full flow + caveats: PUBLISH-PLAN.md.)

### `company` → Publish to Company  *(enterprise; user3/user4)*
1. Read the committed `endpoint` + `target` (set once by IT).
2. `staticExport(endpoint)` → deploy to the internal target. Two delivery options:
   - **Direct**: extension deploys using org creds (workload identity / SecretStorage), or
   - **Handoff**: extension writes the artifact to `out/`; the company's existing
     pipeline/CI ships it (zero new creds in the extension).
3. Return the internal URL — already behind the company **IdP/SSO**, so only employees
   reach it (that's the IP protection). Feedback lands in their own DB.
> Builder cost: **zero per-user setup** after IT's one-time config. All pieces exist
> today (inbox + Postgres + JWT + `staticExport`).

## Source detection (so non-devs don't choose)

- `index.html` at root, no build script → **static**.
- `package.json` with a `build` script (Vite/Next/CRA) → **build**, then publish `dist`/`out`.
- A running dev server detected on a port, or backend-dependent app → **Share** (live)
  or **snapshot** (Engine B) for a frozen mockup.

## Feedback, back in VS Code (cross-cutting)

A sidebar tree reads the inbox (`GET /feedback?project=…`), grouped open/resolved,
live-refreshing as reviewers comment. Click an item to read the thread; resolve/archive
inline. Closes the loop without leaving the editor.

## Security notes

- Published artifact = reviewer copy; **author token never embedded**.
- All credentials in SecretStorage, per-machine; org config in the repo carries **no secrets**.
- Reviewers can't reach Share/Publish/config — enforced by the author/reviewer split.

## Build phases

1. **Share button** (tunnel + auto-cloudflared + sidebar link). Biggest immediate win,
   no account, engine already exists.
2. **Feedback sidebar** (read/resolve from the inbox).
3. **Publish → Company** (config-driven deploy to internal target; enterprise-ready).
4. **Publish → Connect host** (Cloudflare Pages first).
5. **Publish → ReviewX (managed)** — gated on the SaaS hosting decision.
