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
- **Hosting model: decide after a spike.** Build the pipeline with a *pluggable upload
  target*; spike against **Cloudflare Pages**; choose managed-vs-BYO once we feel the
  friction. Keep the tunnel as the complementary "live session" mode.

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

- **`dir`** (no-account): just write the artifact locally + serve it — proves the whole
  pipeline end-to-end without any cloud credential. **Spike starts here.**
- **`cloudflare-pages`**: `wrangler pages deploy <dir>` (or direct-upload API). Needs a CF
  account + API token (your credential). Free tier, custom domains, HTTPS, fast CDN.
- Later: `netlify`, `s3`, `github-pages`, managed `reviewx`.

## Security / privacy

- Published artifact is public (unguessable URL). **Author token never embedded.**
- Inbox already sends permissive CORS, so feedback from the published origin works.
- A snapshot captures whatever's on screen — **warn the author** about sensitive data.
- Public link → spam is bounded by the inbox's per-IP rate limiting (already built).
- Privacy upgrades (password / SSO allowlist on the published page) = later, model-dependent.

## Phasing

1. **Spike (mostly creds-free):** `reviewx publish <dir> --target dir|cloudflare-pages` —
   static export + inject + upload. Verify the published artifact loads, the widget mounts,
   and feedback lands in an inbox. (Local `dir` target needs no account; CF needs your token.)
2. **Snapshot engine:** Playwright freeze of routes (optional dep), route/asset handling.
3. **Hosting decision:** pick managed vs. BYO from the spike's friction; add targets.
4. **Polish:** VS Code "Publish" command, route auto-discovery, privacy options.

## What I need from you to finish the spike

- A **Cloudflare account + API token** (Pages:Edit) to test the real upload — or we prove
  the pipeline with the local `dir` target first and add CF auth after.
