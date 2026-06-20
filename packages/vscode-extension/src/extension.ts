import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { promises as fs } from "fs";
import { createServer, startTunnel, startTailscaleTunnel, staticExport, deployGitHubPages } from "@protofeedback/server";
import type { RunningServer, Tunnel, Feedback } from "@protofeedback/server";
import { FeedbackProvider } from "./feedbackView";
import { TourEditor } from "./tourEditor";

let running: RunningServer | undefined;
let tunnel: Tunnel | undefined;

function setServerRunning(value: boolean): void {
  void vscode.commands.executeCommand("setContext", "protofeedback.serverRunning", value);
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function activate(context: vscode.ExtensionContext): void {
  setServerRunning(false);
  const root = workspaceRoot();
  const provider = new FeedbackProvider(root);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("protofeedback.feedback", provider)
  );
  void provider.refresh();

  if (root) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, ".protofeedback/feedback.json")
    );
    const onChange = () => provider.refresh();
    watcher.onDidChange(onChange);
    watcher.onDidCreate(onChange);
    watcher.onDidDelete(onChange);
    context.subscriptions.push(watcher);
  }

  const tourEditor = root ? new TourEditor(root) : undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand("protofeedback.start", () => startCmd(root)),
    vscode.commands.registerCommand("protofeedback.share", () => shareCmd()),
    vscode.commands.registerCommand("protofeedback.publish", () => publishCmd(root)),
    vscode.commands.registerCommand("protofeedback.stop", () => stopCmd()),
    vscode.commands.registerCommand("protofeedback.refresh", () => provider.refresh()),
    vscode.commands.registerCommand("protofeedback.editTour", () => {
      if (!tourEditor) return void vscode.window.showWarningMessage("Open a folder first.");
      void tourEditor.open();
    }),
    vscode.commands.registerCommand("protofeedback.resolveItem", (node: unknown) =>
      resolveCmd(root, node, provider)
    ),
    vscode.commands.registerCommand("protofeedback.setupInbox", () =>
      setupInboxCmd(root, provider)
    )
  );
}

async function startCmd(root: string | undefined): Promise<void> {
  if (running) {
    void vscode.window.showInformationMessage(`Already running at ${running.url}`);
    return;
  }
  const mode = await vscode.window.showQuickPick(
    [
      { label: "Static directory", detail: "Serve a folder of HTML/CSS/JS", id: "static" },
      { label: "Proxy a dev server", detail: "Front an existing dev server (Vite, Next…)", id: "proxy" },
    ],
    { placeHolder: "How is your prototype run?" }
  );
  if (!mode) return;

  try {
    if (mode.id === "proxy") {
      const target = await vscode.window.showInputBox({
        prompt: "Dev server URL",
        value: "http://localhost:5173",
      });
      if (!target) return;
      running = await createServer({ proxyTarget: target, dataDir: root ?? process.cwd() });
    } else {
      const dir = root ?? process.cwd();
      running = await createServer({ dir, dataDir: dir });
    }
    setServerRunning(true);
    await vscode.env.openExternal(vscode.Uri.parse(running.url));
    void vscode.window.showInformationMessage(`ReviewX running at ${running.url}`);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed to start: ${(err as Error).message}`);
  }
}

async function shareCmd(): Promise<void> {
  if (!running) {
    void vscode.window.showWarningMessage("Start the prototype first.");
    return;
  }
  if (tunnel) {
    void showShareUrl(tunnel.url);
    return;
  }
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Opening public URL via Tailscale Funnel…" },
    async () => {
      try {
        tunnel = await startTailscaleTunnel(running!.port);
        void showShareUrl(tunnel.url, "tailscale");
      } catch (tailscaleErr) {
        // Tailscale not available — fall back to cloudflared quick tunnel.
        try {
          tunnel = await startTunnel(running!.port);
          void showShareUrl(tunnel.url, "cloudflare");
        } catch (cfErr) {
          // Both failed — show the Tailscale error (primary) with a hint.
          void vscode.window.showErrorMessage(
            `Could not open a public URL.\n\n` +
            `Tailscale: ${(tailscaleErr as Error).message}\n\n` +
            `Cloudflare fallback: ${(cfErr as Error).message}\n\n` +
            `Install Tailscale (tailscale.com/download) or cloudflared (brew install cloudflared).`
          );
        }
      }
    }
  );
}

async function showShareUrl(url: string, via: "tailscale" | "cloudflare" = "tailscale"): Promise<void> {
  const label = via === "tailscale" ? "Tailscale Funnel (stable)" : "Cloudflare Tunnel (ephemeral)";
  const pick = await vscode.window.showInformationMessage(
    `Public URL (${label}): ${url}`,
    "Copy URL",
    "Copy as Markdown"
  );
  if (pick === "Copy URL") {
    await vscode.env.clipboard.writeText(url);
  } else if (pick === "Copy as Markdown") {
    await vscode.env.clipboard.writeText(`[Review prototype](${url})`);
  }
}

interface ReviewxConfig {
  project?: string;
  source?: { type?: string; dir?: string };
  publish?: { mode?: string; endpoint?: string };
}

async function readConfig(root: string): Promise<ReviewxConfig> {
  try {
    return JSON.parse(await fs.readFile(path.join(root, ".reviewx", "config.json"), "utf8"));
  } catch {
    return {};
  }
}

async function writeConfig(root: string, patch: Partial<ReviewxConfig>): Promise<void> {
  const configDir = path.join(root, ".reviewx");
  const configFile = path.join(configDir, "config.json");
  let existing: ReviewxConfig = {};
  try { existing = JSON.parse(await fs.readFile(configFile, "utf8")); } catch { /* new */ }
  const merged: ReviewxConfig = {
    ...existing,
    ...patch,
    publish: { ...existing.publish, ...patch.publish },
  };
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(merged, null, 2), "utf8");
}

// The ReviewX-operated shared inbox. Each project is isolated by a unique
// project key + TOFU token, so a single deployment serves all builders at
// essentially zero marginal cost.
const REVIEWX_INBOX = "https://inbox.reviewsx.app";

async function setupInboxCmd(root: string | undefined, provider: FeedbackProvider): Promise<void> {
  if (!root) return void vscode.window.showWarningMessage("Open your prototype folder first.");

  const cfg = await readConfig(root);
  const current = cfg.publish?.endpoint;
  const usingHosted = current === REVIEWX_INBOX;

  const options: vscode.QuickPickItem[] = [
    {
      label: "$(cloud) Use ReviewX hosted inbox",
      description: "Recommended · free for indie builders",
      detail: usingHosted
        ? "✓ Active — all reviewer feedback goes here"
        : "Feedback from all reviewers collected centrally. Each project is isolated by a unique key.",
    },
    {
      label: "$(server) Self-host (enterprise)",
      description: "Run your own inbox — full data control, any region",
      detail: "Deploy the open-source inbox server on your own infrastructure. One Docker image, one command.",
    },
    {
      label: "$(x) Clear inbox endpoint",
      description: "Per-browser only — reviewers keep feedback in localStorage",
    },
  ];

  const pick = await vscode.window.showQuickPick(options, {
    placeHolder: "Where should reviewer feedback be collected?",
  });
  if (!pick) return;

  if (pick.label.includes("Clear")) {
    if (cfg.publish) delete cfg.publish.endpoint;
    await writeConfig(root, cfg);
    await provider.refresh();
    void vscode.window.showInformationMessage(
      "Inbox cleared. Reviewer feedback will stay in each browser until you set an inbox endpoint."
    );
    return;
  }

  if (pick.label.includes("Self-host")) {
    const deployOption = await vscode.window.showQuickPick(
      [
        {
          label: "$(package) Docker Compose",
          description: "Recommended for AWS / Azure / GCP — bring your own Postgres",
          detail: "One docker compose up. Works on any Linux host or managed container service.",
          id: "compose",
        },
        {
          label: "$(terminal) Fly.io",
          description: "Easiest for a fresh VPS — SQLite on a persistent volume",
          detail: "Free tier. One fly deploy command from the repo root.",
          id: "fly",
        },
      ],
      { placeHolder: "Which deployment method fits your infrastructure?" }
    );
    if (!deployOption) return;

    let steps: string;
    let docsUrl: string;
    if (deployOption.id === "compose") {
      steps = [
        "1. Have Docker + Docker Compose installed on your server.",
        "2. Copy  deploy/docker-compose/  from the ReviewX repo to your server.",
        "3. cp .env.example .env  — set POSTGRES_PASSWORD and REVIEWX_ADMIN_TOKEN.",
        "4. docker compose up -d",
        "5. Inbox is live at  http://<your-server>:4400",
        "",
        "Using an existing Postgres (RDS, Azure DB, Cloud SQL)?",
        "  docker compose -f docker-compose.yml -f docker-compose.external-pg.yml up -d",
        "  Set DATABASE_URL in .env instead of POSTGRES_PASSWORD.",
      ].join("\n");
      docsUrl = "https://docs.docker.com/compose/";
    } else {
      steps = [
        "1. Install flyctl:  https://fly.io/docs/hands-on/install-flyctl/",
        "2. fly auth login",
        "3. From the ReviewX repo root:",
        "   fly launch --config deploy/fly/fly.toml --dockerfile deploy/fly/Dockerfile",
        "   fly volumes create reviewx_data --size 1 --region iad",
        "   fly secrets set REVIEWX_ADMIN_TOKEN=$(openssl rand -hex 16)",
        "   fly deploy --config deploy/fly/fly.toml --dockerfile deploy/fly/Dockerfile",
        "4. Your inbox URL is  https://<app-name>.fly.dev",
      ].join("\n");
      docsUrl = "https://fly.io/docs/hands-on/install-flyctl/";
    }

    const action = await vscode.window.showInformationMessage(
      "Self-hosted ReviewX inbox\n\n" + steps +
      "\n\nData stays entirely on your infrastructure. " +
      "Same Docker image, same API — reviewers and the VS Code extension don't know the difference.",
      { modal: true },
      "Open docs",
      "Enter custom URL"
    );
    if (action === "Open docs") {
      void vscode.env.openExternal(vscode.Uri.parse(docsUrl));
      return;
    }
    if (action !== "Enter custom URL") return;

    const url = await vscode.window.showInputBox({
      prompt: "Self-hosted inbox URL",
      placeHolder: "https://your-app.fly.dev",
      value: current && current !== REVIEWX_INBOX ? current : "",
      validateInput: (v) => (v && v.startsWith("http")) ? null : "Must start with http:// or https://",
    });
    if (!url) return;

    await writeConfig(root, { publish: { endpoint: url } });
    await provider.refresh();
    void vscode.window.showInformationMessage(
      `Self-hosted inbox set: ${url}`,
      "Publish now"
    ).then((a) => { if (a === "Publish now") void vscode.commands.executeCommand("protofeedback.publish"); });
    return;
  }

  // "Use ReviewX hosted inbox" — just point at the shared endpoint.
  await writeConfig(root, { publish: { endpoint: REVIEWX_INBOX } });
  await provider.refresh();
  void vscode.window.showInformationMessage(
    `Connected to ReviewX inbox.\n\nYour next Publish will embed this endpoint. ` +
    `Reviewer feedback will be collected centrally, isolated to your project key.`,
    "Publish now"
  ).then((a) => { if (a === "Publish now") void vscode.commands.executeCommand("protofeedback.publish"); });
}

/** Parse `owner/repo` from a GitHub remote URL (https or ssh). */
function parseGitHubRemote(url: string): { owner: string; repo: string } | undefined {
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : undefined;
}

async function gitHubRepo(root: string): Promise<{ owner: string; repo: string } | undefined> {
  try {
    const cfg = await fs.readFile(path.join(root, ".git", "config"), "utf8");
    // Prefer origin; fall back to the first github remote.
    const blocks = cfg.split(/\[remote /).slice(1);
    const urls = blocks
      .map((b) => ({ name: b.slice(1, b.indexOf('"', 1)), url: b.match(/url\s*=\s*(.+)/)?.[1]?.trim() }))
      .filter((r) => r.url);
    const pick = urls.find((r) => r.name === "origin") ?? urls[0];
    return pick?.url ? parseGitHubRemote(pick.url) : undefined;
  } catch {
    return undefined;
  }
}

/** Find a sensible static source: configured dir, else root w/ index.html, else a build dir. */
async function detectSource(root: string, cfg: ReviewxConfig): Promise<string | undefined> {
  const has = async (d: string) => !!(await fs.stat(path.join(d, "index.html")).catch(() => null));
  if (cfg.source?.dir) return path.join(root, cfg.source.dir);
  if (await has(root)) return root;
  for (const d of ["dist", "build", "out", "public"]) {
    if (await has(path.join(root, d))) return path.join(root, d);
  }
  return undefined;
}

async function publishCmd(root: string | undefined): Promise<void> {
  if (!root) return void vscode.window.showWarningMessage("Open your prototype's folder first.");

  const repo = await gitHubRepo(root);
  if (!repo) {
    return void vscode.window.showWarningMessage(
      "No GitHub remote found. Push this project to a GitHub repo first, then Publish."
    );
  }

  // Upfront expectation: Pages requires a public repo (free) or GitHub Pro/Team (private).
  const proceed = await vscode.window.showInformationMessage(
    `Publish to ${repo.owner}/${repo.repo} via GitHub Pages.\n\n` +
    `GitHub Pages is free for public repositories. Private repos require GitHub Pro or Team. ` +
    `If your repo is private, make it public first: github.com/${repo.owner}/${repo.repo} → Settings → Change visibility.`,
    { modal: true },
    "Publish"
  );
  if (proceed !== "Publish") return;

  const cfg = await readConfig(root);
  let source = await detectSource(root, cfg);
  if (!source) {
    const picked = await vscode.window.showInputBox({
      prompt: "Folder to publish (must contain index.html). For built apps, run your build first.",
      value: "dist",
    });
    if (!picked) return;
    source = path.join(root, picked);
  }

  // Reuse VS Code's built-in GitHub login — no new account, no token to manage.
  const session = await vscode.authentication.getSession("github", ["repo"], { createIfNone: true });
  if (!session) return void vscode.window.showErrorMessage("GitHub sign-in is required to publish.");

  const endpoint =
    cfg.publish?.endpoint ||
    (await vscode.window.showInputBox({
      prompt: "Feedback inbox URL (leave blank to collect feedback only in each reviewer's browser)",
      placeHolder: "https://your-inbox.fly.dev",
    })) ||
    undefined;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Publishing to ${repo.owner}/${repo.repo}…` },
    async (progress) => {
      try {
        const outDir = path.join(os.tmpdir(), `reviewx-publish-${repo.repo}-${Date.now()}`);
        progress.report({ message: "Building…" });
        await staticExport({
          srcDir: source!,
          outDir,
          project: cfg.project || `${repo.owner}-${repo.repo}`,
          endpoint,
          bundleWidget: true,
          basePath: `/${repo.repo}/`,
        });
        progress.report({ message: "Deploying to GitHub Pages…" });
        const { url } = await deployGitHubPages({
          artifactDir: outDir,
          owner: repo.owner,
          repo: repo.repo,
          token: session.accessToken,
        });
        await fs.rm(outDir, { recursive: true, force: true });
        const pick = await vscode.window.showInformationMessage(
          `Published: ${url}${endpoint ? "" : "  (feedback is per-browser — set an inbox for shared feedback)"}`,
          "Copy link",
          "Open"
        );
        if (pick === "Copy link") await vscode.env.clipboard.writeText(url);
        if (pick === "Open") await vscode.env.openExternal(vscode.Uri.parse(url));
      } catch (err) {
        void vscode.window.showErrorMessage(`Publish failed: ${(err as Error).message}`);
      }
    }
  );
}

async function stopCmd(): Promise<void> {
  tunnel?.stop();
  tunnel = undefined;
  await running?.close();
  running = undefined;
  setServerRunning(false);
  void vscode.window.showInformationMessage("ReviewX stopped.");
}

/** Read or generate the project's TOFU token from .protofeedback/secret.json. */
async function readOrCreateToken(root: string): Promise<string> {
  const file = path.join(root, ".protofeedback", "secret.json");
  try {
    const obj = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    if (typeof obj.token === "string" && obj.token) return obj.token;
  } catch { /* not found */ }
  // Generate a new token and persist it so future ops use the same one.
  const token = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await fs.mkdir(path.join(root, ".protofeedback"), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ token }, null, 2), "utf8");
  return token;
}

async function resolveCmd(
  root: string | undefined,
  node: unknown,
  provider: FeedbackProvider
): Promise<void> {
  if (!root) return;
  const id = (node as { feedback?: Feedback })?.feedback?.id;
  if (!id) return;

  const current = provider.getFeedbackById(id);
  if (!current) return;
  const newStatus: Feedback["status"] = current.status === "resolved" ? "open" : "resolved";

  // If an inbox is configured, PATCH it first (it's the source of truth).
  const endpoint = provider.endpoint;
  const project = provider.project;
  if (endpoint && project) {
    try {
      const token = await readOrCreateToken(root);
      const url = `${endpoint.replace(/\/$/, "")}/feedback/${id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-PF-Token": token },
        body: JSON.stringify({ project, status: newStatus }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        void vscode.window.showErrorMessage(`Inbox update failed: ${err.error ?? res.statusText}`);
        return;
      }
    } catch (err) {
      void vscode.window.showErrorMessage(`Could not reach inbox: ${(err as Error).message}`);
      return;
    }
  }

  // Update local file too (best-effort — may not exist for inbox-only items).
  const file = path.join(root, ".protofeedback", "feedback.json");
  try {
    const all = JSON.parse(await fs.readFile(file, "utf8")) as Feedback[];
    const fb = all.find((f) => f.id === id);
    if (fb) {
      fb.status = newStatus;
      await fs.writeFile(file, JSON.stringify(all, null, 2), "utf8");
    }
  } catch { /* local file may not exist — that's fine */ }

  await provider.refresh();
}

export async function deactivate(): Promise<void> {
  tunnel?.stop();
  await running?.close();
}
