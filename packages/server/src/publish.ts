import { promises as fs, existsSync } from "fs";
import * as path from "path";

const DEFAULT_CDN = "https://cdn.jsdelivr.net/npm/reviewx@1";

export interface PublishOptions {
  /** Static directory (or framework build output) to publish. */
  srcDir: string;
  /** Where the injected, ready-to-host artifact is written. */
  outDir: string;
  /** Project id the embedded widget reports to the inbox. */
  project: string;
  /** Inbox endpoint the widget posts feedback to. Omit → per-browser localStorage. */
  endpoint?: string;
  /**
   * Copy reviewx.js into the artifact and reference it at /reviewx.js, so the
   * published prototype is self-contained (no dependency on the public CDN).
   */
  bundleWidget?: boolean;
  /** Override the widget <script src>. Defaults to jsDelivr (or /reviewx.js if bundled). */
  cdn?: string;
  /**
   * URL path the artifact is served under (e.g. "/my-repo/" for GitHub project
   * Pages). Prefixes the bundled widget src so it resolves under the subpath.
   * Defaults to "/".
   */
  basePath?: string;
}

/** Normalize a base path to the form "/x/" (always leading + trailing slash). */
function normBase(basePath?: string): string {
  if (!basePath || basePath === "/") return "/";
  return `/${basePath.replace(/^\/+|\/+$/g, "")}/`;
}

export interface PublishResult {
  outDir: string;
  files: number;
  htmlFiles: number;
  widgetSrc: string;
}

/** Locate the built reviewx.js snippet bundle.
 *  Inside the packaged VS Code extension, the bundle is copied to dist/reviewx.js
 *  next to out/extension.js. In the monorepo / CLI, resolve via the workspace package. */
function reviewxBundlePath(): string {
  const adjacent = path.join(__dirname, "..", "dist", "reviewx.js");
  if (existsSync(adjacent)) return adjacent;
  const pkg = require.resolve("@protofeedback/overlay/package.json");
  return path.join(path.dirname(pkg), "dist", "reviewx.js");
}

/** Build the reviewer-copy snippet tag (no author token — published copy is public). */
export function snippetTag(
  opts: Pick<PublishOptions, "project" | "endpoint" | "bundleWidget" | "cdn" | "basePath">
): string {
  const src = opts.bundleWidget ? `${normBase(opts.basePath)}reviewx.js` : opts.cdn || DEFAULT_CDN;
  const attrs = [
    `src="${src}"`,
    "data-reviewx",
    opts.endpoint ? `data-endpoint="${opts.endpoint}"` : "",
    `data-project="${opts.project}"`,
  ].filter(Boolean);
  return `<script ${attrs.join(" ")}></script>`;
}

/** Inject the snippet once, before </body> (falling back to </html> / append). */
export function injectSnippet(html: string, opts: Parameters<typeof snippetTag>[0]): string {
  if (/data-reviewx\b/.test(html)) return html; // already has it
  const t = snippetTag(opts);
  if (html.includes("</body>")) return html.replace("</body>", `${t}\n</body>`);
  if (html.includes("</html>")) return html.replace("</html>", `${t}\n</html>`);
  return `${html}\n${t}\n`;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/**
 * Produce a hostable copy of a static prototype with the ReviewX widget injected
 * into every HTML page. The output dir can be served by any static host.
 */
export async function staticExport(opts: PublishOptions): Promise<PublishResult> {
  const src = path.resolve(opts.srcDir);
  const out = path.resolve(opts.outDir);
  const stat = await fs.stat(src).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`source is not a directory: ${src}`);
  if (out === src) throw new Error("out dir must differ from source");

  // Never publish local feedback data, VCS, deps, or OS junk — the widget talks
  // to the inbox, and .protofeedback/*.json would otherwise be exposed publicly.
  const EXCLUDE = new Set([".protofeedback", ".git", "node_modules", ".DS_Store"]);
  await fs.rm(out, { recursive: true, force: true });
  await fs.cp(src, out, {
    recursive: true,
    filter: (s) => !EXCLUDE.has(path.basename(s)),
  });

  const files = await walk(out);
  let htmlFiles = 0;
  for (const f of files) {
    if (/\.html?$/i.test(f)) {
      const html = await fs.readFile(f, "utf8");
      await fs.writeFile(f, injectSnippet(html, opts), "utf8");
      htmlFiles++;
    }
  }

  let total = files.length;
  if (opts.bundleWidget) {
    await fs.copyFile(reviewxBundlePath(), path.join(out, "reviewx.js"));
    total++;
  }
  // Disable Jekyll on GitHub Pages so files/dirs starting with "_" are served.
  await fs.writeFile(path.join(out, ".nojekyll"), "");

  return {
    outDir: out,
    files: total,
    htmlFiles,
    widgetSrc: opts.bundleWidget ? `${normBase(opts.basePath)}reviewx.js` : opts.cdn || DEFAULT_CDN,
  };
}
