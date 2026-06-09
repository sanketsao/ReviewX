import * as http from "http";
import * as path from "path";
import { promises as fs } from "fs";
import type { StorageAdapter } from "./store";
import { createStorageProvider, type StorageBackend } from "./storage";
import { buildXlsx } from "./xlsx";
import type { Feedback, Settings, TourStep } from "./types";

export interface InboxOptions {
  /** Root directory under which each project's .protofeedback/ data lives. */
  dataDir?: string;
  port?: number;
  host?: string;
  /** Max write requests (POST/PATCH/PUT) per IP per minute. Default 60. */
  writeRateLimit?: number;
  /** Persistence engine: "file" (default) or "sqlite" (single DB file). */
  storage?: StorageBackend;
  /** SQLite database path (defaults to <dataDir>/reviewx.sqlite). */
  sqlitePath?: string;
}

export interface RunningInbox {
  server: http.Server;
  url: string;
  port: number;
  close: () => Promise<void>;
}

// The snippet runs on arbitrary origins (the prototype's own domain), so every
// response — including the preflight — must allow cross-origin access.
const CORS: http.OutgoingHttpHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-PF-Token",
  "Access-Control-Max-Age": "86400",
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { ...CORS, "Content-Type": "application/json; charset=utf-8" });
  res.end(data);
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Keep project ids to a safe directory-name charset to prevent path traversal. */
function safeProject(raw: unknown): string {
  const id = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 100);
  return id || "default";
}

/**
 * Minimal multi-project feedback inbox. Mirrors the same-origin /__pf API the
 * proxy/static server exposes, but namespaced by `project` so a single deployment
 * collects shared, persistent feedback from CDN-snippet prototypes on any origin.
 * Matches restBackend's contract in @protofeedback/overlay.
 */
export async function createInbox(opts: InboxOptions = {}): Promise<RunningInbox> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 4400;
  const dataRoot = path.resolve(opts.dataDir ?? path.join(process.cwd(), ".protofeedback-inbox"));
  const writeLimit = opts.writeRateLimit ?? 60;

  // Pluggable storage: file (JSON per project) or sqlite (one DB). Each project
  // gets its own adapter, cached inside the provider for the process lifetime.
  const storage = createStorageProvider({
    backend: opts.storage,
    dataDir: dataRoot,
    sqlitePath: opts.sqlitePath,
  });
  const storeFor = (project: unknown): StorageAdapter => storage.for(safeProject(project));

  // --- Per-project write token (trust-on-first-use) -----------------------
  // A project is "open" until someone presents a token; the first tokened
  // request claims it (persisted to <project>/.protofeedback/secret.json).
  // Thereafter, author-only operations (resolve/edit/tour/settings/export)
  // require the matching token. Reviewer feedback POSTs always stay open so
  // the zero-install path keeps working — abuse is bounded by rate limiting.
  const tokenCache = new Map<string, string | null>();
  const secretFile = (id: string): string =>
    path.join(dataRoot, id, ".protofeedback", "secret.json");

  async function loadToken(id: string): Promise<string | null> {
    if (tokenCache.has(id)) return tokenCache.get(id) as string | null;
    let value: string | null = null;
    try {
      const raw = await fs.readFile(secretFile(id), "utf8");
      const t = (JSON.parse(raw) as { token?: unknown }).token;
      value = typeof t === "string" && t ? t : null;
    } catch {
      value = null;
    }
    tokenCache.set(id, value);
    return value;
  }

  async function claimToken(id: string, token: string): Promise<void> {
    const dir = path.join(dataRoot, id, ".protofeedback");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(secretFile(id), JSON.stringify({ token }, null, 2), "utf8");
    tokenCache.set(id, token);
  }

  /**
   * Resolve a project + enforce the token. `privileged` ops require a matching
   * token once the project is claimed; any tokened request claims an unclaimed
   * project. Returns the resolved store on success, or an error to send.
   */
  async function authorize(
    projectRaw: unknown,
    token: string,
    privileged: boolean
  ): Promise<{ ok: true; store: StorageAdapter } | { ok: false; status: number; error: string }> {
    const id = safeProject(projectRaw);
    let stored = await loadToken(id);
    if (!stored && token) {
      await claimToken(id, token);
      stored = token;
    }
    if (stored && privileged && token !== stored) {
      // 401 when no credential was sent; 403 when a wrong one was.
      return token
        ? { ok: false, status: 403, error: "invalid project token" }
        : { ok: false, status: 401, error: "missing project token" };
    }
    return { ok: true, store: storeFor(id) };
  }

  // --- Write rate limiting (per-IP token bucket) --------------------------
  const buckets = new Map<string, { tokens: number; last: number }>();
  function rateOk(ip: string): boolean {
    if (writeLimit <= 0) return true;
    const now = Date.now();
    const refillPerMs = writeLimit / 60000;
    let b = buckets.get(ip);
    if (!b) {
      b = { tokens: writeLimit, last: now };
      buckets.set(ip, b);
    }
    b.tokens = Math.min(writeLimit, b.tokens + (now - b.last) * refillPerMs);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }
  const clientIp = (req: http.IncomingMessage): string => {
    const fwd = req.headers["x-forwarded-for"];
    const first = Array.isArray(fwd) ? fwd[0] : (fwd || "").split(",")[0];
    return first.trim() || req.socket.remoteAddress || "unknown";
  };
  const tokenOf = (req: http.IncomingMessage, url: URL): string => {
    const h = req.headers["x-pf-token"];
    const fromHeader = Array.isArray(h) ? h[0] : h;
    return (fromHeader || url.searchParams.get("token") || "").toString();
  };

  const server = http.createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: "server error" });
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method || "GET";
    if (method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || host}`);
    const p = url.pathname.replace(/\/$/, "") || "/";
    const token = tokenOf(req, url);

    if (p === "/" || p === "/health") {
      sendJson(res, 200, { ok: true, storage: storage.label });
      return;
    }

    // Bound abuse on the zero-install write path without an account.
    if (method !== "GET" && !rateOk(clientIp(req))) {
      sendJson(res, 429, { error: "rate limit exceeded" });
      return;
    }

    // --- Feedback ---
    if (p === "/feedback" && method === "GET") {
      const auth = await authorize(url.searchParams.get("project"), token, false);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      sendJson(res, 200, await auth.store.listFeedback());
      return;
    }
    if (p === "/feedback" && method === "POST") {
      const body = await readBody(req);
      if (!body.text || !body.anchor) {
        sendJson(res, 400, { error: "text and anchor required" });
        return;
      }
      // Creating feedback is the reviewer action — open (rate-limited above).
      const auth = await authorize(body.project, token, false);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      const fb = await auth.store.addFeedback({
        anchor: body.anchor as Feedback["anchor"],
        text: String(body.text),
        author: typeof body.author === "string" && body.author ? body.author : "Anonymous",
        page: typeof body.page === "string" && body.page ? body.page : "/",
      });
      sendJson(res, 201, fb);
      return;
    }
    const replyMatch = p.match(/^\/feedback\/([^/]+)\/replies$/);
    if (replyMatch && method === "POST") {
      const body = await readBody(req);
      if (!body.text) {
        sendJson(res, 400, { error: "text required" });
        return;
      }
      // Replying is part of the conversation — open to reviewers and authors
      // alike (rate-limited above).
      const auth = await authorize(body.project, token, false);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      const fb = await auth.store.addReply(replyMatch[1], {
        author: typeof body.author === "string" && body.author ? body.author : "Anonymous",
        text: String(body.text),
      });
      if (!fb) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      sendJson(res, 201, fb);
      return;
    }
    const patchMatch = p.match(/^\/feedback\/([^/]+)$/);
    if (patchMatch && method === "PATCH") {
      const body = await readBody(req);
      // Resolving/editing is an author action — token-gated once claimed.
      const auth = await authorize(body.project, token, true);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      const fb = await auth.store.patchFeedback(patchMatch[1], {
        status: body.status as Feedback["status"] | undefined,
        text: body.text as string | undefined,
      });
      if (!fb) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      sendJson(res, 200, fb);
      return;
    }

    // --- Excel export (author convenience) ---
    if (p === "/feedback.xlsx" && method === "GET") {
      const auth = await authorize(url.searchParams.get("project"), token, true);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      const all = await auth.store.listFeedback();
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
        ...CORS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="feedback.xlsx"',
        "Content-Length": String(buf.length),
      });
      res.end(buf);
      return;
    }

    // --- Tour ---
    if (p === "/tour" && method === "GET") {
      const auth = await authorize(url.searchParams.get("project"), token, false);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      sendJson(res, 200, await auth.store.listTour());
      return;
    }
    if (p === "/tour" && method === "PUT") {
      const body = await readBody(req);
      const auth = await authorize(body.project, token, true);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      const steps = Array.isArray(body.steps) ? (body.steps as TourStep[]) : [];
      sendJson(res, 200, await auth.store.saveTour(steps));
      return;
    }

    // --- Settings ---
    if (p === "/settings" && method === "GET") {
      const auth = await authorize(url.searchParams.get("project"), token, false);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      sendJson(res, 200, await auth.store.getSettings());
      return;
    }
    if (p === "/settings" && method === "PUT") {
      const body = await readBody(req);
      const auth = await authorize(body.project, token, true);
      if (!auth.ok) {
        sendJson(res, auth.status, { error: auth.error });
        return;
      }
      const patch: Partial<Settings> = {};
      if (typeof body.autoStartTour === "boolean") patch.autoStartTour = body.autoStartTour;
      sendJson(res, 200, await auth.store.saveSettings(patch));
      return;
    }

    sendJson(res, 404, { error: "unknown endpoint" });
  }

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  return {
    server,
    url: `http://${host}:${port}`,
    port,
    close: () =>
      new Promise<void>((resolve) =>
        server.close(() => storage.close().then(resolve, resolve))
      ),
  };
}
