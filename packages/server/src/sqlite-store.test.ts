import { test } from "node:test";
import assert from "node:assert";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { SqliteDatabase, SqliteStore } from "./sqlite-store";
import type { StorageAdapter } from "./store";

async function tmpDb(): Promise<{ db: SqliteDatabase; file: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rx-sql-"));
  const file = path.join(dir, "reviewx.sqlite");
  return { db: new SqliteDatabase(file), file };
}

const anchor = { selector: "#cta", tag: "button", text: "Go" };

test("addFeedback assigns id/status/createdAt and round-trips the anchor", async () => {
  const { db } = await tmpDb();
  const store: StorageAdapter = new SqliteStore(db, "proj1");
  const fb = await store.addFeedback({ anchor, text: "fix this", author: "Sam", page: "/" });
  assert.ok(fb.id);
  assert.equal(fb.status, "open");
  assert.ok(fb.createdAt);
  const all = await store.listFeedback();
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].anchor, anchor);
  assert.equal(all[0].text, "fix this");
  db.close();
});

test("patchFeedback updates status + text; addReply appends a thread", async () => {
  const { db } = await tmpDb();
  const store = new SqliteStore(db, "proj1");
  const fb = await store.addFeedback({ anchor, text: "t", author: "A", page: "/" });
  const resolved = await store.patchFeedback(fb.id, { status: "resolved", text: "edited" });
  assert.equal(resolved?.status, "resolved");
  assert.equal(resolved?.text, "edited");

  await store.addReply(fb.id, { author: "Dave", text: "r1" });
  const withReply = await store.addReply(fb.id, { author: "Sam", text: "r2" });
  assert.equal(withReply?.replies?.length, 2);
  assert.equal(withReply?.replies?.[0].author, "Dave");
  assert.equal(withReply?.replies?.[1].text, "r2");

  assert.equal(await store.patchFeedback("missing", { status: "open" }), null);
  db.close();
});

test("projects are isolated within one database", async () => {
  const { db } = await tmpDb();
  const a = new SqliteStore(db, "alpha");
  const b = new SqliteStore(db, "beta");
  await a.addFeedback({ anchor, text: "a1", author: "x", page: "/" });
  await a.addFeedback({ anchor, text: "a2", author: "x", page: "/" });
  await b.addFeedback({ anchor, text: "b1", author: "y", page: "/" });
  assert.equal((await a.listFeedback()).length, 2);
  assert.equal((await b.listFeedback()).length, 1);
  db.close();
});

test("saveTour normalizes order/ids and getSettings defaults then persists", async () => {
  const { db } = await tmpDb();
  const store = new SqliteStore(db, "proj1");
  const saved = await store.saveTour([
    { id: "", anchor, title: "two", body: "", order: 5, page: "/" },
    { id: "x", anchor, title: "one", body: "", order: 9, page: "/" },
  ]);
  assert.equal(saved[0].order, 0);
  assert.equal(saved[1].order, 1);
  assert.ok(saved[0].id, "blank id is filled");

  assert.equal((await store.getSettings()).autoStartTour, true); // default
  await store.saveSettings({ autoStartTour: false });
  assert.equal((await store.getSettings()).autoStartTour, false);
  db.close();
});

test("data survives reopening the database file", async () => {
  const { db, file } = await tmpDb();
  await new SqliteStore(db, "proj1").addFeedback({ anchor, text: "persist", author: "A", page: "/" });
  db.close();
  const reopened = new SqliteDatabase(file);
  const all = await new SqliteStore(reopened, "proj1").listFeedback();
  assert.equal(all.length, 1);
  assert.equal(all[0].text, "persist");
  reopened.close();
});
