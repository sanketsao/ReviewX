import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { promises as fs } from "fs";
import { createServer, startTunnel, staticExport, deployGitHubPages } from "@protofeedback/server";
import type { RunningServer, Tunnel, Feedback } from "@protofeedback/server";
import { FeedbackProvider } from "./feedbackView";
import { TourEditor } from "./tourEditor";

let running: RunningServer | undefined;
let tunnel: Tunnel | undefined;

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function activate(context: vscode.ExtensionContext): void {
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
    await vscode.env.openExternal(vscode.Uri.parse(running.url));
    void vscode.window.showInformationMessage(`ProtoFeedback running at ${running.url}`);
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
    { location: vscode.ProgressLocation.Notification, title: "Opening public URL…" },
    async () => {
      try {
        tunnel = await startTunnel(running!.port);
        void showShareUrl(tunnel.url);
      } catch (err) {
        void vscode.window.showErrorMessage((err as Error).message);
      }
    }
  );
}

async function showShareUrl(url: string): Promise<void> {
  const pick = await vscode.window.showInformationMessage(
    `Public URL: ${url}`,
    "Copy URL"
  );
  if (pick === "Copy URL") await vscode.env.clipboard.writeText(url);
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
  void vscode.window.showInformationMessage("ProtoFeedback stopped.");
}

async function resolveCmd(
  root: string | undefined,
  node: unknown,
  provider: FeedbackProvider
): Promise<void> {
  if (!root) return;
  const id = (node as { feedback?: Feedback })?.feedback?.id;
  if (!id) return;
  const file = path.join(root, ".protofeedback", "feedback.json");
  try {
    const all = JSON.parse(await fs.readFile(file, "utf8")) as Feedback[];
    const fb = all.find((f) => f.id === id);
    if (!fb) return;
    fb.status = fb.status === "resolved" ? "open" : "resolved";
    await fs.writeFile(file, JSON.stringify(all, null, 2), "utf8");
    await provider.refresh();
  } catch (err) {
    void vscode.window.showErrorMessage(`Could not update: ${(err as Error).message}`);
  }
}

export async function deactivate(): Promise<void> {
  tunnel?.stop();
  await running?.close();
}
