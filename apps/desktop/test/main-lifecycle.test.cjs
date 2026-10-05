const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const idle = {
  phase: "idle",
  startedAt: null,
  pendingMs: 0,
  microphone: null,
  systemAudio: null,
};

// Execute the shipped main entry and its modules together. Only Electron's OS
// boundary is replaced; broker, session adapter, IPC admission and tray are real.
async function fixture(t) {
  const app = new EventEmitter();
  const ipcMain = new EventEmitter();
  const handlers = new Map(),
    requests = [],
    dialogs = [],
    opened = [],
    windows = [];
  let ready;
  const readiness = new Promise((resolve) => {
    ready = resolve;
  });
  app.whenReady = () => readiness;
  app.requestSingleInstanceLock = () => true;
  app.isPackaged = true;
  app.setAsDefaultProtocolClient = () => true;
  let quits = 0,
    answer = 0;
  const event = () => ({
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  });
  app.quit = () => {
    const before = event();
    app.emit("before-quit", before);
    if (before.prevented) return;
    for (const window of windows) {
      if (window.destroyed) continue;
      const closing = event();
      window.emit("close", closing);
      if (closing.prevented) return;
      window.destroyed = true;
      window.emit("closed");
    }
    const will = event();
    app.emit("will-quit", will);
    if (!will.prevented) {
      quits++;
      app.emit("quit");
    }
  };
  const jar = {
    setPermissionCheckHandler() {},
    setPermissionRequestHandler() {},
    async fetch(url, options) {
      requests.push({
        url,
        body: JSON.parse(options.body),
        signal: options.signal,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: url.endsWith("/start")
            ? {
                authorizeUrl: `https://api.heymoa.app/v1/auth/desktop/authorize?ticket=${"t".repeat(43)}`,
              }
            : { message: "ok" },
        }),
      };
    },
  };
  class BrowserWindow extends EventEmitter {
    constructor() {
      super();
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        session: jar,
        mainFrame: { url: "https://heymoa.app" },
        isDestroyed: () => this.destroyed ?? false,
        getURL: () => "https://heymoa.app",
        setWindowOpenHandler() {},
        send() {},
      });
      windows.push(this);
    }
    isDestroyed() {
      return this.destroyed ?? false;
    }
    isMinimized() {
      return false;
    }
    show() {}
    focus() {}
    hide() {}
    restore() {}
    async loadURL() {}
  }
  class Tray extends EventEmitter {
    setToolTip() {}
    setTitle() {}
    setContextMenu() {}
    destroy() {}
  }
  const image = {
    isEmpty: () => false,
    setTemplateImage() {},
    resize() {
      return this;
    },
  };
  ipcMain.handle = (channel, callback) => handlers.set(channel, callback);
  const electron = {
    app,
    ipcMain,
    BrowserWindow,
    Tray,
    nativeImage: { createFromPath: () => image },
    Menu: { buildFromTemplate: (value) => value },
    session: { fromPartition: () => jar },
    shell: { openExternal: async (url) => opened.push(url) },
    dialog: {
      showErrorBox() {
        assert.fail("unexpected startup failure");
      },
      async showMessageBox(_window, options) {
        dialogs.push(options);
        return { response: answer };
      },
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    vm.runInNewContext(
      fs.readFileSync(filename, "utf8"),
      {
        module,
        exports: module.exports,
        __dirname: path.dirname(filename),
        process: {
          platform: "darwin",
          arch: "arm64",
          argv: [],
          env: {},
          getSystemVersion: () => "14.2",
        },
        Buffer,
        URL,
        AbortController,
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        require: (name) =>
          name === "electron"
            ? electron
            : name.startsWith(".")
              ? load(
                  require.resolve(path.resolve(path.dirname(filename), name))
                )
              : require(name),
      },
      { filename }
    );
    return module.exports;
  }
  load(path.resolve(__dirname, "../dist/main.js"));
  ready();
  await tick();
  const window = windows[0];
  assert.ok(window, "main's ready handler creates the window and tray");
  const sender = {
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  };
  const invoke = (channel, payload) => handlers.get(channel)(sender, payload);
  t.after(() => {
    if (!window.isDestroyed()) {
      invoke("heymoa:auth-cancel", undefined);
      window.emit("closed");
    }
    app.removeAllListeners();
  });
  return {
    app,
    invoke,
    requests,
    dialogs,
    opened,
    get quits() {
      return quits;
    },
    set answer(value) {
      answer = value;
    },
  };
}

test("main preserves an OAuth request when the recording quit dialog is cancelled", async (t) => {
  const f = await fixture(t);
  f.invoke("heymoa:recording-summary", { ...idle, phase: "recording" });
  const outcome = f.invoke("heymoa:auth-login", undefined);
  await tick();
  assert.equal(f.opened.length, 1);
  f.app.quit();
  await tick();
  assert.equal(f.quits, 0);
  assert.equal(f.dialogs.length, 1);
  assert.equal(
    f.requests[0].signal.aborted,
    false,
    "a vetoed quit must not revoke pending PKCE state"
  );
  f.app.emit(
    "open-url",
    { preventDefault() {} },
    `app.heymoa:/auth/callback?state=${f.requests[0].body.state}&code=${"c".repeat(43)}`
  );
  assert.equal((await outcome).status, "success");
  assert.equal(
    f.requests[1].url,
    "https://api.heymoa.app/v1/auth/desktop/exchange"
  );
});

test("main cancels pending OAuth only when a safe quit actually proceeds", async (t) => {
  const f = await fixture(t);
  f.invoke("heymoa:recording-summary", idle);
  const outcome = f.invoke("heymoa:auth-login", undefined);
  await tick();
  f.app.quit();
  await tick();
  assert.equal(f.quits, 1);
  assert.equal((await outcome).status, "cancelled");
  assert.equal(f.requests[0].signal.aborted, true);
  assert.equal(f.dialogs.length, 0);
});
