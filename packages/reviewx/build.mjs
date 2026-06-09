import { build } from "esbuild";
import { fileURLToPath } from "url";
import * as path from "path";

// The published CDN artifact is the snippet bundle. Its source of truth is the
// overlay package's snippet entry (one overlay core, two front doors) — we bundle
// it here so `reviewx` ships a single self-contained, minified IIFE.
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, "../overlay/src/snippet.ts");

await build({
  entryPoints: [entry],
  outfile: path.resolve(here, "dist/reviewx.js"),
  bundle: true,
  format: "iife",
  target: "es2018",
  sourcemap: false,
  minify: true,
  legalComments: "none",
  banner: {
    js: "/* reviewx — zero-install feedback + guided-tour overlay. MIT. https://github.com/sanketsao/ReviewX */",
  },
});

console.log("[reviewx] built dist/reviewx.js");
