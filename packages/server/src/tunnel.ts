import { spawn, exec, ChildProcess } from "child_process";
import { promisify } from "util";

export interface Tunnel {
  url: string;
  stop: () => void;
}

const execAsync = promisify(exec);

// ── Cloudflare quick tunnel (fallback / no-account option) ───────────────────

const CLOUDFLARE_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

export function startTunnel(port: number, bin = "cloudflared"): Promise<Tunnel> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(bin, [
        "tunnel",
        "--no-autoupdate",
        "--url",
        `http://127.0.0.1:${port}`,
      ]);
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
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "cloudflared not found. Install it (brew install cloudflared) to share a public URL."
          )
        );
      } else {
        reject(err);
      }
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error("Timed out waiting for cloudflared tunnel URL"));
      }
    }, 20000);
  });
}

// ── Tailscale Funnel ──────────────────────────────────────────────────────────
//
// `tailscale funnel <port>` tells the local Tailscale daemon to accept HTTPS
// traffic on port 443 from the internet and forward it to 127.0.0.1:<port>.
// The public URL is https://<machine>.<tailnet>.ts.net — stable across sessions.
// stop() runs `tailscale funnel reset` which removes the forward.

interface TailscaleStatus {
  Self?: { DNSName?: string; Online?: boolean };
}

export async function startTailscaleTunnel(
  port: number,
  bin = "tailscale"
): Promise<Tunnel> {
  // Enable funnel for the port.
  try {
    await execAsync(`${bin} funnel ${port}`);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") {
      throw new Error(
        "tailscale CLI not found. Install Tailscale from https://tailscale.com/download and make sure the daemon is running."
      );
    }
    const detail = (e.stderr ?? (e as Error).message ?? "").trim();
    throw new Error(
      `tailscale funnel ${port} failed: ${detail}\n\n` +
        "Make sure Tailscale is running (tailscale up) and Funnel is enabled for your account."
    );
  }

  // Resolve the machine's stable public DNS name.
  let dnsName: string;
  try {
    const { stdout } = await execAsync(`${bin} status --json`);
    const status = JSON.parse(stdout) as TailscaleStatus;
    if (!status.Self?.Online) {
      throw new Error("Tailscale is not connected. Run: tailscale up");
    }
    dnsName = (status.Self.DNSName ?? "").replace(/\.$/, "");
  } catch (err) {
    // If we already have a formatted message, re-throw it.
    if ((err as Error).message.startsWith("Tailscale")) throw err;
    throw new Error(
      "Could not read tailscale status. Is the Tailscale daemon running?"
    );
  }

  if (!dnsName) {
    throw new Error(
      "Tailscale returned an empty DNS name. Log in first: tailscale up"
    );
  }

  const url = `https://${dnsName}`;
  return {
    url,
    stop: () => {
      // Fire-and-forget: reset all funnel config when the session ends.
      exec(`${bin} funnel reset`, () => { /* ignore errors on cleanup */ });
    },
  };
}
