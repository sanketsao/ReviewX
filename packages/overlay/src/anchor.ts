import type { Anchor } from "./types";

const ESC = (s: string): string =>
  (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/([^\w-])/g, "\\$1"));

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * Build a robust structural selector. Vibe-coded apps often have hashed/Tailwind
 * classes that change between reloads, so we rely on ids and :nth-of-type paths
 * rather than class names.
 */
export function buildAnchor(el: Element): Anchor {
  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "html") {
    if (node.id && isUnique(`#${ESC(node.id)}`)) {
      parts.unshift(`#${ESC(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.prototype.filter.call(
        parent.children,
        (c: Element) => c.tagName === node!.tagName
      ) as Element[];
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    if (node === document.body) break;
    node = parent;
  }

  const selector = parts.join(" > ");
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return { selector, tag: el.tagName.toLowerCase(), text };
}

/** Re-resolve an anchor to a live element, with text fallback. */
export function resolveAnchor(anchor: Anchor): Element | null {
  try {
    const direct = document.querySelector(anchor.selector);
    if (direct) return direct;
  } catch {
    /* malformed selector — fall through */
  }
  if (anchor.text) {
    const candidates = Array.prototype.slice.call(
      document.querySelectorAll(anchor.tag || "*")
    ) as Element[];
    const match = candidates.find(
      (c) => (c.textContent || "").replace(/\s+/g, " ").trim().includes(anchor.text)
    );
    if (match) return match;
  }
  return null;
}
