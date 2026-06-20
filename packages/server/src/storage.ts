import * as path from "path";
import { Store, type StorageAdapter } from "./store";
import { migratePostgres, PostgresStore, type PgPool } from "./pg-store";

export type StorageBackend = "file" | "sqlite" | "postgres";

export interface StorageOptions {
  /** Storage engine. "file" (default), "sqlite" (one DB file), or "postgres". */
  backend?: StorageBackend;
  /** Root directory for file storage and the default SQLite location. */
  dataDir: string;
  /** Explicit SQLite file path (defaults to <dataDir>/reviewx.sqlite). */
  sqlitePath?: string;
  /** Postgres connection string (required when backend = "postgres"). */
  databaseUrl?: string;
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


class PostgresStorageProvider implements StorageProvider {
  readonly label: string;
  private cache = new Map<string, PostgresStore>();
  constructor(private pool: PgPool, redactedUrl: string) {
    this.label = `postgres (${redactedUrl})`;
  }
  for(project: string): StorageAdapter {
    let s = this.cache.get(project);
    if (!s) {
      s = new PostgresStore(this.pool, project);
      this.cache.set(project, s);
    }
    return s;
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** Hide credentials in a connection string before logging it. */
function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "postgres";
  }
}

/**
 * Build the storage provider the inbox should use. Async because Postgres must
 * connect + migrate before serving; file/sqlite resolve immediately.
 */
export async function createStorageProvider(opts: StorageOptions): Promise<StorageProvider> {
  if (opts.backend === "postgres") {
    if (!opts.databaseUrl) {
      throw new Error("postgres storage requires a connection string (--database-url or DATABASE_URL)");
    }
    let Pool: new (config: { connectionString: string }) => PgPool;
    try {
      ({ Pool } = (await import("pg")) as unknown as {
        Pool: new (config: { connectionString: string }) => PgPool;
      });
    } catch {
      throw new Error('postgres storage needs the "pg" package — run: npm install pg');
    }
    const pool = new Pool({ connectionString: opts.databaseUrl });
    await migratePostgres(pool);
    return new PostgresStorageProvider(pool, redactUrl(opts.databaseUrl));
  }
  if (opts.backend === "sqlite") {
    const dbPath = opts.sqlitePath || path.join(opts.dataDir, "reviewx.sqlite");
    // Dynamic import so node:sqlite is only required when sqlite is actually used.
    // VS Code's embedded Node (18/20) doesn't have node:sqlite; the extension
    // never calls createInbox so this path is never hit inside the extension.
    const { SqliteDatabase, SqliteStore } = await import("./sqlite-store");
    const shared = new SqliteDatabase(dbPath);
    const cache = new Map<string, InstanceType<typeof SqliteStore>>();
    return {
      label: `sqlite (${dbPath})`,
      for(project: string): StorageAdapter {
        let s = cache.get(project);
        if (!s) { s = new SqliteStore(shared, project); cache.set(project, s); }
        return s;
      },
      async close() { shared.close(); },
    };
  }
  return new FileStorageProvider(opts.dataDir);
}
