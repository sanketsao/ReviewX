import * as http from "http";
import * as path from "path";
import { promises as fs, createReadStream } from "fs";
import httpProxy from "http-proxy";
import { Store } from "./store";
import { injectOverlay, isHtml, roleForHost } from "./inject";
import { buildXlsx } from "./xlsx";
import type { Feedback, ServerOptions, Settings, TourStep } from "./types";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function overlayBundlePath(): string {
  try {
    const pkg = require.resolve("@protofeedback/overlay/package.json");
    return path.join(path.dirname(pkg), "dist", "overlay.js");
  } catch {
    return "";
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(data);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

export interface RunningServer {
  server: http.Server;
  url: string;
  port: number;
  store: Store;
  close: () => Promise<void>;
}

export async function createServer(opts: ServerOptions): Promise<RunningServer> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 4321;
  const dataDir = opts.dataDir ?? opts.dir ?? process.cwd();
  const store = new Store(dataDir);
  const overlayFile = overlayBundlePath();

  const proxy = opts.proxyTarget
    ? httpProxy.createProxyServer({
        target: opts.proxyTarget,
        selfHandleResponse: true,
        ws: true,
        // Present the target's own host to the dev server so framework host
        // checks (Vite/Next allowedHosts) don't reject tunnel/LAN visitors.
        // We still read the *original* client Host for role detection.
        changeOrigin: true,
      })
    : null;

  if (proxy) {
    proxy.on("proxyRes", (proxyRes, req, res) => {
      const ct = proxyRes.headers["content-type"];
      const chunks: Buffer[] = [];
      proxyRes.on("data", (c) => chunks.push(c as Buffer));
      proxyRes.on("end", () => {
        const headers = { ...proxyRes.headers };
        if (isHtml(ct)) {
          const role = roleForHost(req.headers.host);
          const html = injectOverlay(Buffer.concat(chunks).toString("utf8"), role);
          const buf = Buffer.from(html, "utf8");
          delete headers["content-length"];
          delete headers["content-encoding"];
          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(buf);
        } else {
          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(Buffer.concat(chunks));
        }
      });
    });
    proxy.on("error", (_err, _req, res) => {
      if (res instanceof http.ServerResponse && !res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Proxy error: is the dev server running?");
      }
    });
  }

  const handleApi = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<boolean> => {
    const p = url.pathname;
    if (!p.startsWith("/__pf")) return false;
    const method = req.method || "GET";

    if (p === "/__pf/overlay.js") {
      if (!overlayFile) {
        res.writeHead(404).end("overlay bundle not built");
        return true;
      }
      try {
        await fs.access(overlayFile);
        res.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        createReadStream(overlayFile).pipe(res);
      } catch {
        res.writeHead(404).end("overlay bundle not built; run npm run build:overlay");
      }
      return true;
    }

    if (p === "/__pf/feedback.xlsx" && method === "GET") {
      const all = await store.listFeedback();
      const rows: string[][] = [
        ["Page", "Author", "Comment", "Status", "Created", "Element"],
        ...all.map((f) => [
          f.page,
          f.author,
          f.text,
          f.status,
          new Date(f.createdAt).toLocaleString(),
          f.anchor?.selector || "",
        ]),
      ];
      const buf = buildXlsx(rows);
      res.writeHead(200, {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="feedback.xlsx"',
        "Content-Length": String(buf.length),
      });
      res.end(buf);
      return true;
    }

    if (p === "/__pf/feedback" && method === "GET") {
      sendJson(res, 200, await store.listFeedback());
      return true;
    }
    if (p === "/__pf/feedback" && method === "POST") {
      const body = (await readBody(req)) as Partial<Feedback>;
      if (!body.text || !body.anchor) return sendJson(res, 400, { error: "text and anchor required" }), true;
      const fb = await store.addFeedback({
        anchor: body.anchor,
        text: String(body.text),
        author: body.author || "Anonymous",
        page: body.page || "/",
      });
      sendJson(res, 201, fb);
      return true;
    }
    const replyMatch = p.match(/^\/__pf\/feedback\/([^/]+)\/replies$/);
    if (replyMatch && method === "POST") {
      const body = (await readBody(req)) as { author?: string; text?: string };
      if (!body.text) return sendJson(res, 400, { error: "text required" }), true;
      const fb = await store.addReply(replyMatch[1], {
        author: body.author || "Anonymous",
        text: String(body.text),
      });
      if (!fb) return sendJson(res, 404, { error: "not found" }), true;
      sendJson(res, 201, fb);
      return true;
    }
    const patchMatch = p.match(/^\/__pf\/feedback\/([^/]+)$/);
    if (patchMatch && method === "PATCH") {
      const body = (await readBody(req)) as Partial<Feedback>;
      const fb = await store.patchFeedback(patchMatch[1], {
        status: body.status,
        text: body.text,
      });
      if (!fb) return sendJson(res, 404, { error: "not found" }), true;
      sendJson(res, 200, fb);
      return true;
    }
    if (p === "/__pf/settings" && method === "GET") {
      sendJson(res, 200, await store.getSettings());
      return true;
    }
    if (p === "/__pf/settings" && method === "PUT") {
      const body = (await readBody(req)) as Partial<Settings>;
      const patch: Partial<Settings> = {};
      if (typeof body.autoStartTour === "boolean") patch.autoStartTour = body.autoStartTour;
      sendJson(res, 200, await store.saveSettings(patch));
      return true;
    }
    if (p === "/__pf/tour" && method === "GET") {
      sendJson(res, 200, await store.listTour());
      return true;
    }
    if (p === "/__pf/tour" && method === "PUT") {
      const body = (await readBody(req)) as { steps?: TourStep[] };
      const saved = await store.saveTour(Array.isArray(body.steps) ? body.steps : []);
      sendJson(res, 200, saved);
      return true;
    }
    sendJson(res, 404, { error: "unknown endpoint" });
    return true;
  };

  const serveStatic = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> => {
    const root = path.resolve(opts.dir!);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    let filePath = path.normalize(path.join(root, rel));
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    try {
      let stat = await fs.stat(filePath).catch(() => null);
      if (stat?.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        stat = await fs.stat(filePath).catch(() => null);
      }
      if (!stat) {
        // SPA fallback to root index.html
        const indexPath = path.join(root, "index.html");
        if (await fs.stat(indexPath).catch(() => null)) {
          filePath = indexPath;
        } else {
          res.writeHead(404).end("not found");
          return;
        }
      }
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".html") {
        const role = roleForHost(req.headers.host);
        const html = injectOverlay(await fs.readFile(filePath, "utf8"), role);
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(html);
      } else {
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        createReadStream(filePath).pipe(res);
      }
    } catch {
      res.writeHead(500).end("server error");
    }
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || host}`);
    handleApi(req, res, url)
      .then((handled) => {
        if (handled) return;
        if (proxy) proxy.web(req, res);
        else serveStatic(req, res, url);
      })
      .catch(() => {
        if (!res.headersSent) res.writeHead(500).end("server error");
      });
  });

  if (proxy) {
    server.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));
  }

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const url = `http://${host}:${port}`;

  return {
    server,
    url,
    port,
    store,
    close: () =>
      new Promise<void>((resolve) => {
        proxy?.close();
        server.close(() => resolve());
      }),
  };
}
