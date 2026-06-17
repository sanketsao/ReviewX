#!/usr/bin/env node
import * as path from "path";
import { createServer } from "./server";
import { createInbox } from "./inbox";
import { startTunnel } from "./tunnel";
import { staticExport } from "./publish";
import { deployGitHubPages, resolveGitHubToken } from "./gh-pages";

interface Args {
  command?: "publish";
  dir?: string;
  proxy?: string;
  port?: number;
  share?: boolean;
  inbox?: boolean;
  dataDir?: string;
  storage?: "file" | "sqlite" | "postgres";
  sqlitePath?: string;
  databaseUrl?: string;
  // publish
  out?: string;
  endpoint?: string;
  project?: string;
  bundleWidget?: boolean;
  target?: string;
  repo?: string;
  githubToken?: string;
  help?: boolean;
}

function parse(argv: string[]): Args {
  const args: Args = {};
  let i = 0;
  if (argv[0] === "publish") {
    args.command = "publish";
    i = 1;
  }
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--proxy") args.proxy = argv[++i];
    else if (a === "--port" || a === "-p") args.port = Number(argv[++i]);
    else if (a === "--share" || a === "-s") args.share = true;
    else if (a === "--inbox") args.inbox = true;
    else if (a === "--data-dir") args.dataDir = argv[++i];
    else if (a === "--storage") args.storage = argv[++i] as Args["storage"];
    else if (a === "--sqlite-path") args.sqlitePath = argv[++i];
    else if (a === "--database-url") args.databaseUrl = argv[++i];
    else if (a === "--out" || a === "-o") args.out = argv[++i];
    else if (a === "--endpoint") args.endpoint = argv[++i];
    else if (a === "--project") args.project = argv[++i];
    else if (a === "--bundle-widget") args.bundleWidget = true;
    else if (a === "--target") args.target = argv[++i];
    else if (a === "--repo") args.repo = argv[++i];
    else if (a === "--github-token") args.githubToken = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else if (!a.startsWith("-")) args.dir = a;
  }
  return args;
}

const HELP = `protofeedback — share a prototype with a tour + feedback overlay

Usage:
  protofeedback [dir]                 Serve a static prototype directory
  protofeedback --proxy <url>        Reverse-proxy a running dev server
  protofeedback . --share            Serve and open a public tunnel URL
  protofeedback --inbox              Run the hosted feedback inbox (CDN snippet)
  protofeedback publish <dir> -o <out>  Build a hostable copy w/ widget injected

Publish options:
  -o, --out <dir>      Where to write the hostable artifact
      --endpoint <url> Inbox the embedded widget posts feedback to
      --project <id>   Project id reported to the inbox (default: dir/repo name)
      --bundle-widget  Embed reviewx.js in the artifact (no CDN dependency)
      --target <name>  dir (default) | github-pages
      --repo <o>/<r>   Repo for github-pages (uses GITHUB_TOKEN / gh / --github-token)
      --github-token <t>  Token with repo scope (else env GITHUB_TOKEN or gh)

Options:
  -p, --port <n>     Local port (default 4321; inbox default 4400)
  -s, --share        Open a cloudflared public URL (no reviewer install)
      --inbox        Multi-project feedback inbox for the CDN snippet
      --data-dir <d> Where inbox data lives (default ./.protofeedback-inbox)
      --storage <e>  Inbox storage engine: file (default) | sqlite | postgres
      --sqlite-path <f>  SQLite DB file (default <data-dir>/reviewx.sqlite)
      --database-url <u> Postgres connection string (storage=postgres)
  -h, --help         Show this help

Env (inbox): PORT, HOST, REVIEWX_DATA_DIR, REVIEWX_WRITE_RATE_LIMIT,
             REVIEWX_STORAGE=file|sqlite|postgres, REVIEWX_SQLITE_PATH, DATABASE_URL,
             REVIEWX_ADMIN_TOKEN (deployment admin key), REVIEWX_JWT_SECRET (HS256)
`;

async function main() {
  const args = parse(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  if (args.command === "publish") {
    if (!args.dir) throw new Error("publish needs a source directory: reviewx publish <dir> -o <out>");
    const target = args.target || "dir";

    // GitHub Pages serves project sites under /<repo>/, so the bundled widget
    // must be referenced under that base path.
    let owner = "";
    let repo = "";
    let basePath: string | undefined;
    if (target === "github-pages") {
      if (!args.repo || !args.repo.includes("/")) {
        throw new Error("github-pages target needs --repo <owner>/<name>");
      }
      [owner, repo] = args.repo.split("/");
      basePath = `/${repo}/`;
    }

    const outDir = args.out ? path.resolve(args.out) : path.resolve(".reviewx-publish");
    const project = args.project || (repo ? `${owner}-${repo}` : path.basename(path.resolve(args.dir)));
    const result = await staticExport({
      srcDir: path.resolve(args.dir),
      outDir,
      project,
      endpoint: args.endpoint,
      bundleWidget: args.bundleWidget ?? target === "github-pages", // self-contained for Pages
      basePath,
    });

    if (target === "github-pages") {
      const token = await resolveGitHubToken(args.githubToken);
      if (!token) {
        throw new Error("no GitHub token — set GITHUB_TOKEN, pass --github-token, or run `gh auth login`");
      }
      process.stdout.write(`\n  Publishing ${owner}/${repo} to GitHub Pages…\n`);
      const { url, branch } = await deployGitHubPages({ artifactDir: outDir, owner, repo, token });
      process.stdout.write(
        `\n  Published to GitHub Pages\n` +
          `  Link:     ${url}\n` +
          `  Branch:   ${branch} (force-updated each publish)\n` +
          `  Project:  ${project}\n` +
          `  Feedback: ${args.endpoint || "(none — pass --endpoint <inbox> for shared feedback)"}\n\n`
      );
      return;
    }

    if (target !== "dir") {
      process.stderr.write(`\n  Target "${target}" not implemented yet — wrote the artifact locally instead.\n`);
    }
    process.stdout.write(
      `\n  Published artifact ready\n` +
        `  Out:      ${result.outDir}\n` +
        `  Files:    ${result.files} (${result.htmlFiles} HTML pages injected)\n` +
        `  Widget:   ${result.widgetSrc}\n` +
        `  Project:  ${project}\n` +
        `  Feedback: ${args.endpoint ? args.endpoint : "this browser (localStorage) — pass --endpoint for shared feedback"}\n` +
        `\n  Serve it with any static host, e.g.:\n    npx serve ${result.outDir}\n\n`
    );
    return;
  }

  if (args.inbox) {
    const raw = (args.storage ?? process.env.REVIEWX_STORAGE ?? "").toLowerCase();
    const storage =
      raw === "postgres" || raw === "sqlite" || raw === "file"
        ? (raw as "file" | "sqlite" | "postgres")
        : undefined;
    const sqlitePath = args.sqlitePath ?? process.env.REVIEWX_SQLITE_PATH;
    const databaseUrl = args.databaseUrl ?? process.env.DATABASE_URL;
    const dataDir = args.dataDir ?? process.env.REVIEWX_DATA_DIR;
    const rate = process.env.REVIEWX_WRITE_RATE_LIMIT;
    const inbox = await createInbox({
      dataDir: dataDir ? path.resolve(dataDir) : undefined,
      port: args.port ?? (process.env.PORT ? Number(process.env.PORT) : undefined),
      host: process.env.HOST, // bind 0.0.0.0 in containers; defaults to 127.0.0.1
      storage,
      sqlitePath: sqlitePath ? path.resolve(sqlitePath) : undefined,
      databaseUrl,
      writeRateLimit: rate ? Number(rate) : undefined,
      adminToken: process.env.REVIEWX_ADMIN_TOKEN,
      jwtSecret: process.env.REVIEWX_JWT_SECRET,
    });
    process.stdout.write(
      `\n  ReviewX inbox ready  [storage: ${storage ?? "file"}]\n  Endpoint: ${inbox.url}\n` +
        `  Reviewer copy (anyone can leave feedback):\n` +
        `    <script src="…/reviewx@1" data-reviewx data-endpoint="${inbox.url}" data-project="my-proto"></script>\n` +
        `  Author copy (resolve/edit/export — keep the token private):\n` +
        `    <script src="…/reviewx@1" data-reviewx data-role="author" data-endpoint="${inbox.url}" data-project="my-proto" data-token="choose-a-secret"></script>\n` +
        `\n  The first request bearing data-token claims it for that project; writes are rate-limited per IP.\n` +
        `\n  Press Ctrl+C to stop.\n\n`
    );
    process.on("SIGINT", () => {
      inbox.close().then(() => process.exit(0));
    });
    return;
  }

  if (!args.dir && !args.proxy) {
    args.dir = process.cwd();
  }

  const running = await createServer({
    dir: args.dir ? path.resolve(args.dir) : undefined,
    proxyTarget: args.proxy,
    dataDir: args.dir ? path.resolve(args.dir) : process.cwd(),
    port: args.port,
  });

  const mode = args.proxy ? `proxying ${args.proxy}` : `serving ${args.dir}`;
  process.stdout.write(`\n  ProtoFeedback ready — ${mode}\n  Local:   ${running.url}\n`);

  if (args.share) {
    try {
      const tunnel = await startTunnel(running.port);
      process.stdout.write(`  Share:   ${tunnel.url}\n`);
      process.on("SIGINT", () => {
        tunnel.stop();
        running.close().then(() => process.exit(0));
      });
    } catch (err) {
      process.stdout.write(`  Share:   unavailable (${(err as Error).message})\n`);
    }
  }

  process.stdout.write("\n  Press Ctrl+C to stop.\n\n");
  process.on("SIGINT", () => {
    running.close().then(() => process.exit(0));
  });
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
