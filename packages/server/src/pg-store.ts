import { randomUUID } from "crypto";
import type { StorageAdapter } from "./store";
import type { Anchor, Feedback, Reply, Settings, TourStep } from "./types";

const DEFAULT_SETTINGS: Settings = { autoStartTour: true };

/**
 * Minimal slice of node-postgres's Pool we depend on. Declaring it locally lets
 * the adapter be unit-tested against pg-mem (or any compatible client) without
 * a running database, and keeps `pg` a lazily-loaded optional dependency.
 */
export interface PgPool {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

/** Create the schema if absent. Safe to run on every boot. */
export async function migratePostgres(pool: PgPool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id          TEXT PRIMARY KEY,
      project     TEXT NOT NULL,
      selector    TEXT NOT NULL DEFAULT '',
      tag         TEXT NOT NULL DEFAULT '',
      anchor_text TEXT NOT NULL DEFAULT '',
      text        TEXT NOT NULL,
      author      TEXT NOT NULL,
      status      TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      page        TEXT NOT NULL,
      replies     TEXT NOT NULL DEFAULT '[]'
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project, created_at)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tours (project TEXT PRIMARY KEY, steps TEXT NOT NULL DEFAULT '[]')`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS settings (project TEXT PRIMARY KEY, auto_start_tour BOOLEAN NOT NULL DEFAULT TRUE)`
  );
}

type FeedbackRow = {
  id: string;
  selector: string;
  tag: string;
  anchor_text: string;
  text: string;
  author: string;
  status: string;
  created_at: string;
  page: string;
  replies: string;
};

function rowToFeedback(r: FeedbackRow): Feedback {
  const anchor: Anchor = { selector: r.selector, tag: r.tag, text: r.anchor_text };
  let replies: Reply[] = [];
  try {
    const parsed = JSON.parse(r.replies);
    if (Array.isArray(parsed)) replies = parsed as Reply[];
  } catch {
    /* tolerate corrupt JSON */
  }
  return {
    id: r.id,
    anchor,
    text: r.text,
    author: r.author,
    status: r.status as Feedback["status"],
    createdAt: r.created_at,
    page: r.page,
    replies,
  };
}

/** Postgres-backed {@link StorageAdapter} scoped to a single project. */
export class PostgresStore implements StorageAdapter {
  constructor(private pool: PgPool, private project: string) {}

  async listFeedback(): Promise<Feedback[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM feedback WHERE project = $1 ORDER BY created_at ASC",
      [this.project]
    );
    return (rows as unknown as FeedbackRow[]).map(rowToFeedback);
  }

  async addFeedback(input: Omit<Feedback, "id" | "createdAt" | "status">): Promise<Feedback> {
    const fb: Feedback = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "open",
      ...input,
    };
    await this.pool.query(
      `INSERT INTO feedback (id, project, selector, tag, anchor_text, text, author, status, created_at, page, replies)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        fb.id,
        this.project,
        fb.anchor?.selector ?? "",
        fb.anchor?.tag ?? "",
        fb.anchor?.text ?? "",
        fb.text,
        fb.author,
        fb.status,
        fb.createdAt,
        fb.page,
        JSON.stringify(fb.replies ?? []),
      ]
    );
    return fb;
  }

  private async getRow(id: string): Promise<FeedbackRow | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM feedback WHERE id = $1 AND project = $2", [
      id,
      this.project,
    ]);
    return rows[0] as unknown as FeedbackRow | undefined;
  }

  async patchFeedback(
    id: string,
    patch: Partial<Pick<Feedback, "status" | "text">>
  ): Promise<Feedback | null> {
    const row = await this.getRow(id);
    if (!row) return null;
    const status = patch.status ?? row.status;
    const text = typeof patch.text === "string" ? patch.text : row.text;
    await this.pool.query("UPDATE feedback SET status = $1, text = $2 WHERE id = $3 AND project = $4", [
      status,
      text,
      id,
      this.project,
    ]);
    return rowToFeedback({ ...row, status, text });
  }

  async addReply(id: string, input: { author: string; text: string }): Promise<Feedback | null> {
    const row = await this.getRow(id);
    if (!row) return null;
    const fb = rowToFeedback(row);
    const reply: Reply = {
      id: randomUUID(),
      author: input.author || "Anonymous",
      text: input.text,
      createdAt: new Date().toISOString(),
    };
    const replies = [...(fb.replies ?? []), reply];
    await this.pool.query("UPDATE feedback SET replies = $1 WHERE id = $2 AND project = $3", [
      JSON.stringify(replies),
      id,
      this.project,
    ]);
    return { ...fb, replies };
  }

  async listTour(): Promise<TourStep[]> {
    const { rows } = await this.pool.query("SELECT steps FROM tours WHERE project = $1", [this.project]);
    const row = rows[0] as { steps: string } | undefined;
    if (!row) return [];
    try {
      const parsed = JSON.parse(row.steps);
      return Array.isArray(parsed) ? (parsed as TourStep[]) : [];
    } catch {
      return [];
    }
  }

  async saveTour(steps: TourStep[]): Promise<TourStep[]> {
    const normalized = steps
      .map((s, i) => ({ ...s, id: s.id || randomUUID(), order: i }))
      .sort((a, b) => a.order - b.order);
    await this.pool.query(
      `INSERT INTO tours (project, steps) VALUES ($1, $2)
       ON CONFLICT (project) DO UPDATE SET steps = EXCLUDED.steps`,
      [this.project, JSON.stringify(normalized)]
    );
    return normalized;
  }

  async getSettings(): Promise<Settings> {
    const { rows } = await this.pool.query("SELECT auto_start_tour FROM settings WHERE project = $1", [
      this.project,
    ]);
    const row = rows[0] as { auto_start_tour: boolean } | undefined;
    if (!row) return { ...DEFAULT_SETTINGS };
    return { autoStartTour: !!row.auto_start_tour };
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = { ...current, ...patch };
    await this.pool.query(
      `INSERT INTO settings (project, auto_start_tour) VALUES ($1, $2)
       ON CONFLICT (project) DO UPDATE SET auto_start_tour = EXCLUDED.auto_start_tour`,
      [this.project, next.autoStartTour]
    );
    return next;
  }
}
