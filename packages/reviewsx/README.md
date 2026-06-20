# reviewsx

Zero-install **feedback + guided-tour overlay** for web prototypes. Drop in one
`<script>` tag and anyone who opens your prototype sees a banner to **take a
guided tour** or **leave pinned UI feedback** — no account, no extension, no
build step. The overlay mounts itself in a Shadow DOM, so it never collides with
your app's styles or markup.

## Quick start

Add one line before `</body>`:

```html
<script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx></script>
```

That's it. Feedback persists in the reviewer's own browser (`localStorage`) by
default — perfect for "try it" and single-author use.

## Shared, persistent feedback

To collect feedback from multiple reviewers in one place, point the snippet at a
hosted inbox with `data-endpoint`:

```html
<!-- The copy you SHARE with reviewers -->
<script
  src="https://cdn.jsdelivr.net/npm/reviewsx@1"
  data-reviewsx
  data-endpoint="https://your-inbox.example.com"
  data-project="my-proto"
></script>
```

```html
<!-- YOUR copy (author tools + the write secret) — don't share this one -->
<script
  src="https://cdn.jsdelivr.net/npm/reviewsx@1"
  data-reviewsx
  data-role="author"
  data-endpoint="https://your-inbox.example.com"
  data-project="my-proto"
  data-token="choose-a-secret"
></script>
```

Run the inbox with the ReviewSX CLI:

```bash
npx @protofeedback/server --inbox
```

## Configuration

| Attribute | Effect | Default |
| --- | --- | --- |
| `data-reviewsx` | Marks the script tag for config discovery. | — |
| `data-role="author"` | Show author tools (tour builder, comments inbox, export). | `reviewer` |
| `data-endpoint="https://…"` | Send feedback to a shared hosted inbox. | per-browser `localStorage` |
| `data-project="my-proto"` | Logical id that keys the stored data. | page host |
| `data-token="secret"` | **Author copy only.** Authorizes resolving/editing feedback, tour edits, and export. | none |

You can also configure via a `window.ReviewSX` object set **before** the
script tag:

```html
<script>
  window.ReviewSX = { endpoint: "https://your-inbox.example.com", project: "my-proto" };
</script>
<script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx></script>
```

### Author vs reviewer

Reviewers get the **default** (no `data-role`). You get author tools either by
adding `data-role="author"` to your own copy, or by opening the prototype with
`?pf=author` in the URL.

### Inbox security (trust-on-first-use)

When you use a shared `data-endpoint`, the inbox is **trust-on-first-use**: the
first request bearing `data-token` claims that secret for the project. After
that, anyone can still post feedback (reviewers need no token), but resolving,
editing, tour edits, and export require the matching token. Inbox writes are
also rate-limited per IP. **Never** put `data-token` on the copy you share.

## What reviewers get

- A dismissible banner with **Take the tour** and **Give feedback**.
- Feedback mode: click any element → pinned comment, re-anchored after reload.
- Tour mode: guided step-by-step popovers (you build steps with the ⚙ tool).
- Export: copy as Markdown / download JSON (Excel when run behind the proxy).

## License

MIT
