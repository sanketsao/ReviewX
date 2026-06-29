// Automated self-host smoke test (Tier 1 of docs/TESTING-SELFHOST.md).
// Brings up the Docker Compose inbox + Postgres, then asserts: health,
// create/list feedback, persistence across restart, and TOFU token auth.
// Requires Docker. Run: node e2e/scripts/selfhost-smoke.mjs
import { execSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPOSE = join(REPO, "deploy", "docker-compose");
const BASE = "http://localhost:4400";
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: COMPOSE, stdio: "pipe", ...opts }).toString();
const hex = () => randomBytes(16).toString("hex");

let failed = 0;
const check = (label, fn) => {
  process.stdout.write(`• ${label} … `);
  try { fn(); console.log("PASS"); }
  catch (e) { console.log("FAIL\n  " + (e.message || e)); failed++; }
};

async function get(url) { const r = await fetch(url); return { status: r.status, json: await r.json().catch(() => null) }; }
async function api(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { "X-PF-Token": token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
const waitHealthy = async () => {
  for (let i = 0; i < 30; i++) {
    try { if ((await get(`${BASE}/health`)).status === 200) return; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("inbox never became healthy");
};

const ADMIN = hex();
if (!existsSync(join(COMPOSE, ".env"))) {
  writeFileSync(join(COMPOSE, ".env"), `POSTGRES_PASSWORD=${hex()}\nREVIEWX_ADMIN_TOKEN=${ADMIN}\n`);
  console.log("[selfhost] wrote a fresh .env");
}

try {
  console.log("[selfhost] docker compose up -d …");
  sh("docker compose up -d");
  await waitHealthy();

  let fid;
  await (async () => {
    check("health reports postgres", async () => {
      const h = await get(`${BASE}/health`);
      if (!h.json?.ok || !String(h.json.storage).includes("postgres")) throw new Error(JSON.stringify(h.json));
    });
    const text = `selfhost ${Date.now()}`;
    check("create feedback", async () => {
      const r = await api("POST", "/feedback", { text, anchor: { selector: "body" }, project: "smoke", author: "R", page: "/" });
      if (r.status !== 201) throw new Error(`status ${r.status}`);
      fid = r.json.id;
    });
    check("list feedback", async () => {
      const r = await api("GET", "/feedback?project=smoke");
      if (!r.json?.some((f) => f.text === text)) throw new Error("not found");
    });
  })();

  console.log("[selfhost] docker compose restart …");
  sh("docker compose restart");
  await waitHealthy();
  check("feedback persisted across restart", async () => {
    const r = await api("GET", "/feedback?project=smoke");
    if (!r.json?.length) throw new Error("data lost after restart");
  });

  // TOFU auth on a fresh project: claim with a token, then verify lockdown.
  let aid;
  await (async () => {
    const r = await api("POST", "/feedback", { text: "auth", anchor: { selector: "body" }, project: "auth", author: "R", page: "/" });
    aid = r.json.id;
  })();
  check("claim project with token (200)", async () => {
    const r = await api("PATCH", `/feedback/${aid}`, { status: "resolved", project: "auth" }, "secret123");
    if (r.status !== 200) throw new Error(`status ${r.status}`);
  });
  check("no token after claim is rejected (401)", async () => {
    const r = await api("PATCH", `/feedback/${aid}`, { status: "open", project: "auth" });
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  });
  check("wrong token is rejected (403)", async () => {
    const r = await api("PATCH", `/feedback/${aid}`, { status: "open", project: "auth" }, "nope");
    if (r.status !== 403) throw new Error(`expected 403, got ${r.status}`);
  });
} finally {
  console.log("[selfhost] docker compose down …");
  try { sh("docker compose down"); } catch { /* ignore */ }
}

console.log("\n" + (failed === 0 ? "✅ self-host smoke PASSED" : `❌ ${failed} check(s) FAILED`));
process.exit(failed === 0 ? 0 : 1);
