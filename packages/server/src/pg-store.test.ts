import { test } from "node:test";
import assert from "node:assert";
import { newDb } from "pg-mem";
import { migratePostgres, PostgresStore, type PgPool } from "./pg-store";

/** A fresh in-memory Postgres (pg-mem) exposing a node-pg-compatible Pool. */
async function tmpPool(): Promise<PgPool> {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as unknown as PgPool;
  await migratePostgres(pool);
  return pool;
}

const anchor = { selector: "#cta", tag: "button", text: "Go" };

test("pg: addFeedback round-trips fields + anchor", async () => {
  const pool = await tmpPool();
  const store = new PostgresStore(pool, "proj1");
  const fb = await store.addFeedback({ anchor, text: "fix", author: "Sam", page: "/" });
  assert.ok(fb.id);
  assert.equal(fb.status, "open");
  const all = await store.listFeedback();
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].anchor, anchor);
  await pool.end();
});

test("pg: patch status/text + threaded replies", async () => {
  const pool = await tmpPool();
  const store = new PostgresStore(pool, "proj1");
  const fb = await store.addFeedback({ anchor, text: "t", author: "A", page: "/" });
  const resolved = await store.patchFeedback(fb.id, { status: "resolved", text: "edited" });
  assert.equal(resolved?.status, "resolved");
  assert.equal(resolved?.text, "edited");
  await store.addReply(fb.id, { author: "Dave", text: "r1" });
  const withReply = await store.addReply(fb.id, { author: "Sam", text: "r2" });
  assert.equal(withReply?.replies?.length, 2);
  assert.equal(withReply?.replies?.[1].author, "Sam");
  assert.equal(await store.patchFeedback("missing", { status: "open" }), null);
  await pool.end();
});

test("pg: projects isolated within one database", async () => {
  const pool = await tmpPool();
  const a = new PostgresStore(pool, "alpha");
  const b = new PostgresStore(pool, "beta");
  await a.addFeedback({ anchor, text: "a1", author: "x", page: "/" });
  await a.addFeedback({ anchor, text: "a2", author: "x", page: "/" });
  await b.addFeedback({ anchor, text: "b1", author: "y", page: "/" });
  assert.equal((await a.listFeedback()).length, 2);
  assert.equal((await b.listFeedback()).length, 1);
  await pool.end();
});

test("pg: saveTour normalizes + settings default then persist", async () => {
  const pool = await tmpPool();
  const store = new PostgresStore(pool, "proj1");
  const saved = await store.saveTour([
    { id: "", anchor, title: "two", body: "", order: 5, page: "/" },
    { id: "x", anchor, title: "one", body: "", order: 9, page: "/" },
  ]);
  assert.equal(saved[0].order, 0);
  assert.equal(saved[1].order, 1);
  assert.ok(saved[0].id);
  assert.equal((await store.getSettings()).autoStartTour, true);
  await store.saveSettings({ autoStartTour: false });
  assert.equal((await store.getSettings()).autoStartTour, false);
  await pool.end();
});
