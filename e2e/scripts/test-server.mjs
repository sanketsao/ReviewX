// Boots a real ReviewSX inbox + a static server hosting a sample prototype with
// the built overlay. Playwright waits on the static server (port 5500), then the
// page's overlay posts feedback cross-origin to the inbox (port 4500, CORS=*).
import http from "node:http";
import { promises as fs } from "node:fs";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { createInbox } from "../../packages/server/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const FIXTURE = join(HERE, "..", "fixtures", "test-proto");
const OVERLAY_BUNDLE = join(REPO, "packages", "overlay", "dist", "reviewsx.js");

const INBOX_PORT = 4500;
const WEB_PORT = 5500;

if (!existsSync(OVERLAY_BUNDLE)) {
  console.error(`Overlay bundle missing: ${OVERLAY_BUNDLE}\nRun: npm run build -w @protofeedback/overlay`);
  process.exit(1);
}

// 1. Inbox on a fresh temp data dir (file storage) so tests start clean.
const dataDir = await fs.mkdtemp(join(os.tmpdir(), "reviewsx-e2e-inbox-"));
const inbox = await createInbox({ port: INBOX_PORT, host: "127.0.0.1", storage: "file", dataDir });

// 2. Static server: index.html from the fixture, plus /reviewsx.js (the overlay).
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };
const web = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/reviewsx.js") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(readFileSync(OVERLAY_BUNDLE));
    return;
  }
  const file = url === "/" ? "index.html" : url.replace(/^\/+/, "");
  const full = join(FIXTURE, file);
  if (!full.startsWith(FIXTURE) || !existsSync(full)) {
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(full)] || "text/plain" });
  res.end(readFileSync(full));
});

web.listen(WEB_PORT, () => {
  console.log(`[e2e] inbox  → http://127.0.0.1:${INBOX_PORT}  (data: ${dataDir})`);
  console.log(`[e2e] web    → http://127.0.0.1:${WEB_PORT}`);
});

const shutdown = () => {
  web.close();
  inbox.close?.();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
