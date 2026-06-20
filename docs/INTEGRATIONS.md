# Adding ReviewSX to browser-based prototype builders

ReviewSX works on **any** page that can include one `<script>` tag. If you build
your prototype in a browser-based tool (Replit, StackBlitz, Bolt, v0, Lovable,
CodeSandbox…), you don't need the VS Code extension — just paste the snippet.

## The one line

Add this just before `</body>` in your prototype's main HTML:

```html
<script
  src="https://cdn.jsdelivr.net/npm/reviewsx@1"
  data-reviewsx
  data-project="my-prototype"
  data-endpoint="https://inbox.reviewsx.app"
></script>
```

- `data-project` — any unique name for this prototype. All feedback for the same
  name is grouped together.
- `data-endpoint` — where feedback is stored. Use `https://inbox.reviewsx.app`
  (the free hosted inbox) or your company's self-hosted inbox URL.
- Omit `data-endpoint` entirely to keep feedback in the reviewer's browser only
  (fine for a quick solo look; reviewers can't send feedback back to you).

That's it. Open the page, click any element to leave a comment, and switch to
Tour mode to follow or author a guided walkthrough.

---

## Per-platform: where to paste it

### Replit
1. Open your repl's `index.html` (or the main HTML file).
2. Paste the snippet before `</body>`.
3. Click **Run**. Share the **webview URL** (the `*.replit.dev` link) with reviewers.

### StackBlitz
1. Open `index.html` in the editor.
2. Paste the snippet before `</body>`.
3. Share the live preview URL, or click **Share → Open in new window** and send that link.

### Bolt (bolt.new)
1. After Bolt generates your app, open the file tree → `index.html`.
2. Paste the snippet before `</body>`.
3. Use the deployed preview URL Bolt gives you.
   *(If Bolt regenerates the file, re-add the snippet — or ask Bolt: "add this
   script tag before the closing body tag" and paste the snippet.)*

### v0 (v0.dev)
v0 builds React/Next.js. Add the script in your root layout:
```tsx
// app/layout.tsx — inside <body>, after {children}
<Script
  src="https://cdn.jsdelivr.net/npm/reviewsx@1"
  data-reviewsx
  data-project="my-prototype"
  data-endpoint="https://inbox.reviewsx.app"
/>
```
Import `Script` from `next/script`. Deploy, then share the Vercel preview URL.

### Lovable
1. Lovable builds React. Open the project, find `index.html` (in the `public/`
   or root, depending on the template).
2. Paste the snippet before `</body>`.
3. Publish, then share the Lovable preview URL.
   *(Alternatively, tell Lovable in chat: "add the ReviewSX script tag to
   index.html before the closing body tag" and paste the snippet.)*

### CodeSandbox
1. Open `index.html` (or `public/index.html` for React templates).
2. Paste the snippet before `</body>`.
3. Share the preview URL (the `csb.app` link).

---

## Authoring vs. reviewing

The snippet gives **everyone** the reviewer experience by default (leave
feedback, follow a tour). To author a tour or moderate feedback, add
`data-role="author"` and a secret token:

```html
<script
  src="https://cdn.jsdelivr.net/npm/reviewsx@1"
  data-reviewsx
  data-role="author"
  data-project="my-prototype"
  data-endpoint="https://inbox.reviewsx.app"
  data-token="choose-a-long-secret"
></script>
```

Keep the author snippet in your private working copy; share the public URL (which
should use the plain reviewer snippet) with reviewers. The token authorizes
resolving feedback and saving tour steps.

---

## Configuring via JavaScript instead of data attributes

If your tool makes it awkward to set `data-*` attributes, set a global object
**before** the script loads:

```html
<script>
  window.ReviewSX = {
    project: "my-prototype",
    endpoint: "https://inbox.reviewsx.app",
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx></script>
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Overlay doesn't appear | Confirm the `<script>` is inside the page that's actually being served (not a partial), and that `data-reviewsx` is present. |
| Feedback doesn't reach me | Check `data-endpoint` is set and reachable. Without it, feedback stays in the reviewer's browser. |
| Tag keeps getting removed | Some AI builders regenerate files. Re-add it, or ask the tool's chat to add it for you. |
| Styles look off | The overlay renders in a Shadow DOM and shouldn't collide with your CSS. If it does, file an issue. |
