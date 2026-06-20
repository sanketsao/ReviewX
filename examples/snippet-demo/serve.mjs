// Minimal static file server rooted at the repo, used only to smoke-test the
// CDN snippet bundle (examples/snippet-demo/index.html → dist/reviewsx.js).
// Plain static serving with NO overlay injection, so the snippet is the only
// thing that mounts the overlay.
import { createServer } from "http";
import { createReadStream, promises as fs } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = Number(process.argv[2] || 4324);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  let rel = decodeURIComponent((req.url || "/").split("?")[0]);
  if (rel === "/") rel = "/examples/snippet-demo/index.html";
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || stat.isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`snippet demo on http://127.0.0.1:${PORT}`));
