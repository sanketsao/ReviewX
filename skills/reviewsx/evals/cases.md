# ReviewSX skill — eval cases

Inject-accuracy evals for the `reviewsx` Claude Code skill. Run with the
**skill-creator** skill's eval runner (needs `ANTHROPIC_API_KEY`). Each case is a
starting project + a user prompt; the grader checks the resulting file.

Pass criteria, unless a case says otherwise:
- The snippet `<script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx ...></script>`
  is added **exactly once**, **before `</body>`** (or the framework's equivalent).
- The shared/deployed copy does **not** include `data-role="author"` or `data-token`.
- Existing markup is otherwise unchanged.

---

## Case 1 — static HTML, basic
**Setup:** `index.html` with `<body>…</body>`, no ReviewSX.
**Prompt:** "Add ReviewSX so I can share this for review."
**Expect:** snippet injected once, just before `</body>`. No author attrs.

## Case 2 — already present (idempotent)
**Setup:** `index.html` that already contains a `data-reviewsx` script.
**Prompt:** "Make this reviewable with ReviewSX."
**Expect:** **no second** snippet added; skill recognizes it's already there.

## Case 3 — Vite / React SPA
**Setup:** a Vite app with `index.html` containing `<div id="root"></div>`.
**Prompt:** "Add the ReviewSX feedback overlay."
**Expect:** snippet in `index.html` before `</body>` (mounts in shadow DOM, no
React changes).

## Case 4 — Next.js app router
**Setup:** `app/layout.tsx` with `<body>{children}</body>`.
**Prompt:** "Add ReviewSX to this Next.js app."
**Expect:** `next/script` `<Script src=".../reviewsx@1" data-reviewsx />` added
inside `<body>` after `{children}`; `import Script from "next/script"` present.

## Case 5 — author copy requested
**Setup:** static `index.html`.
**Prompt:** "Add ReviewSX and give ME the author tools with token `s3cret`."
**Expect:** snippet includes `data-role="author"` and `data-token="s3cret"`, and
the skill explains this copy is for the builder only — not the shared link.

## Case 6 — wrong context (should decline / redirect)
**Setup:** a backend-only Node service (no HTML, no browser UI).
**Prompt:** "Add ReviewSX."
**Expect:** skill declines or asks, explaining ReviewSX is for web prototypes with
a browser UI — does not inject into server code.

## Case 7 — shared endpoint
**Setup:** static `index.html`.
**Prompt:** "Add ReviewSX and send feedback to https://inbox.reviewsx.app."
**Expect:** snippet includes `data-endpoint="https://inbox.reviewsx.app"` and a
`data-project`; no token on the shared copy.

---

## How to run
1. Install the skill-creator skill (it provides the eval runner + grader).
2. `export ANTHROPIC_API_KEY=...`
3. Point the runner at `skills/reviewsx/SKILL.md` and these cases.
4. Record the pass-rate; a drop is a release blocker. Re-run after any edit to
   `SKILL.md` or the snippet format.
