import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import type { TourStep } from "@protofeedback/server";

export class TourEditor {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private root: string) {}

  private get file(): string {
    return path.join(this.root, ".protofeedback", "tour.json");
  }

  async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(
      "protofeedbackTour",
      "ProtoFeedback: Tour",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    this.panel.onDidDispose(() => (this.panel = undefined));
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "save") {
        await this.save(msg.steps as TourStep[]);
        vscode.window.showInformationMessage("Tour saved. Reload the prototype to see it.");
      }
    });
    const steps = await this.load();
    this.panel.webview.html = this.render(steps);
  }

  private async load(): Promise<TourStep[]> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async save(steps: TourStep[]): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const normalized = steps.map((s, i) => ({
      id: s.id || `${Date.now()}-${i}`,
      anchor: s.anchor || { selector: "", tag: "", text: "" },
      title: s.title || "",
      body: s.body || "",
      order: i,
      page: s.page || "/",
    }));
    await fs.writeFile(this.file, JSON.stringify(normalized, null, 2), "utf8");
  }

  private render(steps: TourStep[]): string {
    const data = JSON.stringify(steps);
    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); }
  h2 { font-size: 16px; }
  .step { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 12px; margin-bottom: 12px; }
  label { display: block; font-size: 12px; opacity: .8; margin: 8px 0 2px; }
  input, textarea { width: 100%; box-sizing: border-box; padding: 6px; background: var(--vscode-input-background);
    color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; }
  textarea { min-height: 50px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border: 0; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 6px; }
  .ghost { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); }
  .row { display: flex; justify-content: space-between; align-items: center; }
  .hint { opacity: .7; font-size: 12px; margin-bottom: 12px; }
</style></head><body>
<h2>Tour steps</h2>
<p class="hint">Each step highlights an element (by CSS selector, e.g. <code>#headline</code>) and shows a title + description.</p>
<div id="steps"></div>
<button id="add" class="ghost">+ Add step</button>
<div class="row" style="margin-top:16px"><span></span><button id="save">Save tour</button></div>
<script>
const vscode = acquireVsCodeApi();
let steps = ${data};
function draw() {
  const root = document.getElementById('steps');
  root.innerHTML = '';
  steps.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'step';
    el.innerHTML = \`
      <div class="row"><strong>Step \${i+1}</strong>
        <span>
          <button class="ghost" data-up="\${i}">↑</button>
          <button class="ghost" data-down="\${i}">↓</button>
          <button class="ghost" data-del="\${i}">Delete</button>
        </span></div>
      <label>Element selector</label><input data-f="selector" data-i="\${i}" value="\${(s.anchor&&s.anchor.selector)||''}" />
      <label>Title</label><input data-f="title" data-i="\${i}" value="\${s.title||''}" />
      <label>Description</label><textarea data-f="body" data-i="\${i}">\${s.body||''}</textarea>
      <label>Page path</label><input data-f="page" data-i="\${i}" value="\${s.page||'/'}" />\`;
    root.appendChild(el);
  });
}
document.addEventListener('input', e => {
  const t = e.target; const i = +t.dataset.i; const f = t.dataset.f;
  if (i>=0 && f) {
    if (f === 'selector') { steps[i].anchor = steps[i].anchor||{}; steps[i].anchor.selector = t.value; steps[i].anchor.tag=''; steps[i].anchor.text=''; }
    else steps[i][f] = t.value;
  }
});
document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.del !== undefined) { steps.splice(+t.dataset.del,1); draw(); }
  else if (t.dataset.up !== undefined) { const i=+t.dataset.up; if(i>0){ [steps[i-1],steps[i]]=[steps[i],steps[i-1]]; draw(); } }
  else if (t.dataset.down !== undefined) { const i=+t.dataset.down; if(i<steps.length-1){ [steps[i+1],steps[i]]=[steps[i],steps[i+1]]; draw(); } }
});
document.getElementById('add').onclick = () => { steps.push({anchor:{selector:'',tag:'',text:''},title:'',body:'',page:'/'}); draw(); };
document.getElementById('save').onclick = () => vscode.postMessage({type:'save', steps});
draw();
</script></body></html>`;
  }
}
