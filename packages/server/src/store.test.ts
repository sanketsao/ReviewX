import { test } from "node:test";
import assert from "node:assert";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { Store } from "./store";

async function tmpStore(): Promise<Store> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pf-"));
  return new Store(dir);
}

const anchor = { selector: "body > h1", tag: "h1", text: "Hello" };

test("addFeedback assigns id, status, createdAt and persists", async () => {
  const store = await tmpStore();
  const fb = await store.addFeedback({ anchor, text: "fix this", author: "Sam", page: "/" });
  assert.ok(fb.id);
  assert.equal(fb.status, "open");
  assert.ok(fb.createdAt);
  const all = await store.listFeedback();
  assert.equal(all.length, 1);
  assert.equal(all[0].text, "fix this");
});

test("patchFeedback updates status", async () => {
  const store = await tmpStore();
  const fb = await store.addFeedback({ anchor, text: "x", author: "A", page: "/" });
  const updated = await store.patchFeedback(fb.id, { status: "resolved" });
  assert.equal(updated?.status, "resolved");
  assert.equal((await store.patchFeedback("nope", { status: "open" })), null);
});

test("concurrent writes are serialized without loss", async () => {
  const store = await tmpStore();
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      store.addFeedback({ anchor, text: `c${i}`, author: "A", page: "/" })
    )
  );
  const all = await store.listFeedback();
  assert.equal(all.length, 25);
});

test("saveTour normalizes order and ids", async () => {
  const store = await tmpStore();
  const saved = await store.saveTour([
    { id: "", anchor, title: "Two", body: "", order: 5, page: "/" },
    { id: "", anchor, title: "One", body: "", order: 1, page: "/" },
  ]);
  assert.equal(saved[0].order, 0);
  assert.equal(saved[1].order, 1);
  assert.ok(saved[0].id && saved[1].id);
});
