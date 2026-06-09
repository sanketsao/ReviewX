import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import { createServer, startTunnel } from "@protofeedback/server";
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
