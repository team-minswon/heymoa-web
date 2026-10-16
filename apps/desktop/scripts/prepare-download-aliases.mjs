import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function prepareDownloadAliases(directory, version) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error("Invalid version");
  const aliases = [];
  for (const suffix of ["mac-arm64.dmg", "win-x64.exe"]) {
    const source = resolve(directory, `HeyMoa-${version}-${suffix}`);
    if (!existsSync(source)) continue;
    if (!statSync(source).isFile() || statSync(source).size === 0) throw new Error(`Invalid installer: ${source}`);
    const name = `HeyMoa-${suffix}`;
    copyFileSync(source, resolve(directory, name));
    aliases.push(name);
  }
  if (!aliases.length) throw new Error("No matching installers to alias");
  return aliases;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  console.log(prepareDownloadAliases(resolve(process.argv[2] ?? fileURLToPath(new URL("../release/", import.meta.url))), version).join("\n"));
}
