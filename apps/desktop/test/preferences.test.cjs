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

test("automatic updates default on only when unset, survive restart, and do not overwrite language", async (t) => {
  const { loadAutomaticUpdates, saveAutomaticUpdates } = require("../dist/preferences");
  const dir = await mkdtemp(path.join(os.tmpdir(), "heymoa-updates-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.equal(await loadAutomaticUpdates(dir), true);
  await writeFile(path.join(dir, "updates.json"), "{}"); assert.equal(await loadAutomaticUpdates(dir), true);
  await loadLanguage(dir, "ko");
  await saveLanguage(dir, "en"); await saveAutomaticUpdates(dir, true);
  assert.equal(await loadAutomaticUpdates(dir), true);
  await loadLanguage(dir, "ko"); assert.equal(getLanguage(), "en");
  await saveAutomaticUpdates(dir, false); assert.equal(await loadAutomaticUpdates(dir), false);
  await writeFile(path.join(dir, "updates.json"), "bad json"); assert.equal(await loadAutomaticUpdates(dir), false);
});

test("panel preferences validate stored values and serialize writes without changing updater choices", async t => {
  const { loadPanelPreferences, savePanelPreferences, saveAutomaticUpdates, loadAutomaticUpdates } = require("../dist/preferences");
  const dir = await mkdtemp(path.join(os.tmpdir(), "heymoa-panel-")); t.after(() => rm(dir, { recursive: true, force: true }));
  assert.deepEqual(await loadPanelPreferences(dir), { pinned: false, opacity: 1 });
  await saveAutomaticUpdates(dir, false);
  await Promise.all([savePanelPreferences(dir, { pinned: true, opacity: 0.8 }), savePanelPreferences(dir, { pinned: true, opacity: 0.2, position: { x: -300, y: 40 } })]);
  assert.deepEqual(await loadPanelPreferences(dir), { pinned: true, opacity: 0.2, position: { x: -300, y: 40 } });
  assert.equal(await loadAutomaticUpdates(dir), false);
  await writeFile(path.join(dir, "meeting-panel.json"), JSON.stringify({ pinned: "yes", opacity: 0.01, position: { x: "bad", y: 1 } }));
  assert.deepEqual(await loadPanelPreferences(dir), { pinned: false, opacity: 1 });
});
