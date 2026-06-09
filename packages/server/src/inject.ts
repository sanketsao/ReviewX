export type Role = "author" | "reviewer";

const SCRIPT = `<script src="/__pf/overlay.js" data-protofeedback></script>`;

function tag(role: Role): string {
  // Stamp the server-detected role so the overlay can default its UI without
  // any action from the user. The overlay still honors a ?pf= override.
  return `<script data-protofeedback-role>window.__PF_ROLE=${JSON.stringify(role)};</script>${SCRIPT}`;
}

/** Insert the overlay script into an HTML document, once. */
export function injectOverlay(html: string, role: Role = "reviewer"): string {
  if (html.includes("data-protofeedback")) return html;
  const t = tag(role);
  if (html.includes("</body>")) return html.replace("</body>", `${t}\n</body>`);
  if (html.includes("</html>")) return html.replace("</html>", `${t}\n</html>`);
  return html + t;
}

export function isHtml(contentType: string | undefined): boolean {
  return !!contentType && contentType.toLowerCase().includes("text/html");
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/**
 * Decide the persona from the request's Host header. The author is whoever
 * runs the server and opens it on loopback; anyone reaching it through the
 * public tunnel host is a reviewer. cloudflared forwards the public hostname
 * as Host, so the tunnel is correctly classified as a reviewer.
 */
export function roleForHost(hostHeader: string | undefined): Role {
  if (!hostHeader) return "author";
  const raw = hostHeader.trim().toLowerCase();
  // Bracketed IPv6 (e.g. "[::1]:4322") vs host:port vs bare host.
  const hostname = raw.startsWith("[")
    ? raw.slice(1, raw.indexOf("]"))
    : raw.split(":")[0];
  return LOOPBACK.has(hostname) ? "author" : "reviewer";
}
