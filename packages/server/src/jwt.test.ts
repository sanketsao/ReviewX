import { test } from "node:test";
import assert from "node:assert";
import { createHmac } from "crypto";
import { safeEqual, verifyHs256 } from "./jwt";

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function sign(payload: Record<string, unknown>, secret: string, alg = "HS256"): string {
  const head = b64url({ alg, typ: "JWT" });
  const body = b64url(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const SECRET = "super-secret";

test("verifyHs256 accepts a valid, unexpired token", () => {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const payload = verifyHs256(sign({ sub: "alice", exp }, SECRET), SECRET);
  assert.ok(payload);
  assert.equal(payload?.sub, "alice");
});

test("verifyHs256 rejects wrong secret, expired, malformed, and non-HS256", () => {
  const good = sign({ sub: "a", exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  assert.equal(verifyHs256(good, "other-secret"), null, "wrong secret");
  const expired = sign({ sub: "a", exp: Math.floor(Date.now() / 1000) - 5 }, SECRET);
  assert.equal(verifyHs256(expired, SECRET), null, "expired");
  assert.equal(verifyHs256("not.a.jwt", SECRET), null, "malformed");
  assert.equal(verifyHs256("only-two.parts", SECRET), null, "too few parts");
  const none = sign({ sub: "a" }, SECRET, "none");
  assert.equal(verifyHs256(none, SECRET), null, "alg!=HS256 rejected");
});

test("safeEqual compares correctly", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});
