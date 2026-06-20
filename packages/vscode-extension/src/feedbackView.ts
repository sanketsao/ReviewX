import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import type { Feedback } from "@protofeedback/server";

type Node = GroupNode | ItemNode;
interface GroupNode {
  kind: "group";
  label: string;
  status: "open" | "resolved";
  items: Feedback[];
}
interface ItemNode {
  kind: "item";
  feedback: Feedback;
}

interface ReviewSXConfig {
  project?: string;
  publish?: { endpoint?: string };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export class FeedbackProvider implements vscode.TreeDataProvider<Node> {
  private emitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private feedbacks: Feedback[] = [];
  private config: ReviewSXConfig = {};

  constructor(private workspaceRoot: string | undefined) {}

  private get file(): string | undefined {
    return this.workspaceRoot
      ? path.join(this.workspaceRoot, ".protofeedback", "feedback.json")
      : undefined;
  }

  get endpoint(): string | undefined { return this.config.publish?.endpoint; }
  get project(): string | undefined { return this.config.project; }

  async refresh(): Promise<void> {
    this.config = await this.readConfig();
    this.feedbacks = await this.read();
    this.emitter.fire(undefined);
  }

  private async readConfig(): Promise<ReviewSXConfig> {
    if (!this.workspaceRoot) return {};
    try {
      return JSON.parse(
        await fs.readFile(path.join(this.workspaceRoot, ".reviewsx", "config.json"), "utf8")
      );
    } catch {
      return {};
    }
  }

  private async readLocal(): Promise<Feedback[]> {
    if (!this.file) return [];
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async fetchRemote(endpoint: string, project: string): Promise<Feedback[]> {
    try {
      const url = `${endpoint.replace(/\/$/, "")}/feedback?project=${encodeURIComponent(project)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as unknown;
      return Array.isArray(data) ? (data as Feedback[]) : [];
    } catch {
      return [];
    }
  }

  private async read(): Promise<Feedback[]> {
    const endpoint = this.config.publish?.endpoint;
    const project = this.config.project;
    const [local, remote] = await Promise.all([
      this.readLocal(),
      endpoint && project ? this.fetchRemote(endpoint, project) : Promise.resolve([] as Feedback[]),
    ]);
    const byId = new Map<string, Feedback>(local.map((f) => [f.id, f]));
    for (const f of remote) byId.set(f.id, f);
    return [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "group") {
      const isOpen = node.status === "open";
      const label = isOpen
        ? `${node.items.length} Open`
        : `${node.items.length} Resolved`;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon(
        isOpen ? "comment-discussion" : "check-all",
        new vscode.ThemeColor(isOpen ? "charts.yellow" : "charts.green")
      );
      item.contextValue = "feedbackGroup";
      return item;
    }

    const fb = node.feedback;
    const replies = fb.replies?.length ?? 0;
    const firstLine = fb.text.split("\n")[0].slice(0, 80);
    const item = new vscode.TreeItem(firstLine, vscode.TreeItemCollapsibleState.None);

    const replyBadge = replies > 0 ? `  $(comment) ${replies}` : "";
    item.description = `${fb.author}  ${relativeTime(fb.createdAt)}  ${fb.page}${replyBadge}`;

    item.tooltip = new vscode.MarkdownString(
      [
        `**${fb.author}** · ${fb.page} · ${new Date(fb.createdAt).toLocaleString()}`,
        "",
        fb.text,
        "",
        `*Element:* \`${fb.anchor.selector}\``,
        replies > 0 ? `\n*${replies} ${replies === 1 ? "reply" : "replies"}*` : "",
      ].join("\n")
    );
    item.tooltip.isTrusted = true;

    item.contextValue = "feedbackItem";
    item.iconPath = new vscode.ThemeIcon(
      fb.status === "resolved" ? "pass-filled" : "circle-filled",
      new vscode.ThemeColor(fb.status === "resolved" ? "charts.green" : "charts.yellow")
    );
    item.id = fb.id;
    return item;
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      const open = this.feedbacks.filter((f) => f.status === "open");
      const resolved = this.feedbacks.filter((f) => f.status === "resolved");
      const groups: GroupNode[] = [
        { kind: "group", label: "Open", status: "open", items: open },
        { kind: "group", label: "Resolved", status: "resolved", items: resolved },
      ];
      return groups.filter((g) => g.items.length > 0);
    }
    if (node.kind === "group") {
      return node.items.map((feedback) => ({ kind: "item", feedback }));
    }
    return [];
  }

  getFeedbackById(id: string): Feedback | undefined {
    return this.feedbacks.find((f) => f.id === id);
  }
}
