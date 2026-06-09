import { createHmac, timingSafeEqual } from "crypto";

function b64urlToBuf(s: string): Buffer {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  return Buffer.from(t, "base64");
}

/** Constant-time string equality (guards length leak). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a compact HS256 JWT against a shared secret. Returns the decoded
 * payload on success (signature valid, not expired / not-before), else null.
 *
 * Intentionally minimal: HS256 shared-secret only — enough for an enterprise to
 * authorize author ops with tokens their backend issues. RS256/JWKS/full OIDC
 * are deliberately out of scope.
 */
export function verifyHs256(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  let header: { alg?: string };
  try {
    header = JSON.parse(b64urlToBuf(h).toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const got = b64urlToBuf(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(b64urlToBuf(p).toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) return null;
  if (typeof payload.nbf === "number" && now < payload.nbf) return null;
  return payload;
}
