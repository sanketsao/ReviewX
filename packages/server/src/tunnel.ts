import { spawn, exec, ChildProcess } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import * as os from "os";
import * as path from "path";

export interface Tunnel {
  url: string;
  stop: () => void;
}

const execAsync = promisify(exec);

// ── Cloudflare quick tunnel (zero-account, auto-installed fallback) ───────────
//
// cloudflared is a single static binary. If it isn't already installed, we
// download the official Cloudflare release for this platform into a cache dir
// (~/.reviewsx/bin) once, so sharing "just works" with no setup — important for
// non-technical builders.

const CLOUDFLARE_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

/** Resolve a usable cloudflared binary, downloading it on first use if needed. */
export async function ensureCloudflared(
  onStatus?: (msg: string) => void
): Promise<string> {
  // 1. Already on PATH?
  try {
    await execAsync("cloudflared --version");
    return "cloudflared";
  } catch { /* not on PATH */ }

  // 2. Common install locations (Homebrew etc.)
  for (const p of ["/opt/homebrew/bin/cloudflared", "/usr/local/bin/cloudflared"]) {
    if (existsSync(p)) return p;
  }

  // 3. Previously downloaded into our cache?
  const cacheDir = path.join(os.homedir(), ".reviewsx", "bin");
  const ext = process.platform === "win32" ? ".exe" : "";
  const cached = path.join(cacheDir, `cloudflared${ext}`);
  if (existsSync(cached)) return cached;

  // 4. Download the official release for this platform.
  onStatus?.("Setting up the secure link (one-time, ~35 MB)…");
  return downloadCloudflared(cacheDir, cached);
}

async function downloadCloudflared(cacheDir: string, dest: string): Promise<string> {
  mkdirSync(cacheDir, { recursive: true });
  const base = "https://github.com/cloudflare/cloudflared/releases/latest/download";
  const plat = process.platform;
  const arch = process.arch; // 'arm64' | 'x64' | ...

  let url: string;
  let isTgz = false;
  if (plat === "darwin") {
    url = `${base}/cloudflared-darwin-${arch === "arm64" ? "arm64" : "amd64"}.tgz`;
    isTgz = true; // macOS release ships as a .tgz containing the binary
  } else if (plat === "linux") {
    url = `${base}/cloudflared-linux-${arch === "arm64" ? "arm64" : "amd64"}`;
  } else if (plat === "win32") {
    url = `${base}/cloudflared-windows-${arch === "x64" ? "amd64" : "386"}.exe`;
  } else {
    throw new Error(`No cloudflared build available for ${plat}/${arch}.`);
  }

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Could not download cloudflared (HTTP ${res.status}).`);
  const bytes = Buffer.from(await res.arrayBuffer());

  if (isTgz) {
    const tgz = path.join(cacheDir, "cloudflared.tgz");
    writeFileSync(tgz, bytes);
    await execAsync(`tar -xzf "${tgz}" -C "${cacheDir}"`); // extracts "cloudflared"
  } else {
    writeFileSync(dest, bytes);
  }
  try { chmodSync(dest, 0o755); } catch { /* windows */ }
  if (!existsSync(dest)) throw new Error("cloudflared download did not produce a binary.");
  return dest;
}

/**
 * Open a public URL to a local port via a Cloudflare quick tunnel. Auto-installs
 * cloudflared on first use. `onStatus` surfaces one-time setup progress.
 */
export async function startTunnel(
  port: number,
  bin?: string,
  onStatus?: (msg: string) => void
): Promise<Tunnel> {
  const cloudflared = bin ?? (await ensureCloudflared(onStatus));
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(cloudflared, ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`]);
    } catch (err) {
      return reject(err);
    }

    let settled = false;
    const onData = (buf: Buffer) => {
      const m = buf.toString().match(CLOUDFLARE_URL_RE);
      if (m && !settled) {
        settled = true;
        resolve({ url: m[0], stop: () => child.kill() });
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData); // cloudflared prints the URL on stderr

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      reject(new Error(`Could not start the secure link: ${err.message}`));
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error("Timed out opening the public link. Check your internet connection and try again."));
      }
    }, 30000);
  });
}

// ── Tailscale Funnel ──────────────────────────────────────────────────────────
//
// `tailscale funnel <port>` tells the local Tailscale daemon to serve port 443
// from the internet → 127.0.0.1:<port>. Public URL is the stable
// https://<machine>.<tailnet>.ts.net. stop() runs `tailscale funnel reset`.

interface TailscaleStatus {
  Self?: { DNSName?: string; Online?: boolean };
}

/** Find the tailscale CLI. On macOS it lives inside the app bundle, not on PATH. */
function resolveTailscaleBin(): string {
  const candidates = [
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale", // macOS app bundle
    "/opt/homebrew/bin/tailscale",
    "/usr/local/bin/tailscale",
    "/usr/bin/tailscale",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "tailscale"; // fall back to PATH
}

function quote(bin: string): string {
  return bin.includes(" ") ? `"${bin}"` : bin;
}

export async function startTailscaleTunnel(port: number): Promise<Tunnel> {
  const bin = resolveTailscaleBin();
  const b = quote(bin);

  // Enable funnel for the port.
  try {
    await execAsync(`${b} funnel ${port}`);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") {
      throw new Error(
        "Tailscale isn't installed. Download it from tailscale.com/download, open the app and sign in, then try again."
      );
    }
    const detail = (e.stderr ?? (e as Error).message ?? "").toLowerCase();
    if (detail.includes("funnel") && (detail.includes("not enabled") || detail.includes("not available") || detail.includes("denied"))) {
      throw new Error(
        "Tailscale Funnel isn't enabled for your account yet. Open the Tailscale admin console → enable Funnel, then try again. (See tailscale.com/kb/1223/funnel.)"
      );
    }
    if (detail.includes("logged out") || detail.includes("not logged in") || detail.includes("NeedsLogin")) {
      throw new Error("Tailscale is signed out. Open the Tailscale app, sign in, then try again.");
    }
    throw new Error(`Tailscale couldn't open the link: ${(e.stderr ?? (e as Error).message ?? "").trim()}`);
  }

  // Resolve the machine's stable public DNS name.
  let dnsName: string;
  try {
    const { stdout } = await execAsync(`${b} status --json`);
    const status = JSON.parse(stdout) as TailscaleStatus;
    if (!status.Self?.Online) {
      throw new Error("Tailscale is connected but offline. Open the Tailscale app and make sure it's connected, then try again.");
    }
    dnsName = (status.Self.DNSName ?? "").replace(/\.$/, "");
  } catch (err) {
    if ((err as Error).message.startsWith("Tailscale")) throw err;
    throw new Error("Couldn't read Tailscale status. Open the Tailscale app, make sure it's connected, then try again.");
  }

  if (!dnsName) {
    throw new Error("Tailscale didn't return a public address. Open the Tailscale app, sign in, then try again.");
  }

  return {
    url: `https://${dnsName}`,
    stop: () => { exec(`${b} funnel reset`, () => { /* ignore cleanup errors */ }); },
  };
}
