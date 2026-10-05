const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
test("missing published release inputs fail without producing a download URL", () => {
  const result = spawnSync(process.execPath, ["scripts/release-manifest.mjs"], { cwd: require("node:path").join(__dirname, ".."), encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage/);
});
test("streamed download rejects changed bytes, truncation and excess without producing verified metadata", async () => {
  const { verifyDownload } = await import("../scripts/release-manifest.mjs");
  const { createHash } = require("node:crypto");
  const bytes = Buffer.from("installer fixture");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const asset = { name: "fixture.zip", size: bytes.length, browser_download_url: "fixture-only" };
  const chunks = async function* (value) { yield value.subarray(0, 4); yield value.subarray(4); };
  assert.equal((await verifyDownload(asset, chunks(bytes), digest)).sha256, digest);
  await assert.rejects(verifyDownload(asset, chunks(Buffer.alloc(bytes.length)), digest), /mismatch/);
  await assert.rejects(verifyDownload(asset, chunks(bytes.subarray(0, 8)), digest), /mismatch/);
  await assert.rejects(verifyDownload(asset, chunks(Buffer.concat([bytes, bytes])), digest), /larger/);
});
test("release assets reject drafts, missing artifacts and foreign URLs", async () => {
  const { releaseAssets, checksumMap } = await import("../scripts/release-manifest.mjs");
  const repo = "test/fixture";
  const names = ["mac-arm64.dmg", "mac-arm64.zip", "mac-x64.dmg", "mac-x64.zip", "win-x64.exe"].map((suffix) => `HeyMoa-1.2.3-${suffix}`);
  const release = { draft: false, published_at: "fixture", tag_name: "desktop-v1.2.3", assets: [...names, "SHA256SUMS"].map((name) => ({ name, size: 10, browser_download_url: `https://github.com/${repo}/releases/download/desktop-v1.2.3/${name}` })) };
  assert.equal(releaseAssets(release, repo, "1.2.3").length, 5);
  assert.equal(releaseAssets(release, repo, "1.2.3", true).length, 6);
  const macOnly = { ...release, assets: release.assets.filter((asset) => !asset.name.endsWith("win-x64.exe")) };
  assert.equal(releaseAssets(macOnly, repo, "1.2.3").length, 5);
  assert.throws(() => releaseAssets(macOnly, repo, "1.2.3", true), /Missing/);
  assert.throws(() => releaseAssets({ ...release, draft: true }, repo, "1.2.3"), /published/);
  assert.throws(() => releaseAssets({ ...release, assets: release.assets.slice(1) }, repo, "1.2.3"), /Missing/);
  assert.throws(() => releaseAssets({ ...release, assets: release.assets.map((a) => ({ ...a, browser_download_url: "https://example.invalid/file" })) }, repo, "1.2.3"), /invalid/);
  assert.throws(() => checksumMap("invalid"), /Malformed/);
  const line = `${"a".repeat(64)}  ${names[0]}`;
  assert.throws(() => checksumMap(`${line}\n${line}`), /duplicate/);
});
