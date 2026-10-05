import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function releaseAssets(release, repository, version, includeWindows = false) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error("Invalid repository/version");
  if (release.draft || !release.published_at || release.tag_name !== `desktop-v${version}`) throw new Error("A published matching desktop release is required");
  const suffixes = ["mac-arm64.dmg", "mac-arm64.zip", "mac-x64.dmg", "mac-x64.zip"];
  if (includeWindows) suffixes.push("win-x64.exe");
  const names = suffixes.map((suffix) => `HeyMoa-${version}-${suffix}`);
  const prefix = `https://github.com/${repository}/releases/download/desktop-v${version}/`;
  return [...names, "SHA256SUMS"].map((name) => {
    const matches = release.assets.filter((asset) => asset.name === name);
    if (matches.length !== 1 || matches[0].size <= 0 || matches[0].browser_download_url !== prefix + name) throw new Error(`Missing or invalid published asset: ${name}`);
    return matches[0];
  });
}
export function checksumMap(text) {
  const map = new Map();
  for (const line of text.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  (HeyMoa-[\w.-]+\.(?:dmg|zip|exe))$/.exec(line);
    if (!match || map.has(match[2])) throw new Error("Malformed or duplicate checksum");
    map.set(match[2], match[1]);
  }
  return map;
}
export async function verifyDownload(asset, body, expected) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of body) {
    hash.update(chunk);
    bytes += chunk.length;
    if (bytes > asset.size) throw new Error(`Download larger than published size: ${asset.name}`);
  }
  const sha256 = hash.digest("hex");
  if (bytes !== asset.size || sha256 !== expected) throw new Error(`Download checksum/size mismatch: ${asset.name}`);
  return { name: asset.name, url: asset.browser_download_url, sha256, bytes };
}
async function response(url) {
  const result = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { Accept: "application/vnd.github+json" } });
  if (!result.ok) throw new Error(`Published download unavailable: HTTP ${result.status}`);
  return result;
}
async function prepare() {
  const [repository, version, destination, platform] = process.argv.slice(2);
  if (!repository || !version || !destination) throw new Error("Usage: node scripts/release-manifest.mjs OWNER/REPO VERSION OUTPUT_DIR");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error("Invalid repository/version");
  const release = await (await response(`https://api.github.com/repos/${repository}/releases/tags/desktop-v${version}`)).json();
  if (platform !== undefined && platform !== "--include-windows") throw new Error("Unknown platform option");
  const assets = releaseAssets(release, repository, version, platform === "--include-windows");
  const checksums = checksumMap(await (await response(assets.at(-1).browser_download_url)).text());
  const verified = [];
  for (const asset of assets.slice(0, -1)) {
    verified.push(await verifyDownload(asset, (await response(asset.browser_download_url)).body, checksums.get(asset.name)));
  }
  const manifest = { version, tag: release.tag_name, releaseUrl: release.html_url, signing: "unsigned-beta", assets: verified };
  const output = resolve(destination);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "downloads.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Published downloads verified; manifest prepared locally, nothing published. Cask generation belongs to team-minswon/homebrew-tap.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prepare();
