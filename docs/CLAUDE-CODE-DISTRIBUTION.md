# Distributing ReviewSX through Claude Code

Claude Code users can add ReviewSX as a **plugin**. Once installed, the bundled
skill lets them say "add ReviewSX to this prototype" and Claude injects the
overlay snippet correctly for their framework.

## How a user installs it

```
# 1. Add the ReviewSX marketplace (one time)
/plugin marketplace add sanketsao/ReviewsX

# 2. Install the plugin
/plugin install reviewsx@reviewsx
```

After that, the `reviewsx` skill is available in every session. The user can
trigger it naturally ("make this reviewable", "add a feedback overlay") or
directly.

## Layout in this repo

```
.claude-plugin/
  marketplace.json          # lists the plugins this repo offers
plugins/
  reviewsx/
    .claude-plugin/
      plugin.json           # plugin manifest
    skills/
      reviewsx/
        SKILL.md            # the auto-inject skill (source of truth)
```

> The canonical skill also lives at `skills/reviewsx/SKILL.md` for use inside
> this repo. Keep the two in sync, or make one a copy step in CI. (Follow-up:
> add a build step that copies `skills/reviewsx/` → `plugins/reviewsx/skills/`.)

## Roadmap for the Claude Code surface

1. **Skill (done)** — inject the snippet per framework.
2. **Plugin packaging (this branch)** — make the skill installable via marketplace.
3. **`/reviewsx-publish` command** — a slash command that runs the CLI to
   static-export + publish to GitHub Pages without leaving Claude Code.
4. **`/reviewsx-share` command** — open a Tailscale/cloudflared tunnel to a
   running prototype and return the public URL.
5. **Inbox-aware skill** — when a project has `.reviewsx/config.json`, the skill
   reads the configured endpoint and wires `data-endpoint` automatically.

## Verifying the plugin locally

```
/plugin marketplace add /Users/sanketsao/Documents/Projects/Feedback/protofeedback
/plugin install reviewsx@reviewsx
```
Then in a test prototype: ask Claude to "add ReviewSX" and confirm the snippet
is injected before `</body>`.
