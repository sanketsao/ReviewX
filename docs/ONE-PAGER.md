# ReviewX — Functional Overview (One-Pager)

**Zero-install feedback & guided-tour overlay for web prototypes.**
Share a running prototype with a link; reviewers pin threaded comments on the actual UI and follow a guided tour — no clone, no account, no extension.

---

## Problem

Non-developers increasingly build working prototypes (vibe-coded apps, static HTML). Sharing them for review is broken: repos are hostile to UI reviewers, screenshots lose context, and meeting walkthroughs don't scale. Authors need *"look at this running thing and tell me what to change, on the thing itself."*

## Users

| Persona | How they arrive | What they see |
|---|---|---|
| **Author** | localhost (auto-detected) | Full toolbar: Comments review, Tour builder (⚙), exports |
| **Reviewer** | shared link (tunnel/public host) | Just **Give feedback** and **Take the tour** |

## Core Functions

**1. Pinned, threaded feedback** — Click any element → drop a comment. Comments render as numbered bubbles anchored to their elements; bubbles re-anchor after reloads and UI edits (selector + text/structure fallbacks). Click a bubble (or a row in the Comments window) to open the thread *in context*: reply back-and-forth, then **Resolve / Archive**. The bottom-right Comments window shows everything at once, including comments from other pages/tabs.

**2. Guided tours** — The author clicks elements to record steps with titles/descriptions, reorders them, and saves. Reviewers get a spotlight walkthrough with Next/Back; tours **navigate across tabs/routes automatically**. Optional auto-start on a reviewer's first visit.

**3. Act on the feedback** — One **Download** button (Excel / CSV / JSON, replies included) plus **Copy Markdown** — formatted to paste straight back into an AI coding assistant to apply the changes.

**4. Safe by construction** — The overlay mounts in a Shadow DOM (never collides with the prototype's CSS/JS) and works on static sites, SPAs (hash/history routing), and dev servers (Vite/Next/CRA) without configuration.

## Three Ways to Consume

| Tier | Audience | How | Where data lives |
|---|---|---|---|
| **CLI + tunnel** | Live review sessions | `reviewx ./proto --share` → public `trycloudflare.com` URL | Local JSON in the repo |
| **CDN snippet** | Startups | One `<script>` tag (npm/jsDelivr, 10.5 KB gzip) | Browser, or a hosted inbox |
| **Self-hosted inbox** | Small enterprises | Docker container, `--storage file \| sqlite \| postgres` | **Your database** (BYO-DB) |

## Security & Auth

- **Reviewer ingest is always open** (the zero-install promise), bounded by per-IP rate limiting (default 60 writes/min).
- **Author operations** (resolve, tours, settings, export) require one of: a per-project **trust-on-first-use token** (stored with the data), a deployment-wide **admin key**, or an **HS256 JWT** issued by the customer's own backend/IdP.
- Multi-project isolation per inbox; CORS-ready for snippets on any origin; credentials never logged.

## Proven Performance (benchmarked)

- **Zero lost writes** under 20-way concurrency; 2,050-comment dataset verified.
- SQLite backend: **~4,300 writes/sec**, sub-millisecond ops, flat as data grows. File backend: ~160/sec (fine for sessions; rewrites whole file per write).
- Reviewer cost: 10.5 KB gzip script, overlay booted < 25 ms after page load.
- Excel export of 2,050 rows: ~40 ms.

## Status & Roadmap

**Built and verified:** overlay (feedback + tours + personas), CLI/static/proxy server, tunnel sharing, multi-project inbox with three storage adapters, auth (TOFU/admin/JWT), Docker + Compose, CI, 16 unit tests + E2E suites.
**Next:** publish `reviewx` to npm; deploy a hosted inbox; live-Postgres load validation; VS Code extension polish; webhooks → Jira/Linear/Slack.

**Repo:** github.com/sanketsao/ReviewX · MIT
