# ReviewSX — JetBrains plugin

Brings ReviewSX to the JetBrains IDEs (WebStorm, IntelliJ IDEA, PyCharm, etc.).
WebStorm is the primary target since that's where web prototypes are built;
IntelliJ IDEA Community is the cheapest sandbox to develop against.

## Strategy: reuse the Node server

The plugin does **not** reimplement the overlay, proxy, or inbox in Kotlin. It
spawns the same Node server as the VS Code extension (`packages/server`) and
manages the process from `ReviewSXService`. This keeps a single source of truth
for all the actual logic.

```
JetBrains IDE
  └─ ReviewSXService  ──spawns──▶  node cli.js  (packages/server)
        │                              ├─ serves prototype + injects overlay
        │                              ├─ /__pf/* feedback API
        │                              └─ tunnel (Tailscale / cloudflared)
        └─ Tool window (feedback list, Start/Share/Publish buttons)
```

## Current state — scaffold

| File | Purpose | Status |
|---|---|---|
| `build.gradle.kts` | IntelliJ Platform Gradle plugin | ✅ buildable shape |
| `src/.../plugin.xml` | Plugin descriptor: tool window + 3 actions | ✅ |
| `ReviewSXService.kt` | Spawns/stops the Node server | 🚧 skeleton (TODOs) |
| `ReviewSXToolWindowFactory.kt` | Sidebar UI | 🚧 placeholder panel |
| `actions/Actions.kt` | Start / Share / Publish | 🚧 Start stubbed, Share/Publish TODO |

## Build & run (once the JDK + Gradle are set up)

```bash
cd packages/jetbrains-plugin
./gradlew runIde        # launches a sandbox IDE with the plugin loaded
./gradlew buildPlugin   # produces build/distributions/*.zip
```

> Requires JDK 17. The first `runIde` downloads the target IDE (~1 GB).

## Roadmap

1. **Scaffold (this branch)** — Gradle project, plugin.xml, service + action shells.
2. **Bundle the server** — ship `packages/server/dist` inside the plugin, resolve
   a node binary, parse the local URL from stdout.
3. **Feedback tool window** — real tree grouped by open/resolved, polling the
   inbox / watching `.protofeedback/feedback.json`.
4. **Share** — Tailscale Funnel → cloudflared fallback, copy-URL action.
5. **Publish** — staticExport + GitHub Pages, with the public-repo notice.
6. **Inbox setup** — hosted (`inbox.reviewsx.app`) vs self-host, written to
   `.reviewsx/config.json` (same format as the VS Code extension).
7. **Publish to JetBrains Marketplace.**

## Distribution

JetBrains Marketplace: https://plugins.jetbrains.com — create a vendor account,
then upload the `buildPlugin` zip (or wire `publishPlugin` with a token).
