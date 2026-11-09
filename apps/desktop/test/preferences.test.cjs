const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, writeFile, rm, mkdir } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { loadLanguage, saveLanguage } = require("../dist/preferences");
const { getLanguage, setLanguage } = require("../dist/i18n");
afterEach(() => setLanguage("ko"));
test("first launch follows OS language; explicit choices survive restart, concurrent saves, and malformed preferences", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "heymoa-language-")); t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [osLocale, expected] of [["ko-KR", "ko"], ["KO_kr", "ko"], ["en-US", "en"], ["ja-JP", "en"]]) {
    await loadLanguage(dir, osLocale); assert.equal(getLanguage(), expected);
  }
  await Promise.all([saveLanguage(dir, "en"), saveLanguage(dir, "ko"), saveLanguage(dir, "en")]);
  await loadLanguage(dir, "ko-KR"); assert.equal(getLanguage(), "en");
  assert.equal(JSON.parse(await readFile(path.join(dir, "preferences.json"))).language, "en");
  await writeFile(path.join(dir, "preferences.json"), "bad json");
  await loadLanguage(dir, "ko-KR"); assert.equal(getLanguage(), "ko");
  const blocked = path.join(dir, "blocked"); await writeFile(blocked, "file");
  await assert.rejects(saveLanguage(blocked, "en")); assert.equal(getLanguage(), "ko");
  await saveLanguage(dir, "en"); assert.equal(getLanguage(), "en");
});
