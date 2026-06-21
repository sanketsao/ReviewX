#!/usr/bin/env node
/**
 * Release gate for ReviewSX. Run after any version bump / before publishing:
 *   npm run verify
 *
 * Builds everything, runs the test suite, packages the VSIX, and verifies the
 * package is valid and correctly identified. Exits non-zero if anything fails,
 * so a QA agent (or CI) can gate on it.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = join(ROOT, "packages", "vscode-extension");
const VSIX = join(EXT, "prototype-review-0.1.0.vsix");

const EXPECT_PUBLISHER = "reviewsx";
const EXPECT_NAME = "prototype-review";

let failed = 0;
const results = [];

function step(label, fn) {
  process.stdout.write(`• ${label} … `);
  try {
    fn();
    console.log("PASS");
    results.push([true, label]);
  } catch (e) {
    console.log("FAIL");
    console.log(`    ${String(e.message || e).split("\n").slice(0, 4).join("\n    ")}`);
    results.push([false, label]);
    failed++;
  }
}

const run = (cmd, cwd = ROOT) =>
  execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

step("Build overlay bundles (overlay.js + reviewsx.js)", () => {
  run("npm run build -w @protofeedback/overlay");
  for (const f of ["overlay.js", "reviewsx.js"]) {
    if (!existsSync(join(ROOT, "packages/overlay/dist", f))) throw new Error(`missing dist/${f}`);
  }
});

step("Build server", () => run("npm run build -w @protofeedback/server"));

step("Server test suite (21+ tests)", () => {
  const out = run("npm test -w @protofeedback/server");
  const fail = /^# fail (\d+)/m.exec(out);
  if (fail && Number(fail[1]) > 0) throw new Error(`${fail[1]} test(s) failed`);
  if (!/# pass \d+/.test(out)) throw new Error("no test summary found");
});

step("Package VSIX", () => run("npm run package", EXT));

step("VSIX integrity (unzip -t)", () => {
  if (!existsSync(VSIX)) throw new Error("VSIX not produced");
  const out = run(`unzip -t "${VSIX}"`);
  if (!/No errors detected/.test(out)) throw new Error("archive failed integrity check");
});

step("VSIX contains icon, README, LICENSE", () => {
  const list = run(`unzip -l "${VSIX}"`);
  for (const f of ["images/icon.png", "README.md", "LICENSE", "dist/reviewsx.js", "out/extension.js"]) {
    if (!list.includes(f)) throw new Error(`missing ${f} in VSIX`);
  }
});

step(`Marketplace identity is ${EXPECT_PUBLISHER}.${EXPECT_NAME}`, () => {
  const pkg = JSON.parse(readFileSync(join(EXT, "package.json"), "utf8"));
  if (pkg.publisher !== EXPECT_PUBLISHER) throw new Error(`publisher is "${pkg.publisher}"`);
  if (pkg.name !== EXPECT_NAME) throw new Error(`name is "${pkg.name}"`);
});

console.log("\n" + "─".repeat(48));
const passed = results.filter(([ok]) => ok).length;
console.log(`${failed === 0 ? "✅ ALL CHECKS PASSED" : "❌ " + failed + " CHECK(S) FAILED"}  (${passed}/${results.length})`);
process.exit(failed === 0 ? 0 : 1);
