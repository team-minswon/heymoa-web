const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const origin = "https://heymoa.app";
const idle = {
  phase: "idle",
  startedAt: null,
  pendingMs: 0,
  microphone: null,
  systemAudio: null,
};
function fixture() {
  const app = new EventEmitter(),
    window = new EventEmitter(),
    contents = new EventEmitter();
  let quits = 0,
    hides = 0,
    shows = 0,
    tray,
    interval,
    response = 0;
  let resolveAction;
  const nextAction = new Promise((resolve) => {
    resolveAction = resolve;
  });
  const sent = [],
    dialogs = [],
    answers = [];
  app.quit = () => {
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    app.emit("before-quit", event);
    if (!event.prevented) quits++;
  };
  window.isDestroyed = () => false;
  window.hide = () => hides++;
  window.show = () => shows++;
  window.focus = () => {};
  window.webContents = contents;
  contents.isDestroyed = () => false;
  contents.getURL = () => origin;
  contents.send = (...args) => {
    sent.push(args);
    resolveAction();
  };
  class Tray extends EventEmitter {
    constructor() {
      super();
      tray = this;
    }
    setToolTip(value) {
      this.tooltip = value;
    }
    setTitle() {}
    setContextMenu(value) {
      this.menu = value;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  const image = {
    isEmpty: () => false,
    setTemplateImage() {},
    resize() {
      return this;
    },
  };
  const electron = {
    app,
    BrowserWindow: class {},
    dialog: {
      showMessageBox: async (_window, options) => {
        dialogs.push(options);
        return { response: answers.length ? answers.shift() : response };
      },
    },
    Menu: { buildFromTemplate: (value) => value },
    nativeImage: { createFromPath: () => image },
    Tray,
  };
  const module = { exports: {} };
  const filename = path.resolve(__dirname, "../dist/recording-tray.js");
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module,
    exports: module.exports,
    __dirname: path.dirname(filename),
    process,
    require: (name) =>
      name === "electron"
        ? electron
        : name.startsWith(".")
          ? require(path.resolve(path.dirname(filename), name))
          : require(name),
    setTimeout,
    clearTimeout,
    setInterval: (fn) => {
      interval = fn;
      return 1;
    },
    clearInterval: () => {
      interval = null;
    },
  });
  const adapter = module.exports.createRecordingTray(window, origin);
  return {
    app,
    window,
    contents,
    adapter,
    tray,
    sent,
    nextAction,
    dialogs,
    answer: (...values) => answers.push(...values),
    set response(value) {
      response = value;
    },
    get quits() {
      return quits;
    },
    get hides() {
      return hides;
    },
    get shows() {
      return shows;
    },
    get interval() {
      return interval;
    },
  };
}
test("window close hides rather than stops; current meeting and stop are separate fixed actions", () => {
  const f = fixture();
  let prevented = false;
  f.window.emit("close", {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(f.hides, 1);
  assert.deepEqual(f.sent, []);
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.tray.menu.find((item) => item.label === "현재 회의 열기").click();
  f.tray.menu.find((item) => item.label === "녹음 종료").click();
  assert.deepEqual(f.sent, [
    ["heymoa:recording-action", "show-current"],
    ["heymoa:recording-action", "stop"],
  ]);
  assert.equal(f.quits, 0);
  assert.equal(f.shows, 2);
  f.adapter.dispose();
});
test(
  "app before-quit is cancelled while active and safe completion re-enters quit without blocking close",
  { timeout: 1000 },
  async (t) => {
    const f = fixture();
    t.after(() => f.adapter.dispose());
    f.response = 1;
    f.adapter.lifecycle.update({ ...idle, phase: "recording", pendingMs: 20 });
    f.app.quit();
    assert.equal(f.quits, 0);
    await f.nextAction;
    assert.deepEqual(f.sent, [["heymoa:recording-action", "stop"]]);
    f.adapter.lifecycle.update({ ...idle, phase: "failed", pendingMs: 20 });
    assert.equal(f.quits, 0);
    f.adapter.lifecycle.update(idle);
    assert.equal(f.quits, 1);
    let blocked = false;
    f.window.emit("close", {
      preventDefault() {
        blocked = true;
      },
    });
    assert.equal(blocked, false);
    f.adapter.dispose();
  }
);
test("cancelled external navigation does not erase summary; replacement and renderer crash do", () => {
  const f = fixture();
  f.adapter.lifecycle.update(idle);
  f.contents.emit(
    "did-start-navigation",
    {},
    "https://external.test",
    false,
    true
  );
  assert.equal(f.adapter.lifecycle.safe(), true);
  f.contents.emit("did-start-navigation", {}, origin + "/w#tab", true, true);
  assert.equal(f.adapter.lifecycle.safe(), true);
  f.adapter.lifecycle.update({ ...idle, phase: "recording" });
  f.contents.emit("did-start-navigation", {}, origin + "/w", false, true);
  assert.equal(f.adapter.lifecycle.safe(), false);
  f.adapter.lifecycle.update(idle);
  f.contents.emit("render-process-gone");
  assert.equal(f.adapter.lifecycle.view().unknown, true);
  f.adapter.dispose();
});
test("dispose removes native listeners and interval and destroys the tray exactly once", () => {
  const f = fixture();
  assert.equal(f.app.listenerCount("before-quit"), 1);
  f.adapter.dispose();
  f.adapter.dispose();
  assert.equal(f.app.listenerCount("before-quit"), 0);
  assert.equal(f.window.listenerCount("close"), 0);
  assert.equal(f.contents.listenerCount("render-process-gone"), 0);
  assert.equal(f.contents.listenerCount("did-start-navigation"), 0);
  assert.equal(f.contents.listenerCount("did-navigate"), 0);
  assert.equal(f.contents.listenerCount("will-prevent-unload"), 0);
  assert.equal(f.interval, null);
  assert.equal(f.tray.destroyed, true);
});

test("renderer beforeunload is overridden only after native loss confirmation", async (t) => {
  const f = fixture();
  t.after(() => f.adapter.dispose());
  let prevented = false;
  f.contents.emit("will-prevent-unload", {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false);
  // The first dialog chooses discard, the second independently confirms it.
  f.adapter.lifecycle.captureRequested();
  f.answer(2, 1);
  await f.adapter.lifecycle.requestQuit();
  assert.equal(f.dialogs.length, 2);
  assert.equal(f.quits, 1);
  f.contents.emit("will-prevent-unload", {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
});
