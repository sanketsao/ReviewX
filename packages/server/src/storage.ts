import * as path from "path";
import { Store, type StorageAdapter } from "./store";
import { SqliteDatabase, SqliteStore } from "./sqlite-store";

export type StorageBackend = "file" | "sqlite";

export interface StorageOptions {
  /** Storage engine. "file" (default) = JSON per project; "sqlite" = one DB. */
  backend?: StorageBackend;
  /** Root directory for file storage and the default SQLite location. */
  dataDir: string;
  /** Explicit SQLite file path (defaults to <dataDir>/reviewx.sqlite). */
  sqlitePath?: string;
}

/**
 * Hands out a {@link StorageAdapter} per project from one chosen backend, so the
 * inbox stays storage-agnostic. Adapters are cached for the process lifetime.
 */
export interface StorageProvider {
  /** Get the adapter for a (pre-sanitized) project id. */
  for(project: string): StorageAdapter;
  /** Human label for logs/diagnostics. */
  readonly label: string;
  close(): Promise<void>;
}

class FileStorageProvider implements StorageProvider {
  readonly label: string;
  private cache = new Map<string, Store>();
  constructor(private dataRoot: string) {
    this.label = `file (${dataRoot})`;
  }
  for(project: string): StorageAdapter {
    let s = this.cache.get(project);
    if (!s) {
      s = new Store(path.join(this.dataRoot, project));
      this.cache.set(project, s);
    }
    return s;
  }
  async close(): Promise<void> {
    /* nothing to release for file storage */
  }
}

class SqliteStorageProvider implements StorageProvider {
  readonly label: string;
  private cache = new Map<string, SqliteStore>();
  private shared: SqliteDatabase;
  constructor(dbPath: string) {
    this.shared = new SqliteDatabase(dbPath);
    this.label = `sqlite (${dbPath})`;
  }
  for(project: string): StorageAdapter {
    let s = this.cache.get(project);
    if (!s) {
      s = new SqliteStore(this.shared, project);
      this.cache.set(project, s);
    }
    return s;
  }
  async close(): Promise<void> {
    this.shared.close();
  }
}

/** Build the storage provider the inbox should use, from config/env. */
export function createStorageProvider(opts: StorageOptions): StorageProvider {
  if (opts.backend === "sqlite") {
    const dbPath = opts.sqlitePath || path.join(opts.dataDir, "reviewx.sqlite");
    return new SqliteStorageProvider(dbPath);
  }
  return new FileStorageProvider(opts.dataDir);
}
