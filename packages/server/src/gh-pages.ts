import { promises as fs } from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);
const API = "https://api.github.com";

export interface GitHubPagesOptions {
  /** The built artifact directory (output of staticExport). */
  artifactDir: string;
  owner: string;
  repo: string;
  /** A token with `repo` scope (VS Code GitHub session, gh, or a PAT). */
  token: string;
  /** Branch to publish to (force-updated each time). Default: reviewx-pages. */
  branch?: string;
}

export interface GitHubPagesResult {
  url: string;
  branch: string;
}

async function gh(
  token: string,
  method: string,
  pathname: string,
  body?: unknown
): Promise<Response> {
  return fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Publish a built artifact to GitHub Pages from a dedicated orphan branch, then
 * enable Pages to serve it. Force-updates the branch each run so it only ever
 * holds the latest artifact (never touches the prototype's own history).
 */
export async function deployGitHubPages(opts: GitHubPagesOptions): Promise<GitHubPagesResult> {
  const branch = opts.branch || "reviewx-pages";
  const { owner, repo, token, artifactDir } = opts;
  const remote = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  const git = (args: string[]) => run("git", args, { cwd: artifactDir });

  // 1. Commit the artifact as a fresh orphan branch and force-push it.
  await fs.rm(path.join(artifactDir, ".git"), { recursive: true, force: true });
  await git(["init", "-q", "-b", branch]);
  await git(["add", "-A"]);
  await git([
    "-c", "user.email=bot@reviewx.dev",
    "-c", "user.name=ReviewX",
    "commit", "-q", "-m", "ReviewX publish",
  ]);
  await git(["push", "-q", "--force", remote, `HEAD:refs/heads/${branch}`]);
  await fs.rm(path.join(artifactDir, ".git"), { recursive: true, force: true });

  // 2. Point Pages at that branch (create, or update if it already exists).
  let res = await gh(token, "POST", `/repos/${owner}/${repo}/pages`, {
    source: { branch, path: "/" },
  });
  if (res.status === 409) {
    res = await gh(token, "PUT", `/repos/${owner}/${repo}/pages`, {
      source: { branch, path: "/" },
    });
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`enabling GitHub Pages failed (${res.status}): ${await res.text()}`);
  }

  // 3. Poll until the first build completes; return the served URL.
  let url = `https://${owner}.github.io/${repo}/`;
  for (let i = 0; i < 40; i++) {
    const p = await gh(token, "GET", `/repos/${owner}/${repo}/pages`);
    if (p.ok) {
      const data = (await p.json()) as { html_url?: string; status?: string };
      if (data.html_url) url = data.html_url;
      if (data.status === "built") break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { url, branch };
}

/** Resolve a GitHub token from an explicit value, env, or the `gh` CLI. */
export async function resolveGitHubToken(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const { stdout } = await run("gh", ["auth", "token"]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
