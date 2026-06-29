# ReviewSX testing strategy

Two kinds of test, mapped to how ReviewSX is distributed.

1. **Evals** — the AI-driven surface (the Claude Code skill). Non-deterministic;
   measured as a pass-rate across cases.
2. **Channel tests** — the product installs and runs on each surface. Mostly
   deterministic E2E / integration / health checks.

**Key idea:** every channel ships the same two artifacts — the *overlay* and the
*inbox*. One strong E2E of "overlay → feedback → inbox" validates the core all
channels deliver; each channel then only needs a thin "does it load" check.

## The matrix

| Layer | Surface | What it proves | How | Account |
|---|---|---|---|---|
| 1 | Core overlay + inbox | mount → pin feedback → persists | `e2e/` Playwright | none |
| 2 | Published listings | extension live on each registry | `e2e/tests/listings.spec.ts` | none |
| 3 | Claude Code skill | injects correct snippet across frameworks | `skills/reviewsx/evals/` (skill-creator) | Anthropic API key |
| 4 | VS Code extension | install VSIX → command serves + injects | `@vscode/test-electron` (TODO) | none |
| 5 | Self-host inbox | health, persistence, token auth | `e2e/scripts/selfhost-smoke.mjs` | none (Docker) |
| 6 | Cursor / Windsurf / JetBrains | install + smoke | manual checklist (below) | none |

## Running each

```bash
# Layer 1 + 2 — core E2E and live listing checks
npm run build -w @protofeedback/overlay && npm run build -w @protofeedback/server
cd e2e && npm install && npx playwright install chromium
npm test                 # all
SKIP_LIVE=1 npm test     # core only, no network

# Layer 5 — self-host smoke (needs Docker)
node e2e/scripts/selfhost-smoke.mjs

# Existing gate — unit tests + VSIX integrity + identity
npm run verify           # at repo root (see scripts/verify.mjs)
```

## Layer 3 — skill evals (Anthropic API key)

The Claude Code skill (`skills/reviewsx/SKILL.md`) is AI-driven, so it's evaluated
on **inject accuracy**: given a project + prompt, does it add the snippet exactly
once, in the right place, with the right attributes, and skip when already present?

Cases live in `skills/reviewsx/evals/cases.md`. Run them with the **skill-creator**
skill's eval runner (set `ANTHROPIC_API_KEY` first). Track pass-rate over time;
treat a regression as a release blocker.

## Layer 6 — manual smoke matrix

These can't be headless-automated today. Run before a release that touches the
extension. ~5 minutes total.

### Cursor / Windsurf (each)
1. Extensions → search "ReviewSX" → Install (pulls from OpenVSX).
2. Open a folder with an `index.html`.
3. ReviewSX sidebar → **Start with overlay** → browser opens with the toolbar.
4. Feedback mode → click an element → leave a comment → it appears in the sidebar.
5. **Share via Tailscale/Cloudflare** → a public URL opens.

### JetBrains (WebStorm) — once the plugin exists
1. Install the plugin zip → restart.
2. Tools → ReviewSX → Start → browser opens with overlay.

## What's automated vs not

- **Automated, no account:** Layers 1, 2, 5, plus `npm run verify` (unit tests +
  VSIX integrity + marketplace identity) and the 21 server unit tests.
- **Automated, needs API key:** Layer 3 (skill evals).
- **Manual:** Layer 6 (Cursor/Windsurf/JetBrains install smoke) — no headless
  harness exists for the VS Code forks.
- **TODO:** Layer 4 (`@vscode/test-electron`) — headless VS Code integration test.
