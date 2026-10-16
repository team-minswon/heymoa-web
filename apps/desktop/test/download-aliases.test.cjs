const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

test("stable aliases preserve installer bytes and exclude old versions and Homebrew ZIPs", async () => {
  const { prepareDownloadAliases } = await import("../scripts/prepare-download-aliases.mjs");
  const directory = mkdtempSync(join(tmpdir(), "heymoa-alias-"));
  try {
    for (const suffix of ["mac-arm64.dmg", "win-x64.exe"]) {
      writeFileSync(join(directory, `HeyMoa-1.2.3-${suffix}`), `fixture-${suffix}`);
    }
    writeFileSync(join(directory, "HeyMoa-0.9.0-mac-arm64.dmg"), "old fixture");
    writeFileSync(join(directory, "HeyMoa-1.2.3-mac-arm64.zip"), "brew fixture");
    const aliases = prepareDownloadAliases(directory, "1.2.3");
    assert.equal(aliases.length, 2);
    for (const alias of aliases) {
      assert.deepEqual(readFileSync(join(directory, alias)), readFileSync(join(directory, alias.replace("HeyMoa-", "HeyMoa-1.2.3-"))));
    }
    assert.deepEqual(prepareDownloadAliases(directory, "1.2.3"), aliases);
    assert.throws(() => prepareDownloadAliases(directory, "2.0.0"), /No matching/);
    assert.throws(() => prepareDownloadAliases(directory, "../bad"), /Invalid version/);
    writeFileSync(join(directory, "HeyMoa-2.0.0-win-x64.exe"), "");
    assert.throws(() => prepareDownloadAliases(directory, "2.0.0"), /Invalid installer/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
