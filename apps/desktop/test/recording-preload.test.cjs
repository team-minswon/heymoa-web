const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
function preload(mainFrame) {
  let bridge;
  const required = [],
    ipc = new EventEmitter();
  ipc.invoke = async () => {};
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "../dist/preload.js"), "utf8"),
    {
      module,
      exports: module.exports,
      process: { isMainFrame: mainFrame },
      require: (name) => {
        required.push(name);
        assert.equal(name, "electron");
        return {
          ipcRenderer: ipc,
          contextBridge: {
            exposeInMainWorld: (name, value) => {
              assert.equal(name, "heymoaDesktop");
              bridge = value;
            },
          },
        };
      },
    }
  );
  return { bridge, ipc, required };
}
test("sandbox preload exports the optional subscription without requiring a runtime contracts package", () => {
  const { bridge, required } = preload(true);
  assert.equal(Object.isFrozen(bridge), true);
  assert.equal(typeof bridge.subscribeRecordingActions, "function");
  assert.deepEqual(required, ["electron"]);
});
test("recording actions admit only the fixed enum and unsubscribe releases the callback", () => {
  const { bridge, ipc } = preload(true),
    actions = [];
  const unsubscribe = bridge.subscribeRecordingActions((action) =>
    actions.push(action)
  );
  for (const action of [
    "show-current",
    "stop",
    "https://evil.test",
    { action: "stop" },
    null,
  ])
    ipc.emit("heymoa:recording-action", {}, action);
  assert.deepEqual(actions, ["show-current", "stop"]);
  unsubscribe();
  unsubscribe();
  assert.equal(ipc.listenerCount("heymoa:recording-action"), 0);
  ipc.emit("heymoa:recording-action", {}, "stop");
  assert.equal(actions.length, 2);
});
test("a subframe receives no native bridge or recording subscription", () => {
  const { bridge, ipc } = preload(false);
  assert.equal(bridge, undefined);
  assert.equal(ipc.listenerCount("heymoa:recording-action"), 0);
});
