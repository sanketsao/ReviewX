---
name: reviewsx
description: >-
  Add the ReviewSX feedback + guided-tour overlay to a web prototype so it can
  be shared for review. Use when the user is building or finishing a web prototype,
  demo, or shareable app (static HTML, React/Vite, Next.js, etc.) and wants
  reviewers to leave in-context UI feedback or walk a guided tour — or asks to
  "add ReviewSX", "make this reviewable", or "add a feedback overlay". Injects
  one CDN snippet (HTML) or a small component/import (framework apps).
---

# ReviewSX auto-inject

ReviewSX is a zero-install overlay: the author adds one line, and anyone who
opens the prototype link sees a banner to **take a guided tour** or **give pinned
feedback** — no account, no extension. This skill inserts that line correctly for
the project's framework and explains the result.

## When to use

Trigger when a web prototype is being generated or wrapped up and the user wants
it reviewable. Do **not** add it to production apps, libraries, or backend-only
code. If unsure whether the user wants it, ask once before editing.

## Core snippet (the canonical line)

```html
<script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx></script>
```

Optional attributes (only add when the user asks for them):

| Attribute | Effect | Default |
| --- | --- | --- |
| `data-role="author"` | Show author tools (tour builder, comments inbox, export). | `reviewer` |
| `data-endpoint="https://…/api"` | Send feedback to a shared hosted inbox. | per-browser `localStorage` |
| `data-project="my-proto"` | Logical id that keys the stored data. | page host |
| `data-token="secret"` | **Author copy only.** Authorizes resolving/editing feedback, tour edits, and export against the inbox. | none (project open until claimed) |

Reviewers should get the **default** (no `data-role`). The author gets author
tools either by adding `data-role="author"` to their own copy or by opening the
prototype with `?pf=author` in the URL.

When using a shared `data-endpoint`, the inbox is **trust-on-first-use**: the
first request bearing `data-token` claims that secret for the project. After
that, anyone can still post feedback (reviewers need no token), but resolving,
editing, tour edits, and export require the matching token. Pick any hard-to-
guess string. Never put `data-token` on the copy you share with reviewers.

## Framework-specific injection

**Static HTML** — insert the snippet just before `</body>`:

```html
  </main>
  <script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx></script>
</body>
```

**Vite / Create React App / plain SPA** — add the snippet to `index.html` before
`</body>` (same as static). It mounts itself in a Shadow DOM, so it never
collides with the app's React tree or styles.

**Next.js (app router)** — use `next/script` in `app/layout.tsx`:

```tsx
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx />
      </body>
    </html>
  );
}
```

**Next.js (pages router)** — add the same `<Script>` to `pages/_document.tsx`
inside `<body>`, or to `_app.tsx`.

## Rules

1. **Inject exactly once.** Before editing, grep for `reviewsx` and skip if it
   already exists.
2. **Place it at the end of `<body>`**, after app mount points, so the DOM exists
   when it loads.
3. **Don't add `data-role="author"` or `data-token` to the shared/deployed copy**
   — that would give every reviewer author tools and the write secret. Both are
   for the builder's own view only.
4. **Prefer the CDN snippet** for prototypes the user controls the source of. If
   the prototype is a hosted preview whose HTML can't be edited (e.g. a platform
   preview), tell the user to use the ReviewSX local proxy/CLI instead, which
   injects the overlay without source changes.
5. After injecting, tell the user in one line: feedback persists in the reviewer's
   browser by default; to collect shared feedback across reviewers, set
   `data-endpoint` to a hosted inbox or run the ReviewSX proxy.

## What the user gets

- A dismissible banner with **Take the tour** and **Give feedback**.
- Feedback mode: click any element → pinned comment, re-anchored on reload.
- Tour mode: guided step-by-step popovers (author builds steps with the ⚙ tool).
- Export: copy as Markdown / download JSON (Excel when run behind the proxy).
