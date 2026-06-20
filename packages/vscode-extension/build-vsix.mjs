/**
 * Minimal VSIX builder — produces protofeedback-vscode-0.1.0.vsix without vsce.
 * A VSIX is a ZIP (OPC format) containing:
 *   [Content_Types].xml
 *   extension.vsixmanifest
 *   extension/**  (the actual extension files)
 */
import { createWriteStream, readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { createGzip } from "zlib";

// We need a zip library. Use the built-in zlib + a manual zip writer,
// or use the already-installed adm-zip / archiver. Let's check what's available.
import { createRequire } from "module";
const require = createRequire(import.meta.url);

let ZipArchive;
try {
  ({ ZipArchive } = require("archiver"));
} catch {
  console.error("archiver not found — run: npm install archiver");
  process.exit(1);
}

const ROOT = new URL(".", import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

// Files to include (relative to extension root)
const INCLUDE = ["out/extension.js", "dist/reviewsx.js", "package.json"];

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"
    xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher}"/>
    <DisplayName>${pkg.displayName}</DisplayName>
    <Description xml:space="preserve">${pkg.description}</Description>
    <Tags>prototype,feedback,tour,review</Tags>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${pkg.engines.vscode}"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui,workspace"/>
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value=""/>
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    ${INCLUDE.filter(f => f !== "package.json").map(f =>
      `<Asset Type="Microsoft.VisualStudio.Services.VSIXPackage" Path="extension/${f}" Addressable="true"/>`
    ).join("\n    ")}
  </Assets>
</PackageManifest>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".map" ContentType="application/json"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
  <Default Extension=".xml" ContentType="text/xml"/>
</Types>`;

const outFile = join(ROOT, `${pkg.name}-${pkg.version}.vsix`);
const output = createWriteStream(outFile);
const archive = new ZipArchive({ zlib: { level: 9 } });

archive.pipe(output);
archive.append(MANIFEST, { name: "extension.vsixmanifest" });
archive.append(CONTENT_TYPES, { name: "[Content_Types].xml" });

// Add all files
function addDir(dir, base) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    if (statSync(full).isDirectory()) {
      addDir(full, base);
    } else {
      archive.file(full, { name: `extension/${rel}` });
    }
  }
}

// Add package.json
archive.file(join(ROOT, "package.json"), { name: "extension/package.json" });
// Add out/ and dist/
addDir(join(ROOT, "out"), ROOT);
addDir(join(ROOT, "dist"), ROOT);

output.on("close", () => {
  console.log(`Created ${outFile} (${(archive.pointer() / 1024).toFixed(0)} KB)`);
});
archive.on("error", (e) => { throw e; });
await archive.finalize();
