import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  format: "iife",
  target: "es2018",
  sourcemap: false,
  minify: !watch,
  legalComments: "none",
};

// Two front doors share one overlay core:
//  - overlay.js   : injected by the local proxy/static server (httpBackend)
//  - reviewx.js: the zero-install CDN snippet (local/rest backend)
const targets = [
  { entryPoints: ["src/index.ts"], outfile: "dist/overlay.js" },
  { entryPoints: ["src/snippet.ts"], outfile: "dist/reviewx.js" },
];

if (watch) {
  for (const t of targets) {
    const ctx = await context({ ...common, ...t });
    await ctx.watch();
  }
  console.log("[overlay] watching overlay.js + reviewx.js…");
} else {
  for (const t of targets) {
    await build({ ...common, ...t });
    console.log(`[overlay] built ${t.outfile}`);
  }
}
