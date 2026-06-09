import { buildAnchor, resolveAnchor } from "./anchor";
import type { Backend } from "./backend";
import { h } from "./dom";
import { STYLES } from "./styles";
import type { Anchor, Feedback, Reply, Settings, TourStep } from "./types";

type Mode = "off" | "feedback" | "tour" | "review";
type Role = "reviewer" | "author";

export class OverlayApp {
  private host: HTMLElement;
  private root: ShadowRoot;
  private mode: Mode = "off";
  private feedbacks: Feedback[] = [];
  private tour: TourStep[] = [];
  private settings: Settings = { autoStartTour: true };
  private role: Role = "reviewer";
  private author: string = localStorage.getItem("pf_author") || "";
  private tourIndex = 0;
  private collapsed = false;
  private feedbackMin = false;
  /** True while the tour itself is changing the route, so onNav doesn't end it. */
  private tourNavigating = false;

  private launcher!: HTMLElement;
  private banner!: HTMLElement;
  private layer!: HTMLElement;
  private highlight: HTMLElement | null = null;
  private popover: HTMLElement | null = null;
  private spotlight: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private rafId = 0;

  constructor(private backend: Backend) {
    this.host = document.createElement("div");
    this.host.id = "protofeedback-host";
    document.documentElement.appendChild(this.host);
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.append(h("style", {}, STYLES));
    this.layer = h("div", { class: "pf-layer" });
    this.root.append(this.layer);
    this.role = this.resolveRole();
  }

  /** Authors get the full toolset; reviewers get the prominent tour + feedback CTAs.
   *  Priority: explicit ?pf= override (sticky) → server/snippet-detected role
   *  (loopback = author, tunnel = reviewer) → stored preference → reviewer. */
  private resolveRole(): Role {
    try {
      const q = new URLSearchParams(location.search).get("pf");
      if (q === "author" || q === "reviewer") {
        localStorage.setItem("pf_role", q);
        return q;
      }
      const stamped = (window as unknown as { __PF_ROLE?: string }).__PF_ROLE;
      if (stamped === "author" || stamped === "reviewer") return stamped;
      if (localStorage.getItem("pf_role") === "author") return "author";
    } catch {
      /* ignore */
    }
    return "reviewer";
  }

  async init() {
    this.renderControls();
    await this.refreshFeedback();
    try {
      this.tour = (await this.backend.listTour()).sort((a, b) => a.order - b.order);
    } catch {
      this.tour = [];
    }
    try {
      this.settings = await this.backend.getSettings();
    } catch {
      /* keep defaults */
    }
    this.renderControls();
    window.addEventListener("scroll", this.scheduleReposition, true);
    window.addEventListener("resize", this.scheduleReposition);
    window.addEventListener("hashchange", this.onNav);
    window.addEventListener("popstate", this.onNav);
    this.maybeAutoStartTour();
  }

  /** Start the tour once per browser session for reviewers, if the author left it on. */
  private maybeAutoStartTour() {
    if (this.role !== "reviewer") return;
    if (!this.settings.autoStartTour || !this.tour.length) return;
    try {
      if (sessionStorage.getItem("pf_toured")) return;
    } catch {
      /* ignore */
    }
    this.collapsed = false;
    this.setMode("tour");
  }

  private onNav = () => {
    // When the tour drives the route (cross-tab step), keep it running.
    if (this.tourNavigating) return;
    this.endTour();
    this.closePopover();
    this.renderControls();
    this.renderPins();
    // Bubble numbers are per-page, so refresh the window when the route changes.
    if (this.mode === "review" && this.panelEl) this.renderFeedbackPanel();
  };

  private get page(): string {
    return (location.pathname || "/") + (location.hash || "");
  }

  private isOurs(node: EventTarget | null): boolean {
    return node === this.host || (node instanceof Node && this.host.contains(node));
  }

  // ---- Controls (launcher toggle + banner) ----
  private renderControls() {
    const openHere = this.feedbacks.filter((f) => f.status === "open" && f.page === this.page).length;
    const openTotal = this.feedbacks.filter((f) => f.status === "open").length;

    const launcher = h(
      "button",
      { class: `pf-launcher ${this.collapsed ? "" : "hidden"}`, onclick: () => this.setCollapsed(false) },
      h("span", { class: "pf-dot" }),
      "Prototype Review",
      openHere ? h("span", { class: "pf-count" }, String(openHere)) : document.createTextNode("")
    );
    if (this.launcher) this.launcher.replaceWith(launcher);
    else this.root.append(launcher);
    this.launcher = launcher;

    // Order: Give feedback → Comments (author) → Take the tour → ⚙ (author) → ×
    const children: (Node | string)[] = [
      h(
        "button",
        {
          class: `pf-cta feedback ${this.mode === "feedback" ? "active" : ""}`,
          onclick: () => this.setMode(this.mode === "feedback" ? "off" : "feedback"),
        },
        "💬 Give feedback"
      ),
    ];

    if (this.role === "author") {
      children.push(
        h(
          "button",
          {
            class: `pf-btn ${this.mode === "review" ? "active" : ""}`,
            title: "Review comments on the page",
            onclick: () => this.toggleReview(),
          },
          "Comments",
          openTotal ? h("span", { class: "pf-count" }, String(openTotal)) : document.createTextNode("")
        )
      );
    }

    children.push(
      h(
        "button",
        {
          class: `pf-cta tour ${this.mode === "tour" ? "active" : ""}`,
          onclick: () => this.setMode(this.mode === "tour" ? "off" : "tour"),
        },
        this.tour.length ? `▶ Take the tour (${this.tour.length})` : "▶ Take the tour"
      )
    );

    if (this.role === "author") {
      children.push(
        h("button", { class: "pf-btn gear", title: "Create a guided tour", onclick: () => this.openTourBuilder() }, "⚙")
      );
    }

    children.push(
      h("button", { class: "pf-btn icon", title: "Hide overlay", onclick: () => this.setCollapsed(true) }, "×")
    );

    const banner = h("div", { class: `pf-banner ${this.collapsed ? "hidden" : ""}` }, ...children);
    if (this.banner) this.banner.replaceWith(banner);
    else this.root.append(banner);
    this.banner = banner;
  }

  private setCollapsed(collapsed: boolean) {
    this.collapsed = collapsed;
    if (collapsed) this.setMode("off");
    else this.renderControls();
  }

  private setMode(mode: Mode) {
    this.exitFeedback();
    this.endTour();
    // Leaving review tears down its sidebar + any open thread popover.
    if (this.mode === "review" && mode !== "review") {
      this.closePanel();
      this.closePopover();
    }
    this.mode = mode;
    this.renderControls();
    if (mode === "feedback") this.enterFeedback();
    if (mode === "tour") this.startTour();
    this.renderPins();
  }

  /** Author "Comments": reveal the numbered bubbles on the page AND the
   *  aggregate sidebar together. Toggling off clears both. */
  private async toggleReview() {
    if (this.mode === "review") {
      this.setMode("off");
      return;
    }
    this.setMode("review");
    this.feedbackMin = false;
    await this.refreshFeedback();
    this.renderPins();
    this.renderFeedbackPanel();
    const onPage = this.feedbacks.filter((f) => f.page === this.page && f.status !== "archived").length;
    this.flash(onPage ? "Click a numbered bubble to open its thread." : "No comments on this page yet.");
  }

  private showHint(text: string) {
    this.clearHint();
    this.hint = h("div", { class: "pf-hint" }, text);
    this.root.append(this.hint);
  }
  private clearHint() {
    this.hint?.remove();
    this.hint = null;
  }
  private flash(text: string) {
    this.showHint(text);
    setTimeout(() => this.clearHint(), 1500);
  }

  // ---- Feedback mode ----
  private enterFeedback() {
    this.showHint("Feedback mode: click any element to leave a comment. Esc to exit.");
    document.addEventListener("mousemove", this.onMove, true);
    document.addEventListener("click", this.onPick, true);
    document.addEventListener("keydown", this.onKey, true);
    this.renderPins();
  }
  private exitFeedback() {
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("click", this.onPick, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.clearHighlight();
    this.clearHint();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (this.popover) this.closePopover();
      else this.setMode("off");
    }
  };

  private onMove = (e: MouseEvent) => {
    if (this.mode !== "feedback") return;
    const t = e.target as Element | null;
    if (!t || this.isOurs(t)) {
      this.clearHighlight();
      return;
    }
    const r = t.getBoundingClientRect();
    if (!this.highlight) {
      this.highlight = h("div", { class: "pf-highlight" });
      this.root.append(this.highlight);
    }
    Object.assign(this.highlight.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  };

  private onPick = (e: MouseEvent) => {
    if (this.mode !== "feedback") return;
    const t = e.target as Element | null;
    if (!t || this.isOurs(t)) return;
    e.preventDefault();
    e.stopPropagation();
    this.clearHighlight();
    this.openCommentForm(t, e.clientX, e.clientY);
  };

  private clearHighlight() {
    this.highlight?.remove();
    this.highlight = null;
  }

  private openCommentForm(target: Element, x: number, y: number) {
    this.closePopover();
    const anchor = buildAnchor(target);
    const nameInput = h("input", {
      type: "text",
      placeholder: "Your name",
      value: this.author,
    }) as HTMLInputElement;
    const textArea = h("textarea", {
      placeholder: "What should change here?",
    }) as HTMLTextAreaElement;

    const submit = async () => {
      const text = textArea.value.trim();
      if (!text) return;
      this.author = nameInput.value.trim() || "Anonymous";
      localStorage.setItem("pf_author", this.author);
      await this.backend.createFeedback({ anchor, text, author: this.author, page: this.page });
      this.closePopover();
      await this.refreshFeedback();
      this.renderControls();
      this.renderPins();
    };

    const pop = h(
      "div",
      { class: "pf-popover" },
      h("h4", {}, "New comment"),
      nameInput,
      textArea,
      h(
        "div",
        { class: "pf-row" },
        h("button", { class: "pf-ghost", onclick: () => this.closePopover() }, "Cancel"),
        h("button", { class: "pf-primary", onclick: submit }, "Comment")
      )
    );
    this.placePopover(pop, x, y);
    this.popover = pop;
    this.root.append(pop);
    textArea.focus();
  }

  private placePopover(pop: HTMLElement, x: number, y: number) {
    const popW = 300;
    const px = Math.min(Math.max(8, x), window.innerWidth - popW - 8);
    const py = Math.min(Math.max(8, y), window.innerHeight - 220);
    Object.assign(pop.style, { left: `${px}px`, top: `${py}px` });
  }

  private closePopover() {
    this.popover?.remove();
    this.popover = null;
  }

  // ---- Pins ----
  private async refreshFeedback() {
    try {
      this.feedbacks = await this.backend.listFeedback();
    } catch {
      this.feedbacks = [];
    }
  }

  /** Non-archived comments anchored on the current page, in creation order.
   *  This ordering defines the bubble numbers; the feedback window reuses it
   *  so a row's index always matches the bubble on the page. */
  private onPageFeedback(): Feedback[] {
    return this.feedbacks.filter((f) => f.page === this.page && f.status !== "archived");
  }

  private renderPins() {
    this.layer.innerHTML = "";
    if (this.mode === "off") {
      this.stopReposition();
      return;
    }
    const onPage = this.onPageFeedback();
    onPage.forEach((fb, i) => {
      const el = resolveAnchor(fb.anchor);
      if (!el) return;
      const pin = h(
        "div",
        {
          class: `pf-pin ${fb.status === "resolved" ? "resolved" : ""}`,
          onclick: (ev: Event) => {
            ev.stopPropagation();
            this.openPinPopover(fb, pin);
          },
        },
        String(i + 1)
      );
      (pin as HTMLElement).dataset.id = fb.id;
      this.layer.append(pin);
    });
    this.positionPins();
    this.scheduleReposition();
  }

  private positionPins() {
    const pins = Array.from(this.layer.children) as HTMLElement[];
    for (const pin of pins) {
      const fb = this.feedbacks.find((f) => f.id === pin.dataset.id);
      if (!fb) continue;
      const el = resolveAnchor(fb.anchor);
      const r = el?.getBoundingClientRect();
      // Hide pins whose element is missing or not laid out (e.g. on an inactive tab).
      if (!el || !r || (r.width === 0 && r.height === 0)) {
        pin.style.display = "none";
        continue;
      }
      pin.style.display = "flex";
      pin.style.left = `${r.left + r.width}px`;
      pin.style.top = `${r.top}px`;
    }
  }

  private scheduleReposition = () => {
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      if (this.mode === "tour") this.positionSpotlight();
      else this.positionPins();
    });
  };
  private stopReposition() {
    cancelAnimationFrame(this.rafId);
  }

  /** Open the full conversation anchored to its pin: original comment, the
   *  reply thread, a composer, and resolve/archive — all in context. */
  private openPinPopover(fb: Feedback, pin: HTMLElement) {
    this.closePopover();
    const r = pin.getBoundingClientRect();
    const pop = this.buildThreadPopover(fb);
    this.placePopover(pop, r.left, r.top + 24);
    this.popover = pop;
    this.root.append(pop);
  }

  private buildThreadPopover(fb: Feedback): HTMLElement {
    const replies = fb.replies || [];
    const thread = h("div", { class: "pf-thread" },
      h(
        "div",
        { class: "pf-thread-msg" },
        h("div", { class: "pf-meta" }, `${fb.author} · ${new Date(fb.createdAt).toLocaleString()}`),
        h("div", { class: "pf-comment-text" }, fb.text)
      ),
      ...replies.map((rep: Reply) =>
        h(
          "div",
          { class: "pf-reply" },
          h("div", { class: "pf-meta" }, `${rep.author} · ${new Date(rep.createdAt).toLocaleString()}`),
          h("div", { class: "pf-comment-text" }, rep.text)
        )
      )
    );

    const nameInput = h("input", {
      type: "text",
      placeholder: "Your name",
      value: this.author,
    }) as HTMLInputElement;
    const textArea = h("textarea", { placeholder: "Reply…" }) as HTMLTextAreaElement;
    const sendReply = async () => {
      const text = textArea.value.trim();
      if (!text) return;
      this.author = nameInput.value.trim() || "Anonymous";
      localStorage.setItem("pf_author", this.author);
      try {
        const updated = await this.backend.addReply(fb.id, { author: this.author, text });
        await this.refreshFeedback();
        this.refreshThreadPopover(updated);
        if (this.panelEl) this.renderFeedbackPanel();
      } catch {
        this.flash("Could not send reply.");
      }
    };

    const toggleResolve = h(
      "button",
      { class: "pf-ghost", onclick: () => this.setStatusInThread(fb, fb.status === "resolved" ? "open" : "resolved") },
      fb.status === "resolved" ? "Reopen" : "Resolve"
    );
    const toggleArchive = h(
      "button",
      { class: "pf-ghost", onclick: () => this.setStatusInThread(fb, fb.status === "archived" ? "open" : "archived") },
      fb.status === "archived" ? "Unarchive" : "Archive"
    );

    return h(
      "div",
      { class: "pf-popover pf-thread-pop" },
      h(
        "div",
        { class: "pf-thread-head" },
        h("span", { class: `pf-badge ${fb.status}` }, fb.status),
        h("button", { class: "pf-ghost", onclick: () => this.closePopover() }, "Close")
      ),
      thread,
      h("div", { class: "pf-thread-compose" }, nameInput, textArea,
        h("button", { class: "pf-primary", onclick: sendReply }, "Reply")
      ),
      h("div", { class: "pf-row" }, toggleResolve, toggleArchive)
    );
  }

  /** Replace the open thread popover in place, keeping its position. */
  private refreshThreadPopover(fb: Feedback) {
    if (!this.popover) return;
    const { left, top } = this.popover.style;
    const next = this.buildThreadPopover(fb);
    next.style.left = left;
    next.style.top = top;
    this.popover.replaceWith(next);
    this.popover = next;
  }

  private async setStatusInThread(fb: Feedback, status: Feedback["status"]) {
    await this.backend.updateFeedback(fb.id, { status });
    await this.refreshFeedback();
    this.renderControls();
    this.renderPins();
    const updated = this.feedbacks.find((f) => f.id === fb.id);
    // Archived comments drop off the page; close the popover. Otherwise refresh.
    if (updated && updated.status !== "archived") this.refreshThreadPopover(updated);
    else this.closePopover();
    if (this.panelEl) this.renderFeedbackPanel();
  }

  // ---- Panels (feedback list + tour builder) ----
  private closePanel() {
    this.panelEl?.remove();
    this.panelEl = null;
  }

  private renderFeedbackPanel() {
    this.closePanel();
    // On-page comments first (in bubble order), then comments from other pages.
    const onPage = this.onPageFeedback();
    const others = this.feedbacks
      .filter((f) => !onPage.includes(f))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = [...onPage, ...others];

    const body = h("div", { class: "pf-win-body" });
    if (!items.length) body.append(h("div", { class: "pf-empty" }, "No feedback yet."));
    items.forEach((fb) => body.append(this.feedbackRow(fb, onPage.indexOf(fb))));

    const panel = h(
      "div",
      { class: `pf-win ${this.feedbackMin ? "min" : ""}` },
      h(
        "div",
        { class: "pf-win-head" },
        h("h3", {}, `Comments (${items.length})`),
        h(
          "div",
          { class: "pf-win-ctl" },
          h(
            "button",
            {
              class: "pf-x",
              title: this.feedbackMin ? "Expand" : "Minimize",
              onclick: () => {
                this.feedbackMin = !this.feedbackMin;
                this.renderFeedbackPanel();
              },
            },
            this.feedbackMin ? "▢" : "—"
          ),
          h("button", { class: "pf-x", title: "Close", onclick: () => this.setMode("off") }, "×")
        )
      ),
      body,
      h("div", { class: "pf-win-foot" }, ...this.exportControls())
    );
    this.panelEl = panel;
    this.root.append(panel);
  }

  /** One "Download" button that opens a small menu: Excel, CSV, or JSON. */
  private exportControls(): Node[] {
    const menu = h(
      "div",
      { class: "pf-dl-menu" },
      h("button", { class: "pf-dl-item", onclick: () => { this.downloadExcel(); menu.classList.remove("open"); } }, "Excel (.xlsx)"),
      h("button", { class: "pf-dl-item", onclick: () => { this.downloadCsv(); menu.classList.remove("open"); } }, "CSV (.csv)"),
      h("button", { class: "pf-dl-item", onclick: () => { this.downloadJson(); menu.classList.remove("open"); } }, "JSON (.json)")
    );
    const btn = h(
      "button",
      {
        class: "pf-mini primary",
        onclick: (ev: Event) => {
          ev.stopPropagation();
          menu.classList.toggle("open");
        },
      },
      "Download ▾"
    );
    // Copy Markdown is a separate action: grab the feedback as text to hand to an AI.
    const copyMd = h("button", { class: "pf-mini", title: "Copy feedback as Markdown for an AI", onclick: () => this.copyMarkdown() }, "Copy Markdown");
    return [h("div", { class: "pf-dl" }, btn, menu), copyMd];
  }

  /** Tabular rows shared by the CSV and Excel exports. */
  private feedbackRows(): { head: string[]; body: string[][] } {
    const head = ["Page", "Author", "Comment", "Status", "Created", "Element", "Replies"];
    const body = this.feedbacks.map((f) => [
      f.page,
      f.author,
      f.text,
      f.status,
      new Date(f.createdAt).toLocaleString(),
      f.anchor?.selector || "",
      (f.replies || []).map((r) => `${r.author}: ${r.text}`).join(" | "),
    ]);
    return { head, body };
  }

  private downloadExcel() {
    const url = this.backend.exportXlsxUrl();
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "feedback.xlsx";
      a.click();
      return;
    }
    // No server bundle (snippet backends): emit an HTML table .xls that Excel opens.
    const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const { head, body } = this.feedbackRows();
    const tr = (cells: string[], tag: string) => `<tr>${cells.map((c) => `<${tag}>${esc(c)}</${tag}>`).join("")}</tr>`;
    const html = `<html><head><meta charset="utf-8"></head><body><table>${tr(head, "th")}${body
      .map((r) => tr(r, "td"))
      .join("")}</table></body></html>`;
    this.downloadText("feedback.xls", html, "application/vnd.ms-excel");
  }

  private downloadCsv() {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const { head, body } = this.feedbackRows();
    const csv = [head, ...body].map((r) => r.map(esc).join(",")).join("\r\n");
    this.downloadText("feedback.csv", "﻿" + csv, "text/csv;charset=utf-8");
  }

  private downloadJson() {
    this.downloadText("feedback.json", JSON.stringify(this.feedbacks, null, 2), "application/json");
  }

  private feedbackMarkdown(): string {
    const lines = ["# Prototype feedback", ""];
    for (const f of this.feedbacks) {
      lines.push(`- **[${f.status}]** ${f.text.replace(/\s*\n\s*/g, " ")}`);
      lines.push(`  - ${f.author} · \`${f.page}\` · ${new Date(f.createdAt).toLocaleString()}`);
      lines.push(`  - element: \`${f.anchor.selector}\``);
      for (const r of f.replies || []) {
        lines.push(`  - ↳ **${r.author}**: ${r.text.replace(/\s*\n\s*/g, " ")} _(${new Date(r.createdAt).toLocaleString()})_`);
      }
    }
    return lines.join("\n") + "\n";
  }

  private async copyMarkdown() {
    const md = this.feedbackMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      this.flash("Copied feedback as Markdown.");
    } catch {
      this.downloadText("feedback.md", md, "text/markdown");
    }
  }

  private downloadText(name: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** A row in the feedback window. `onPageIdx` is the 0-based position among
   *  on-page comments (so the badge matches the page bubble), or -1 if the
   *  comment lives on another page. */
  private feedbackRow(fb: Feedback, onPageIdx: number): HTMLElement {
    const replyCount = fb.replies?.length || 0;
    const stop = (fn: () => void) => (ev: Event) => {
      ev.stopPropagation();
      fn();
    };
    const idxBadge =
      onPageIdx >= 0
        ? h("span", { class: `pf-idx ${fb.status === "resolved" ? "resolved" : ""}` }, String(onPageIdx + 1))
        : h("span", { class: "pf-idx off", title: "On another page" }, "·");

    return h(
      "div",
      { class: "pf-fb pf-fb-click", title: "Show on page & open thread", onclick: () => this.revealThread(fb.id) },
      h(
        "div",
        { class: "pf-fb-head" },
        idxBadge,
        h("span", { class: `pf-badge ${fb.status}` }, fb.status),
        replyCount
          ? h("span", { class: "pf-reply-count" }, `💬 ${replyCount}`)
          : document.createTextNode("")
      ),
      h("div", { class: "pf-comment-text" }, fb.text),
      h(
        "div",
        { class: "pf-fb-meta" },
        `${fb.author}${onPageIdx >= 0 ? "" : ` · ${fb.page}`} · ${new Date(fb.createdAt).toLocaleString()}`
      ),
      h(
        "div",
        { class: "pf-fb-actions" },
        h(
          "button",
          {
            class: "pf-mini",
            onclick: stop(() => this.setStatus(fb, fb.status === "resolved" ? "open" : "resolved")),
          },
          fb.status === "resolved" ? "Reopen" : "Resolve"
        ),
        h(
          "button",
          {
            class: "pf-mini",
            onclick: stop(() => this.setStatus(fb, fb.status === "archived" ? "open" : "archived")),
          },
          fb.status === "archived" ? "Unarchive" : "Archive"
        )
      )
    );
  }

  private async setStatus(fb: Feedback, status: Feedback["status"]) {
    await this.backend.updateFeedback(fb.id, { status });
    await this.refreshFeedback();
    this.renderControls();
    this.renderPins();
    this.renderFeedbackPanel();
  }

  /** From the sidebar: jump to the comment's element on the page, then open its
   *  thread popover in context. Falls back to a centered popover if the element
   *  isn't on this page (e.g. a comment left on another route). */
  private revealThread(id: string) {
    const fb = this.feedbacks.find((f) => f.id === id);
    if (!fb) return;
    if (this.mode !== "review") {
      this.setMode("review");
      this.renderPins();
    }
    const el = resolveAnchor(fb.anchor);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Wait for scroll + pin reposition, then anchor the popover to the pin.
    setTimeout(() => {
      this.positionPins();
      const pin = Array.from(this.layer.children).find(
        (n) => (n as HTMLElement).dataset.id === id
      ) as HTMLElement | undefined;
      if (pin && pin.style.display !== "none") {
        this.openPinPopover(fb, pin);
      } else {
        // Element not on this page — open the thread centered.
        this.closePopover();
        const pop = this.buildThreadPopover(fb);
        this.placePopover(pop, window.innerWidth / 2 - 150, 80);
        this.popover = pop;
        this.root.append(pop);
      }
    }, el ? 320 : 0);
  }

  // ---- Tour builder ----
  private async openTourBuilder() {
    this.setMode("off");
    try {
      this.tour = (await this.backend.listTour()).sort((a, b) => a.order - b.order);
    } catch {
      this.tour = [];
    }
    this.renderTourBuilder();
  }

  private renderTourBuilder() {
    this.closePanel();
    const body = h("div", { class: "pf-panel-body" });

    const autoStart = h("input", { type: "checkbox" }) as HTMLInputElement;
    autoStart.checked = this.settings.autoStartTour;
    autoStart.addEventListener("change", async () => {
      this.settings.autoStartTour = autoStart.checked;
      try {
        this.settings = await this.backend.saveSettings({ autoStartTour: autoStart.checked });
      } catch {
        /* ignore */
      }
    });
    body.append(
      h("label", { class: "pf-check" }, autoStart, "Start tour automatically for reviewers")
    );

    if (!this.tour.length) {
      body.append(
        h("div", { class: "pf-empty" }, 'No steps yet. Click "+ Add step", then click an element.')
      );
    }
    this.tour.forEach((step, i) => body.append(this.tourStepRow(step, i)));

    const panel = h(
      "div",
      { class: "pf-panel" },
      h(
        "div",
        { class: "pf-panel-head" },
        h("h3", {}, "Tour builder"),
        h("button", { class: "pf-mini", onclick: () => this.closePanel() }, "Close")
      ),
      body,
      h(
        "div",
        { class: "pf-panel-foot" },
        h("button", { class: "pf-mini", onclick: () => this.addTourStep() }, "+ Add step"),
        h("button", { class: "pf-primary", onclick: () => this.saveTour() }, "Save tour")
      )
    );
    this.panelEl = panel;
    this.root.append(panel);
  }

  private tourStepRow(step: TourStep, i: number): HTMLElement {
    const titleInput = h("input", { type: "text", value: step.title || "" }) as HTMLInputElement;
    titleInput.placeholder = "Step title";
    titleInput.addEventListener("input", () => (step.title = titleInput.value));
    const bodyInput = h("textarea", {}) as HTMLTextAreaElement;
    bodyInput.value = step.body || "";
    bodyInput.placeholder = "Description";
    bodyInput.addEventListener("input", () => (step.body = bodyInput.value));

    return h(
      "div",
      { class: "pf-fb" },
      h("div", { class: "pf-fb-meta" }, `Step ${i + 1} · ${step.anchor.selector || "(no element)"} · ${step.page}`),
      h("div", { class: "pf-field" }, h("label", {}, "Title"), titleInput),
      h("div", { class: "pf-field" }, h("label", {}, "Description"), bodyInput),
      h(
        "div",
        { class: "pf-fb-actions" },
        h("button", { class: "pf-mini", onclick: () => this.reorderStep(i, -1) }, "↑"),
        h("button", { class: "pf-mini", onclick: () => this.reorderStep(i, 1) }, "↓"),
        h("button", { class: "pf-mini", onclick: () => this.pickForStep(step) }, "Re-pick"),
        h("button", { class: "pf-mini", onclick: () => this.deleteStep(i) }, "Delete")
      )
    );
  }

  private async addTourStep() {
    const anchor = await this.pickAnchor();
    if (anchor) {
      this.tour.push({
        id: `pf-${Date.now()}`,
        anchor,
        title: "",
        body: "",
        order: this.tour.length,
        page: this.page,
      });
    }
    this.renderTourBuilder();
  }

  private async pickForStep(step: TourStep) {
    const anchor = await this.pickAnchor();
    if (anchor) {
      step.anchor = anchor;
      step.page = this.page;
    }
    this.renderTourBuilder();
  }

  private reorderStep(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= this.tour.length) return;
    [this.tour[i], this.tour[j]] = [this.tour[j], this.tour[i]];
    this.renderTourBuilder();
  }

  private deleteStep(i: number) {
    this.tour.splice(i, 1);
    this.renderTourBuilder();
  }

  private async saveTour() {
    this.tour.forEach((s, i) => (s.order = i));
    try {
      this.tour = await this.backend.saveTour(this.tour);
      this.showHint("Tour saved.");
      setTimeout(() => this.clearHint(), 1500);
    } catch {
      this.showHint("Could not save tour.");
    }
    this.renderControls();
    this.closePanel();
  }

  /** Let the user click an element on the page; resolve with its anchor. */
  private pickAnchor(): Promise<Anchor | null> {
    return new Promise((resolve) => {
      const panel = this.panelEl;
      if (panel) panel.style.display = "none";
      this.showHint("Click an element to attach this step. Esc to cancel.");

      const cleanup = () => {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey, true);
        this.clearHighlight();
        this.clearHint();
        if (panel) panel.style.display = "";
      };
      const onMove = (e: MouseEvent) => {
        const t = e.target as Element | null;
        if (!t || this.isOurs(t)) {
          this.clearHighlight();
          return;
        }
        const r = t.getBoundingClientRect();
        if (!this.highlight) {
          this.highlight = h("div", { class: "pf-highlight" });
          this.root.append(this.highlight);
        }
        Object.assign(this.highlight.style, {
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        });
      };
      const onClick = (e: MouseEvent) => {
        const t = e.target as Element | null;
        if (!t || this.isOurs(t)) return;
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve(buildAnchor(t));
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey, true);
    });
  }

  // ---- Tour mode ----
  private startTour() {
    if (!this.tour.length) {
      this.showHint("No tour steps yet. The author can add them with the ⚙ button.");
      this.mode = "off";
      this.renderControls();
      return;
    }
    this.tourIndex = 0;
    this.showStep();
  }

  private showStep() {
    this.closePopover();
    const step = this.tour[this.tourIndex];
    if (!step) return this.endTour();
    // If the step lives on another in-app route/tab (same document, different
    // hash), navigate there first so its element is actually visible.
    if (
      step.page &&
      step.page !== this.page &&
      step.page.includes("#") &&
      this.samePath(step.page)
    ) {
      this.tourNavigating = true;
      location.hash = step.page.slice(step.page.indexOf("#"));
      // Let the prototype's router swap views before we anchor to the element.
      setTimeout(() => {
        this.tourNavigating = false;
        this.renderPins(); // drop the previous tab's stale pins
        this.renderResolvedStep(step);
      }, 400);
      return;
    }
    this.renderResolvedStep(step);
  }

  /** Path portion of a stored page string (everything before the hash). */
  private samePath(page: string): boolean {
    const path = page.split("#")[0] || "/";
    return path === (location.pathname || "/");
  }

  private renderResolvedStep(step: TourStep) {
    const el = resolveAnchor(step.anchor);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => this.renderStep(step, el), el ? 300 : 0);
  }

  private renderStep(step: TourStep, el: Element | null) {
    this.closePopover();
    this.positionSpotlight(el);
    const last = this.tourIndex === this.tour.length - 1;
    const first = this.tourIndex === 0;
    const pop = h(
      "div",
      { class: "pf-popover" },
      h("div", { class: "pf-progress" }, `Step ${this.tourIndex + 1} of ${this.tour.length}`),
      h("h4", {}, step.title || "Untitled step"),
      h("div", { class: "pf-comment-text" }, step.body || ""),
      h(
        "div",
        { class: "pf-row" },
        h(
          "button",
          { class: "pf-ghost", onclick: () => this.endTour() },
          "Exit"
        ),
        h(
          "div",
          {},
          first
            ? document.createTextNode("")
            : h("button", { class: "pf-ghost", onclick: () => this.step(-1) }, "Back"),
          h(
            "button",
            { class: "pf-primary", onclick: () => (last ? this.endTour() : this.step(1)) },
            last ? "Done" : "Next"
          )
        )
      )
    );
    let x = window.innerWidth / 2 - 140;
    let y = window.innerHeight - 240;
    if (el) {
      const r = el.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 12;
    }
    this.placePopover(pop, x, y);
    this.popover = pop;
    this.root.append(pop);
    this.scheduleReposition();
  }

  private positionSpotlight(el?: Element | null) {
    const step = this.tour[this.tourIndex];
    const target = el !== undefined ? el : step ? resolveAnchor(step.anchor) : null;
    if (!target) {
      this.spotlight?.remove();
      this.spotlight = null;
      return;
    }
    if (!this.spotlight) {
      this.spotlight = h("div", { class: "pf-spot" });
      this.root.append(this.spotlight);
    }
    const r = target.getBoundingClientRect();
    Object.assign(this.spotlight.style, {
      left: `${r.left - 4}px`,
      top: `${r.top - 4}px`,
      width: `${r.width + 8}px`,
      height: `${r.height + 8}px`,
    });
  }

  private step(delta: number) {
    this.tourIndex = Math.max(0, Math.min(this.tour.length - 1, this.tourIndex + delta));
    this.showStep();
  }

  private endTour() {
    this.spotlight?.remove();
    this.spotlight = null;
    this.closePopover();
    if (this.mode === "tour") {
      try {
        sessionStorage.setItem("pf_toured", "1");
      } catch {
        /* ignore */
      }
      this.mode = "off";
      this.renderControls();
    }
  }
}

/** Boot once the DOM is ready, guarding against double-injection. */
export function boot(backend: Backend) {
  const start = () => {
    if ((window as unknown as { __pfLoaded?: boolean }).__pfLoaded) return;
    (window as unknown as { __pfLoaded?: boolean }).__pfLoaded = true;
    new OverlayApp(backend).init();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}
