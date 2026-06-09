import { spawn, ChildProcess } from "child_process";

export interface Tunnel {
  url: string;
  stop: () => void;
}

const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

/**
 * Open a public URL to a local port using a cloudflared quick tunnel
 * (free, no account). Abstracted so the backend can be swapped later.
 */
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
      const m = buf.toString().match(URL_RE);
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
