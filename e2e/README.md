# ReviewSX end-to-end tests

Validates the **core that every distribution channel ships**: the overlay mounts,
a reviewer pins feedback, and it lands in the inbox. Plus live smoke checks that
the published listings are up.

## What it does
- Boots a real ReviewSX **inbox** (file storage, temp dir) on `:4500`
- Serves a sample **prototype** with the built overlay on `:5500`
- Drives the overlay in a real browser (Playwright) and asserts feedback reaches
  the inbox — the same path VS Code, Cursor, the CDN snippet, and Claude Code all
  produce.

## Prerequisites (one time)
```bash
# from the repo root — build the pieces the harness serves
npm run build -w @protofeedback/overlay
npm run build -w @protofeedback/server

# install test deps + the browser
cd e2e
npm install
npx playwright install chromium
```

## Run
```bash
cd e2e
npm test            # core overlay+inbox E2E and live listing checks
SKIP_LIVE=1 npm test   # skip the network/listing checks (offline / hermetic CI)
npm run report      # open the HTML report
```

## Files
- `scripts/test-server.mjs` — boots the inbox + static prototype server
- `fixtures/test-proto/` — the sample page with the snippet
- `tests/overlay.spec.ts` — mount, pin feedback → inbox, persistence
- `tests/listings.spec.ts` — OpenVSX + Marketplace + hosted-inbox health (live)

No accounts needed. The live checks in `listings.spec.ts` just GET public URLs.
