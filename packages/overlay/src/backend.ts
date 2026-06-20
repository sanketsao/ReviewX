import type { Feedback, Reply, Settings, TourStep } from "./types";

export type NewFeedback = Omit<Feedback, "id" | "createdAt" | "status">;

/**
 * Storage/transport contract the overlay talks to. The overlay never assumes a
 * server: it asks a Backend for data and writes through it. This is what lets the
 * same UI run behind the local proxy (httpBackend), as a zero-install CDN snippet
 * (localBackend), or against a hosted inbox (restBackend).
 */
export interface Backend {
  /** Short human label of where data lives (shown to authors). */
  readonly label: string;
  /** True when writes are shared across visitors; false = per-browser only. */
  readonly shared: boolean;

  listFeedback(): Promise<Feedback[]>;
  createFeedback(f: NewFeedback): Promise<Feedback>;
  updateFeedback(
    id: string,
    patch: Partial<Pick<Feedback, "status" | "text">>
  ): Promise<Feedback>;
  /** Append a reply to a comment thread. Open to authors and reviewers. */
  addReply(id: string, reply: { author: string; text: string }): Promise<Feedback>;

  listTour(): Promise<TourStep[]>;
  saveTour(steps: TourStep[]): Promise<TourStep[]>;

  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;

  /** Direct download URL for an .xlsx export, or null when not server-backed. */
  exportXlsxUrl(): string | null;
}

const DEFAULT_SETTINGS: Settings = { autoStartTour: true };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// httpBackend — same-origin /__pf/* API served by the local proxy/static server
// ---------------------------------------------------------------------------

export function httpBackend(base = "/__pf"): Backend {
  async function getJSON<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
  }
  async function sendJSON<T>(method: string, path: string, body: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
  }
  return {
    label: "this project (server)",
    shared: true,
    listFeedback: () => getJSON<Feedback[]>("/feedback"),
    createFeedback: (f) => sendJSON<Feedback>("POST", "/feedback", f),
    updateFeedback: (id, patch) => sendJSON<Feedback>("PATCH", `/feedback/${id}`, patch),
    addReply: (id, reply) => sendJSON<Feedback>("POST", `/feedback/${id}/replies`, reply),
    listTour: () => getJSON<TourStep[]>("/tour"),
    saveTour: (steps) => sendJSON<TourStep[]>("PUT", "/tour", { steps }),
    getSettings: () => getJSON<Settings>("/settings"),
    saveSettings: (patch) => sendJSON<Settings>("PUT", "/settings", patch),
    exportXlsxUrl: () => `${base}/feedback.xlsx`,
  };
}

// ---------------------------------------------------------------------------
// localBackend — zero-install snippet default. Persists in localStorage, scoped
// to a project key. Per-browser only (not shared across reviewers) — honest
// default for "try it" and single-author use; pair with restBackend for sharing.
// ---------------------------------------------------------------------------

export function localBackend(
  project: string,
  seed?: ReviewXConfig["seed"]
): Backend {
  const ns = `reviewsx:${project}`;
  const read = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(`${ns}:${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(`${ns}:${key}`, JSON.stringify(value));
    } catch {
      /* quota or disabled storage — ignore */
    }
  };

  // Merge seed items (builder-authored) into localStorage on first visit so
  // reviewers see the builder's tour and pre-annotations without an inbox.
  // Seed items are identified by id; reviewer additions win on conflict.
  const initFromSeed = (): void => {
    if (!seed) return;
    const seededKey = `${ns}:_seeded`;
    const seedHash = JSON.stringify({ t: seed.tour?.length, f: seed.feedback?.length });
    if (localStorage.getItem(seededKey) === seedHash) return; // already applied
    if (seed.feedback?.length) {
      const existing = read<Feedback[]>("feedback", []);
      const byId = new Map(seed.feedback.map((f) => [f.id, f]));
      for (const f of existing) byId.set(f.id, f); // reviewer edits win
      write("feedback", [...byId.values()]);
    }
    if (seed.tour?.length) {
      const existing = read<TourStep[]>("tour", []);
      if (!existing.length) write("tour", seed.tour);
    }
    if (seed.settings) {
      const existing = read<Partial<Settings>>("settings", {});
      if (!Object.keys(existing).length) write("settings", seed.settings);
    }
    try { localStorage.setItem(seededKey, seedHash); } catch { /* ignore */ }
  };

  try { initFromSeed(); } catch { /* ignore */ }

  return {
    label: "this browser (local)",
    shared: false,
    async listFeedback() {
      return read<Feedback[]>("feedback", []);
    },
    async createFeedback(f) {
      const all = read<Feedback[]>("feedback", []);
      const fb: Feedback = {
        ...f,
        id: uid("fb"),
        status: "open",
        createdAt: new Date().toISOString(),
      };
      all.push(fb);
      write("feedback", all);
      return fb;
    },
    async updateFeedback(id, patch) {
      const all = read<Feedback[]>("feedback", []);
      const fb = all.find((x) => x.id === id);
      if (!fb) throw new Error("not found");
      if (patch.status) fb.status = patch.status;
      if (typeof patch.text === "string") fb.text = patch.text;
      write("feedback", all);
      return fb;
    },
    async addReply(id, reply) {
      const all = read<Feedback[]>("feedback", []);
      const fb = all.find((x) => x.id === id);
      if (!fb) throw new Error("not found");
      const r: Reply = {
        id: uid("rp"),
        author: reply.author || "Anonymous",
        text: reply.text,
        createdAt: new Date().toISOString(),
      };
      fb.replies = [...(fb.replies || []), r];
      write("feedback", all);
      return fb;
    },
    async listTour() {
      return read<TourStep[]>("tour", []);
    },
    async saveTour(steps) {
      write("tour", steps);
      return steps;
    },
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>("settings", {}) };
    },
    async saveSettings(patch) {
      const next = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>("settings", {}), ...patch };
      write("settings", next);
      return next;
    },
    exportXlsxUrl: () => null,
  };
}

// ---------------------------------------------------------------------------
// restBackend — hosted inbox. Talks to a configurable ingest endpoint so a CDN
// snippet can collect shared, persistent feedback without the local proxy.
// Endpoint contract (project passed as query/body):
//   GET    {endpoint}/feedback?project=ID
//   POST   {endpoint}/feedback            { project, ...NewFeedback }
//   PATCH  {endpoint}/feedback/:id        { project, status?, text? }
//   GET    {endpoint}/tour?project=ID
//   PUT    {endpoint}/tour                { project, steps }
//   GET    {endpoint}/settings?project=ID
//   PUT    {endpoint}/settings            { project, ...patch }
// An optional X-PF-Token header authorizes author ops (PATCH/PUT/export); the
// inbox claims the token on first use and requires it to match thereafter.
// ---------------------------------------------------------------------------

export function restBackend(endpoint: string, project: string, token?: string): Backend {
  const root = endpoint.replace(/\/$/, "");
  const q = `project=${encodeURIComponent(project)}`;
  // Author copies of the snippet carry a token (data-token); reviewer copies
  // don't. The inbox lets anyone POST feedback but gates author ops on a match.
  const auth: Record<string, string> = token ? { "X-PF-Token": token } : {};
  async function getJSON<T>(path: string): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${root}${path}${sep}${q}`, {
      headers: { Accept: "application/json", ...auth },
    });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
  }
  async function sendJSON<T>(method: string, path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${root}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ project, ...body }),
    });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
  }
  return {
    label: "shared inbox",
    shared: true,
    listFeedback: () => getJSON<Feedback[]>("/feedback"),
    createFeedback: (f) => sendJSON<Feedback>("POST", "/feedback", { ...f }),
    updateFeedback: (id, patch) => sendJSON<Feedback>("PATCH", `/feedback/${id}`, { ...patch }),
    addReply: (id, reply) => sendJSON<Feedback>("POST", `/feedback/${id}/replies`, { ...reply }),
    listTour: () => getJSON<TourStep[]>("/tour"),
    saveTour: (steps) => sendJSON<TourStep[]>("PUT", "/tour", { steps }),
    getSettings: () => getJSON<Settings>("/settings"),
    saveSettings: (patch) => sendJSON<Settings>("PUT", "/settings", { ...patch }),
    exportXlsxUrl: () => null,
  };
}

// ---------------------------------------------------------------------------
// Config resolution for the CDN snippet
// ---------------------------------------------------------------------------

export interface ReviewXConfig {
  /** Force a backend. Default: "rest" when an endpoint is given, else "local". */
  backend?: "local" | "rest" | "http";
  /** Hosted ingest base URL (enables shared feedback for the snippet). */
  endpoint?: string;
  /** Logical project id keying the data. Defaults to the page host. */
  project?: string;
  /** Author/reviewer hint when there's no server to detect it. */
  role?: "author" | "reviewer";
  /** Shared secret authorizing author ops against the inbox (author copy only). */
  token?: string;
  /**
   * Builder-authored data baked into the published page at export time.
   * localBackend uses this as the baseline if the reviewer's localStorage is empty.
   * restBackend ignores it (the inbox is authoritative).
   */
  seed?: { tour?: TourStep[]; feedback?: Feedback[]; settings?: Settings };
}

/** Merge window.ReviewSX with <script data-*> attributes on the snippet tag. */
export function resolveConfig(): ReviewXConfig {
  const win = (window as unknown as { ReviewSX?: ReviewXConfig }).ReviewSX || {};
  const fromScript: ReviewXConfig = {};
  try {
    const el =
      document.currentScript ||
      document.querySelector("script[data-reviewsx]") ||
      document.querySelector('script[src*="reviewsx"]');
    const ds = (el as HTMLElement | null)?.dataset;
    if (ds) {
      if (ds.backend) fromScript.backend = ds.backend as ReviewXConfig["backend"];
      if (ds.endpoint) fromScript.endpoint = ds.endpoint;
      if (ds.project) fromScript.project = ds.project;
      if (ds.role) fromScript.role = ds.role as ReviewXConfig["role"];
      if (ds.token) fromScript.token = ds.token;
    }
  } catch {
    /* ignore */
  }
  return { ...fromScript, ...win };
}

export function pickBackend(cfg: ReviewXConfig): Backend {
  const project = cfg.project || location.host || "default";
  const kind = cfg.backend || (cfg.endpoint ? "rest" : "local");
  if (kind === "http") return httpBackend();
  if (kind === "rest" && cfg.endpoint) return restBackend(cfg.endpoint, project, cfg.token);
  return localBackend(project, cfg.seed);
}
