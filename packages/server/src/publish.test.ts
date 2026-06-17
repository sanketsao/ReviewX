import { test } from "node:test";
import assert from "node:assert";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { injectSnippet, snippetTag, staticExport } from "./publish";

test("snippetTag is a reviewer copy (no token) with endpoint+project", () => {
  const t = snippetTag({ project: "p1", endpoint: "https://inbox.example.com" });
  assert.match(t, /data-reviewx/);
  assert.match(t, /data-endpoint="https:\/\/inbox\.example\.com"/);
  assert.match(t, /data-project="p1"/);
  assert.ok(!/data-token/.test(t), "must never embed an author token");
});

test("snippetTag uses /reviewx.js when bundled, CDN otherwise", () => {
  assert.match(snippetTag({ project: "p", bundleWidget: true }), /src="\/reviewx\.js"/);
  assert.match(snippetTag({ project: "p" }), /src="https:\/\/cdn\.jsdelivr\.net\/npm\/reviewx@1"/);
});

test("basePath prefixes the bundled widget src (GitHub project Pages subpath)", () => {
  assert.match(snippetTag({ project: "p", bundleWidget: true, basePath: "/my-repo/" }), /src="\/my-repo\/reviewx\.js"/);
  // tolerant of missing/extra slashes
  assert.match(snippetTag({ project: "p", bundleWidget: true, basePath: "my-repo" }), /src="\/my-repo\/reviewx\.js"/);
  // basePath only affects the bundled case, not the CDN
  assert.match(snippetTag({ project: "p", basePath: "/my-repo/" }), /cdn\.jsdelivr/);
});

test("injectSnippet inserts before </body>, once", () => {
  const html = "<html><body><h1>Hi</h1></body></html>";
  const once = injectSnippet(html, { project: "p" });
  assert.match(once, /<script[^>]*data-reviewx[^>]*><\/script>\n<\/body>/);
  const twice = injectSnippet(once, { project: "p" });
  assert.equal(twice, once, "idempotent — does not double-inject");
});

test("staticExport copies files, injects HTML, excludes .protofeedback", async () => {
  const src = await fs.mkdtemp(path.join(os.tmpdir(), "rx-src-"));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "rx-out-"));
  await fs.rm(out, { recursive: true, force: true }); // staticExport recreates it
  await fs.writeFile(path.join(src, "index.html"), "<html><body>Hi</body></html>");
  await fs.mkdir(path.join(src, "assets"));
  await fs.writeFile(path.join(src, "assets", "app.css"), "body{}");
  await fs.mkdir(path.join(src, ".protofeedback"));
  await fs.writeFile(path.join(src, ".protofeedback", "feedback.json"), "[secret]");

  const res = await staticExport({ srcDir: src, outDir: out, project: "demo", endpoint: "http://inbox" });

  assert.match(await fs.readFile(path.join(out, "index.html"), "utf8"), /data-reviewx/);
  assert.ok(await fs.readFile(path.join(out, "assets", "app.css"), "utf8"), "asset copied");
  assert.equal(
    await fs.stat(path.join(out, ".protofeedback")).then(() => true, () => false),
    false,
    ".protofeedback excluded — no data leak"
  );
  assert.equal(res.htmlFiles, 1);
});
