# Feature Plan: `reviewx publish` — share a prototype for async review

## Problem

A prototype built in VS Code only runs on `localhost`. The tunnel (`--share`) covers
*live* sessions but not async review (laptop must stay on, URL is ephemeral). The first
real step to gathering feedback is getting a **persistent, shareable copy** of the
prototype in front of reviewers — with the ReviewX widget already baked in.

## Hard constraint

Element-anchored feedback requires the widget to run in the **same document** as the
prototype. A cross-origin `<iframe>` wrapper can't read/pin to elements inside it
(same-origin policy). Therefore we **inject the widget into the published artifact** —
never wrap the prototype in a foreign iframe.

## Decisions (locked)

- **Two engines**: high-fidelity **static export** (default) + universal **DOM snapshot**
  fallback, so the tool never fails to publish.
- **Recommended v1 BYO path = GitHub Pages + a shared hosted inbox (hybrid).** See below.
- **Pluggable upload target**; keep the tunnel as the complementary "live session" mode.
- **Fully-managed hosting is deferred** — infra is cheap (~$5–70/mo for 1,000 prototypes),
  but the real costs are the SaaS backend + content moderation. Turn it on with revenue.

## Recommended v1: GitHub Pages + shared inbox (the non-technical BYO path)

The adoption killer for BYO is dropping a non-developer into a host's dashboard
(Cloudflare/Netlify signup is overwhelming). We avoid it entirely by **using the account
the builder already has — GitHub** — and the GitHub session **VS Code is already signed
into**. And we **split hosting**:

| Part | Hosted by | Cost to us |
|---|---|---|
| The prototype (bandwidth-heavy, easy to host) | the user's **GitHub Pages** (free, their account) | $0 |
| The inbox (a server a non-dev can't self-host; tiny) | **us** — one shared multi-tenant instance | pennies |

This gets frictionless startup adoption *and* near-zero cost: we never serve prototype
egress, only the small feedback API. (Customer 2 / enterprise still self-hosts both.)

### What user1 sees
1. Click **Publish**. 2. First time only: *"Publish to GitHub Pages as @user1?"* → Allow.
3. "Building… deploying…" (~30–60s). 4. A link `https://user1.github.io/<repo>/` + Copy.
No new account, no token, no dashboard, no DNS.

### GitHub-auth + deploy flow (spec)
1. **Token**: `vscode.authentication.getSession("github", ["repo"], { createIfNone: true })`
   — reuses VS Code's built-in GitHub login; `repo` scope covers push + the Pages REST API.
2. **Repo**: read `origin` from the workspace git remote → `{owner, repo}`.
3. **Build**: `staticExport` with `project = <owner>-<repo>` slug, `endpoint = <shared inbox>`,
   `bundleWidget = true`, **`basePath = "/<repo>/"`** (see caveat).
4. **Deploy from a branch**: push the artifact to an **orphan `reviewx-pages` branch**
   (only the built files, force-updated each publish — never pollutes prototype history),
   via the Git Data API or a token-authed `git push`.
5. **Enable Pages**: `POST/PUT /repos/{owner}/{repo}/pages` with
   `source: { branch: "reviewx-pages", path: "/" }`; poll `GET …/pages` until built.
6. Return `html_url` (e.g. `https://owner.github.io/repo/`) + Copy.

### Caveats (call out in UI)
- **Base path bug:** project Pages serve under `/<repo>/`, so the bundled widget's
  root-absolute `/reviewx.js` would 404. **`staticExport` needs a `basePath` option** that
  prefixes injected asset URLs (`/<repo>/reviewx.js`). Required before GH Pages works.
- **Private repos:** free GitHub serves Pages **public** only (private Pages = Pro/Team/
  Enterprise). Fine for Customer 1 (loose IP); private is the enterprise self-host path.
- Org settings may disable Pages — handle the API error with a clear message.
- First build latency ~30–60s.

### Shared inbox
We run one multi-tenant inbox (the Dockerized one) at e.g. `inbox.reviewx.app`. The
published widget points `data-endpoint` there with `data-project = <owner>-<repo>`. user1's
first author action claims the project's TOFU token; reviewers post openly (rate-limited).
This single small instance covers all BYO users — the only thing we pay for.

## Command

```
reviewx publish [dir]            # static-export a built directory
reviewx publish --snapshot       # freeze a running prototype (static or --proxy)
  --endpoint <url>               # inbox the widget posts feedback to (shared review)
  --project  <id>                # project id for the inbox
  --target   <name>              # upload target (spike: cloudflare-pages | dir)
  --routes   "/,/#/pricing"      # snapshot: routes to capture (default: auto-discover)
  --out      <dir>               # write the artifact locally instead of uploading
```

Pipeline (shared): **resolve source → inject reviewer snippet → upload → print URL.**

## Engine A — static export (full fidelity; static sites & client SPAs)

1. Source = a static dir or a framework build output (`dist/`). v1 assumes already built;
   docs say "run your build first."
2. Copy to a temp staging dir.
3. Inject the reviewer snippet before `</body>` in every `.html` — **reuse
   `server/src/inject.ts`** (`injectOverlay`/`isHtml`). Reviewer role, **no token** (the
   published copy is public — it must never carry the author secret).
4. Upload staging dir to the target.

## Engine B — DOM snapshot (universal; works for backend/dynamic apps as a *mockup*)

1. Spin up our injecting server in front of the prototype (static, or `--proxy <devUrl>`).
2. Headless browser visits each route, waits for network idle, then serializes the
   **rendered DOM + inlined CSS + assets** into self-contained HTML (SingleFile-style).
   - Strip the prototype's own JS (frozen mockup → predictable), **keep the widget**.
   - One file per route; preserve each route's `page` key (`pathname+hash`) so existing
     **feedback pins and cross-tab tours** still resolve.
3. Output a static dir → same inject + upload as Engine A.
4. Auto-discover routes from saved tour steps + feedback `page` values; `--routes` overrides.

**Open questions for the spike:** multi-route routing on a static host (hash vs. file-per-
route + shim); asset inlining vs. copying; JS-strip policy. Snapshot needs a headless
browser (Playwright) — heavy, so isolate it as an **optional dependency / separate entry**
to keep the core install light.

## Upload target (pluggable)

`PublishTarget { name; upload(dir): Promise<{ url }> }`

- **`dir`** (no-account): write the artifact locally + serve it. Proves the pipeline with
  zero credentials. ✅ done.
- **`github-pages`** (**recommended BYO**): uses the builder's existing GitHub (VS Code
  auth) — no new account/dashboard. See the flow above.
- **`cloudflare-pages` / `netlify`**: alternate BYO via OAuth/token (fallback for users
  without GitHub). Free tier, custom domains, HTTPS, fast CDN.
- **`s3` / `azure-swa`**: enterprise internal targets (Customer 2).
- **managed `reviewx`**: deferred (we host).

## Security / privacy

- Published artifact is public (unguessable URL). **Author token never embedded.**
- Inbox already sends permissive CORS, so feedback from the published origin works.
- A snapshot captures whatever's on screen — **warn the author** about sensitive data.
- Public link → spam is bounded by the inbox's per-IP rate limiting (already built).
- Privacy upgrades (password / SSO allowlist on the published page) = later, model-dependent.

## Phasing

1. ✅ **Static export + `dir` target** — pipeline proven, feedback lands in the inbox.
2. **`basePath` in `staticExport`** — prefix injected asset URLs (needed for GH project Pages).
3. **`github-pages` target + VS Code GitHub-auth flow** — the recommended BYO path.
4. **Deploy the shared inbox** (the Dockerized multi-tenant one) at a stable URL.
5. **Snapshot engine** (Engine B) — Playwright freeze for backend/dynamic prototypes.
6. **VS Code Share/Publish buttons** (see VSCODE-EXPERIENCE.md) wrapping all of the above.
7. **Deferred:** managed `reviewx` hosting; privacy upgrades (password / SSO).

## What I need from you

- **Nothing for the GitHub path** — it uses the builder's own GitHub via VS Code auth.
- **A small always-on host** for the shared inbox (Fly/Render free tier, ~$5/mo) when we
  reach phase 4 — that one instance covers all BYO users.
