import { promises as fs } from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import type { Feedback, Reply, Settings, TourStep } from "./types";

const DEFAULT_SETTINGS: Settings = { autoStartTour: true };

/**
 * Persistence contract for one project's feedback, tours, and settings.
 * The inbox and local server talk to this interface, not a concrete store, so
 * the backing engine (local files, SQLite, or a future hosted DB) is swappable
 * — the enabler for self-hosted "bring-your-own-database" deployments.
 */
export interface StorageAdapter {
  listFeedback(): Promise<Feedback[]>;
  addFeedback(input: Omit<Feedback, "id" | "createdAt" | "status">): Promise<Feedback>;
  patchFeedback(id: string, patch: Partial<Pick<Feedback, "status" | "text">>): Promise<Feedback | null>;
  addReply(id: string, input: { author: string; text: string }): Promise<Feedback | null>;
  listTour(): Promise<TourStep[]>;
  saveTour(steps: TourStep[]): Promise<TourStep[]>;
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;

  /** The project's trust-on-first-use author token, or null if unclaimed. */
  getToken(): Promise<string | null>;
  /** Persist the project's author token (claimed on first tokened request). */
  setToken(token: string): Promise<void>;
}

/**
 * File-backed store for tours + feedback under <dataDir>/.protofeedback/.
 * Writes are serialized through a per-store promise chain so concurrent
 * requests in this process cannot interleave and corrupt the JSON files.
 */
export class Store implements StorageAdapter {
  private dir: string;
  private feedbackFile: string;
  private tourFile: string;
  private settingsFile: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, ".protofeedback");
    this.feedbackFile = path.join(this.dir, "feedback.json");
    this.tourFile = path.join(this.dir, "tour.json");
    this.settingsFile = path.join(this.dir, "settings.json");
  }

  private async readArray<T>(file: string): Promise<T[]> {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  private async writeArray<T>(file: string, data: T[]): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, file);
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  listFeedback(): Promise<Feedback[]> {
    return this.readArray<Feedback>(this.feedbackFile);
  }

  addFeedback(input: Omit<Feedback, "id" | "createdAt" | "status">): Promise<Feedback> {
    return this.serialize(async () => {
      const all = await this.readArray<Feedback>(this.feedbackFile);
      const fb: Feedback = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: "open",
        ...input,
      };
      all.push(fb);
      await this.writeArray(this.feedbackFile, all);
      return fb;
    });
  }

  patchFeedback(id: string, patch: Partial<Pick<Feedback, "status" | "text">>): Promise<Feedback | null> {
    return this.serialize(async () => {
      const all = await this.readArray<Feedback>(this.feedbackFile);
      const fb = all.find((f) => f.id === id);
      if (!fb) return null;
      if (patch.status) fb.status = patch.status;
      if (typeof patch.text === "string") fb.text = patch.text;
      await this.writeArray(this.feedbackFile, all);
      return fb;
    });
  }

  addReply(id: string, input: { author: string; text: string }): Promise<Feedback | null> {
    return this.serialize(async () => {
      const all = await this.readArray<Feedback>(this.feedbackFile);
      const fb = all.find((f) => f.id === id);
      if (!fb) return null;
      const reply: Reply = {
        id: randomUUID(),
        author: input.author || "Anonymous",
        text: input.text,
        createdAt: new Date().toISOString(),
      };
      fb.replies = [...(fb.replies || []), reply];
      await this.writeArray(this.feedbackFile, all);
      return fb;
    });
  }

  listTour(): Promise<TourStep[]> {
    return this.readArray<TourStep>(this.tourFile);
  }

  saveTour(steps: TourStep[]): Promise<TourStep[]> {
    return this.serialize(async () => {
      const normalized = steps
        .map((s, i) => ({ ...s, id: s.id || randomUUID(), order: i }))
        .sort((a, b) => a.order - b.order);
      await this.writeArray(this.tourFile, normalized);
      return normalized;
    });
  }

  async getSettings(): Promise<Settings> {
    try {
      const raw = await fs.readFile(this.settingsFile, "utf8");
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...(parsed as Partial<Settings>) };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULT_SETTINGS };
      throw err;
    }
  }

  saveSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.serialize(async () => {
      const current = await this.getSettings();
      const next: Settings = { ...current, ...patch };
      await this.mkdirAndWrite(this.settingsFile, JSON.stringify(next, null, 2));
      return next;
    });
  }

  async getToken(): Promise<string | null> {
    try {
      const raw = await fs.readFile(path.join(this.dir, "secret.json"), "utf8");
      const t = (JSON.parse(raw) as { token?: unknown }).token;
      return typeof t === "string" && t ? t : null;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  setToken(token: string): Promise<void> {
    return this.serialize(async () => {
      await this.mkdirAndWrite(path.join(this.dir, "secret.json"), JSON.stringify({ token }, null, 2));
    });
  }

  private async mkdirAndWrite(file: string, contents: string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, contents, "utf8");
    await fs.rename(tmp, file);
  }
}
