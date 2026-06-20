# Publishing the ReviewSX extension

The extension reaches different editors through **two registries**:

| Registry | Covers | Tool |
|---|---|---|
| **OpenVSX** | Cursor, Windsurf, VSCodium, Gitpod, Theia | `ovsx` |
| **VS Code Marketplace** | Microsoft VS Code only | `vsce` |

Cursor and Windsurf **cannot** use the Microsoft Marketplace — they pull from
OpenVSX. So to reach the vibe-coding audience (who mostly use Cursor/Windsurf),
**OpenVSX is the priority.**

## Permanent identity (locked)

The extension's marketplace ID is **permanent once published**:

```
publisher: reviewsx
name:       prototype-review
→ ID:       reviewsx.prototype-review
```

The `name` ("prototype-review") is keyword-rich for marketplace search. The
internal command IDs (`protofeedback.*`) are NOT shown in the marketplace and
stay as-is — only `publisher`, `name`, and `displayName` are user-facing.

> Before first publish, register the **`reviewsx`** publisher handle on both
> OpenVSX and the VS Code Marketplace.

---

## One-time setup

### OpenVSX
1. Sign in at https://open-vsx.org with GitHub.
2. Create an access token: https://open-vsx.org/user-settings/tokens
3. Create your namespace (publisher), then publish:
   ```bash
   cd packages/vscode-extension
   npx ovsx create-namespace <publisher> -p <TOKEN>
   npx ovsx publish prototype-review-0.1.0.vsix -p <TOKEN>
   ```

### VS Code Marketplace
1. Create a publisher at https://marketplace.visualstudio.com/manage
2. Create a Personal Access Token in Azure DevOps (scope: Marketplace → Manage).
3. Publish:
   ```bash
   cd packages/vscode-extension
   npx vsce publish --packagePath prototype-review-0.1.0.vsix -p <TOKEN>
   ```

> Tokens are secrets — never commit them. Pass them on the command line or via
> the `OVSX_PAT` / `VSCE_PAT` environment variables.

---

## Each release

```bash
# From the monorepo root — rebuild everything first:
npm run build -w @protofeedback/overlay
npm run build -w @protofeedback/server
cd packages/vscode-extension
npm run package          # bundles + copies overlay bundles + builds the VSIX

# Then publish to both registries:
npx ovsx publish prototype-review-0.1.0.vsix -p $OVSX_PAT
npx vsce publish --packagePath prototype-review-0.1.0.vsix -p $VSCE_PAT
```

Bump `version` in `package.json` before each publish — registries reject
duplicate versions.

---

## Installing in Cursor / Windsurf (for testing before publish)

You don't need to publish to test. Both editors install a local VSIX directly:

1. Open Cursor/Windsurf.
2. `Cmd+Shift+P` → **Extensions: Install from VSIX…**
3. Pick `packages/vscode-extension/prototype-review-0.1.0.vsix`.
4. Reload when prompted.

The VSIX is the identical format VS Code uses, and the extension targets
`engines.vscode ^1.85.0`, which both editors satisfy — so it installs and runs
the same way it does in VS Code.

---

## Marketplace listing assets (improves search + conversion)

Both registries show these — prepare them for a polished listing:

- **README.md** in `packages/vscode-extension/` — this becomes the listing page.
  Include screenshots/GIFs of the share + feedback flow.
- **Icon** — 128×128 PNG, referenced via `"icon": "icon.png"` in package.json.
- **Keywords** — already set (prototype, feedback, review, tour, annotations…).
- **Categories** — already set (Other, Visualization).
