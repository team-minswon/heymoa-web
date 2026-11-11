const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { DesktopUpdates } = require("../dist/updates");
function fixture(options = {}) {
  const updater = new EventEmitter();
  let calls = 0, installs = 0, downloads = 0, safe = false;
  const saved = [];
  updater.checkForUpdates = async () => {
    calls++; updater.emit("checking-for-update");
    updater.emit("update-available", { version: "0.1.5" });
    return { downloadPromise: updater.autoDownload ? updater.downloadUpdate() : undefined };
  };
  updater.downloadUpdate = async () => { downloads++; updater.emit("update-downloaded", { version: "0.1.5" }); return []; };
  updater.quitAndInstall = (silent, relaunch) => { assert.equal(silent, true); assert.equal(relaunch, updater.autoRunAppAfterInstall); installs++; };
  const model = new DesktopUpdates(updater, { currentVersion: "0.1.4", available: true, automatic: false,
    safe: () => safe, prepareInstall: () => safe, cancelInstall() {},
    saveAutomatic: async (enabled) => { saved.push(enabled); }, changed() {}, ...options });
  return { model, updater, saved, setSafe: (value) => { safe = value; }, get calls() { return calls; }, get downloads() { return downloads; }, get installs() { return installs; } };
}
test("manual check downloads once, reports progress, and installs only after the native guard permits it", async () => {
  const f = fixture();
  assert.equal(f.updater.autoDownload, false);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.allowDowngrade, false);
  assert.equal(f.updater.allowPrerelease, false);
  await Promise.all([f.model.check(), f.model.check()]);
  assert.equal(f.calls, 1);
  assert.equal(f.model.state().status, "ready");
  f.model.restart(); assert.equal(f.installs, 0);
  assert.equal(f.model.onQuit(), false);
  f.setSafe(true); assert.equal(f.model.state().canRestart, true);
  // A new recording may begin after the button was drawn.
  f.setSafe(false); f.model.restart(); assert.equal(f.installs, 0);
  f.setSafe(true); f.model.restart(); f.model.restart(); assert.equal(f.installs, 1);
});
test("metadata checks do not download with automatic off; enabling persists and still respects recording", async () => {
  const f = fixture();
  f.model.start(); await f.model.check(false); f.model.dispose();
  assert.equal(f.calls, 1); assert.equal(f.downloads, 0); assert.equal(f.model.state().status, "available");
  await f.model.setAutomatic(true); await f.model.check();
  assert.deepEqual(f.saved, [true]); assert.equal(f.model.state().automatic, true);
  assert.equal(f.calls, 1); assert.equal(f.model.onQuit(), false);
  f.setSafe(true); assert.equal(f.model.onQuit(), true); assert.equal(f.installs, 1); assert.equal(f.updater.autoRunAppAfterInstall, false);
});
test("disabling automatic updates prevents installation on normal quit even with a downloaded update", async () => {
  const f = fixture(); await f.model.setAutomatic(true); await f.model.check();
  await f.model.setAutomatic(false); f.setSafe(true);
  assert.equal(f.model.onQuit(), false); assert.equal(f.installs, 0);
  f.model.restart(); assert.equal(f.installs, 1);
});
test("download failure can be retried and never installs; persistence failure does not opt in", async () => {
  const f = fixture();
  f.updater.checkForUpdates = async () => { throw new Error("offline"); };
  await f.model.check(); assert.equal(f.model.state().status, "error");
  f.model.restart(); assert.equal(f.installs, 0);
  f.updater.checkForUpdates = async () => { f.updater.emit("update-not-available"); return null; };
  await f.model.check(); assert.equal(f.model.state().status, "current");
  const broken = fixture({ saveAutomatic: async () => { throw new Error("disk full"); } });
  await assert.rejects(broken.model.setAutomatic(true));
  assert.equal(broken.model.state().automatic, false); assert.equal(broken.calls, 0);
});
test("unpackaged runs never check or install, including automatic startup", async () => {
  const f = fixture({ available: false, automatic: true });
  f.model.start(); await f.model.check(); f.model.restart();
  assert.equal(f.calls, 0); assert.equal(f.installs, 0); assert.equal(f.model.state().status, "unavailable");
});

test("installer failure removes the quit bypass and permits retry without restarting", async () => {
  let cancellations = 0;
  const f = fixture({ cancelInstall: () => cancellations++ });
  await f.model.check(); f.setSafe(true);
  f.updater.quitAndInstall = () => { throw new Error("installer failed"); };
  assert.equal(f.model.restart().status, "error"); assert.equal(cancellations, 1);
});

test("manual download after a metadata check is single-flight and current clears stale notices", async () => {
  const f = fixture(); await f.model.check(false);
  assert.equal(f.model.state().status, "available"); assert.equal(f.downloads, 0);
  await Promise.all([f.model.check(), f.model.check()]); assert.equal(f.downloads, 1);
  f.updater.emit("update-not-available");
  assert.equal(f.model.state().status, "current"); assert.equal(f.model.state().version, undefined); assert.equal(f.model.state().percent, undefined);
});
