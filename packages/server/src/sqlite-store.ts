import { DatabaseSync } from "node:sqlite";
import * as path from "path";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";
import type { StorageAdapter } from "./store";
import type { Anchor, Feedback, Reply, Settings, TourStep } from "./types";

const DEFAULT_SETTINGS: Settings = { autoStartTour: true };

/**
 * Opens (and migrates) a single SQLite database that holds every project's data,
 * partitioned by a `project` column. One connection is shared across all
 * per-project adapters for the process lifetime.
 *
 * Feedback is stored as real, queryable rows (the enterprise reporting need);
 * its reply thread and anchor ride along as JSON columns since they're only ever
 * read/written as part of their parent comment.
 */
export class SqliteDatabase {
  readonly db: DatabaseSync;

  constructor(filePath: string) {
    mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
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
      );
      CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project, created_at);
      CREATE TABLE IF NOT EXISTS tours (
        project TEXT PRIMARY KEY,
        steps   TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS settings (
        project         TEXT PRIMARY KEY,
        auto_start_tour INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS tokens (
        project TEXT PRIMARY KEY,
        token   TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }
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

/** SQLite-backed {@link StorageAdapter} scoped to a single project. */
export class SqliteStore implements StorageAdapter {
  constructor(private shared: SqliteDatabase, private project: string) {}

  private get db(): DatabaseSync {
    return this.shared.db;
  }

  async listFeedback(): Promise<Feedback[]> {
    const rows = this.db
      .prepare("SELECT * FROM feedback WHERE project = ? ORDER BY created_at ASC")
      .all(this.project) as unknown as FeedbackRow[];
    return rows.map(rowToFeedback);
  }

  async addFeedback(input: Omit<Feedback, "id" | "createdAt" | "status">): Promise<Feedback> {
    const fb: Feedback = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "open",
      ...input,
    };
    this.db
      .prepare(
        `INSERT INTO feedback (id, project, selector, tag, anchor_text, text, author, status, created_at, page, replies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        JSON.stringify(fb.replies ?? [])
      );
    return fb;
  }

  private getRow(id: string): FeedbackRow | undefined {
    return this.db
      .prepare("SELECT * FROM feedback WHERE id = ? AND project = ?")
      .get(id, this.project) as unknown as FeedbackRow | undefined;
  }

  async patchFeedback(
    id: string,
    patch: Partial<Pick<Feedback, "status" | "text">>
  ): Promise<Feedback | null> {
    const row = this.getRow(id);
    if (!row) return null;
    const status = patch.status ?? row.status;
    const text = typeof patch.text === "string" ? patch.text : row.text;
    this.db
      .prepare("UPDATE feedback SET status = ?, text = ? WHERE id = ? AND project = ?")
      .run(status, text, id, this.project);
    return rowToFeedback({ ...row, status, text });
  }

  async addReply(id: string, input: { author: string; text: string }): Promise<Feedback | null> {
    const row = this.getRow(id);
    if (!row) return null;
    const fb = rowToFeedback(row);
    const reply: Reply = {
      id: randomUUID(),
      author: input.author || "Anonymous",
      text: input.text,
      createdAt: new Date().toISOString(),
    };
    const replies = [...(fb.replies ?? []), reply];
    this.db
      .prepare("UPDATE feedback SET replies = ? WHERE id = ? AND project = ?")
      .run(JSON.stringify(replies), id, this.project);
    return { ...fb, replies };
  }

  async listTour(): Promise<TourStep[]> {
    const row = this.db
      .prepare("SELECT steps FROM tours WHERE project = ?")
      .get(this.project) as { steps: string } | undefined;
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
    this.db
      .prepare(
        `INSERT INTO tours (project, steps) VALUES (?, ?)
         ON CONFLICT(project) DO UPDATE SET steps = excluded.steps`
      )
      .run(this.project, JSON.stringify(normalized));
    return normalized;
  }

  async getSettings(): Promise<Settings> {
    const row = this.db
      .prepare("SELECT auto_start_tour FROM settings WHERE project = ?")
      .get(this.project) as { auto_start_tour: number } | undefined;
    if (!row) return { ...DEFAULT_SETTINGS };
    return { autoStartTour: !!row.auto_start_tour };
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = { ...current, ...patch };
    this.db
      .prepare(
        `INSERT INTO settings (project, auto_start_tour) VALUES (?, ?)
         ON CONFLICT(project) DO UPDATE SET auto_start_tour = excluded.auto_start_tour`
      )
      .run(this.project, next.autoStartTour ? 1 : 0);
    return next;
  }

  async getToken(): Promise<string | null> {
    const row = this.db
      .prepare("SELECT token FROM tokens WHERE project = ?")
      .get(this.project) as { token: string } | undefined;
    return row?.token ?? null;
  }

  async setToken(token: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tokens (project, token) VALUES (?, ?)
         ON CONFLICT(project) DO UPDATE SET token = excluded.token`
      )
      .run(this.project, token);
  }
}
