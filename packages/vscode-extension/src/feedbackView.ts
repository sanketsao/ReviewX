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

export class FeedbackProvider implements vscode.TreeDataProvider<Node> {
  private emitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private feedbacks: Feedback[] = [];

  constructor(private workspaceRoot: string | undefined) {}

  private get file(): string | undefined {
    return this.workspaceRoot
      ? path.join(this.workspaceRoot, ".protofeedback", "feedback.json")
      : undefined;
  }

  async refresh(): Promise<void> {
    this.feedbacks = await this.read();
    this.emitter.fire(undefined);
  }

  private async read(): Promise<Feedback[]> {
    if (!this.file) return [];
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "group") {
      const item = new vscode.TreeItem(
        `${node.label} (${node.items.length})`,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.contextValue = "feedbackGroup";
      return item;
    }
    const fb = node.feedback;
    const item = new vscode.TreeItem(fb.text.split("\n")[0], vscode.TreeItemCollapsibleState.None);
    item.description = `${fb.author} · ${fb.page}`;
    item.tooltip = new vscode.MarkdownString(
      `**${fb.author}** on \`${fb.page}\`\n\n${fb.text}\n\n*${new Date(fb.createdAt).toLocaleString()}*\n\nElement: \`${fb.anchor.selector}\``
    );
    item.contextValue = "feedbackItem";
    item.iconPath = new vscode.ThemeIcon(fb.status === "resolved" ? "check" : "comment");
    item.id = fb.id;
    return item;
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      const open = this.feedbacks.filter((f) => f.status !== "resolved");
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
