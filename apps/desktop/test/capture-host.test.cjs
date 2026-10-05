const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
function fixture(t, settings = {}) {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const ipcMain = new EventEmitter(),
    windows = [],
    packets = [];
  class Window {
    constructor(options) {
      this.options = options;
      this.destroyed = false;
      this.handlers = {};
      const contents = (this.webContents = new EventEmitter());
      contents.mainFrame = { url: "" };
      contents.isDestroyed = () => this.destroyed;
      contents.send = (...args) => packets.push(args);
      contents.setWindowOpenHandler = (callback) =>
        (this.handlers.popup = callback);
      contents.session = {
        webRequest: {
          onBeforeRequest: (callback) => (this.handlers.request = callback),
        },
        setPermissionCheckHandler: (callback) =>
          (this.handlers.check = callback),
        setPermissionRequestHandler: (callback) =>
          (this.handlers.permission = callback),
        setDisplayMediaRequestHandler: (callback) =>
          (this.handlers.display = callback),
      };
      contents.executeJavaScript = async (_script, userGesture) => {
        if (!userGesture) return;
        const frame = contents.mainFrame;
        for (const mediaTypes of [[], ["audio"]]) {
          let allowed;
          this.handlers.permission(
            contents,
            "media",
            (value) => (allowed = value),
            { isMainFrame: true, requestingUrl: frame.url, mediaTypes }
          );
          assert.equal(allowed, true);
        }
        await new Promise((resolve) =>
          this.handlers.display(
            {
              frame,
              securityOrigin: "file://",
              userGesture,
              audioRequested: true,
              videoRequested: true,
            },
            (selection) => {
              this.selection = selection;
              resolve();
            }
          )
        );
        if (settings.neverSettleAcquire) await new Promise(() => {});
      };
      windows.push(this);
    }
    async loadURL(url) {
      this.webContents.mainFrame.url = url;
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.webContents.emit("destroyed");
    }
  }
  const filename = path.resolve(__dirname, "../dist/capture-host.js"),
    exports = {};
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    exports,
    __dirname: path.dirname(filename),
    ArrayBuffer,
    URL,
    Date,
    setTimeout,
    clearTimeout,
    require: (name) =>
      name === "electron"
        ? {
            BrowserWindow: Window,
            ipcMain,
            desktopCapturer: {
              getSources:
                settings.getSources ??
                (async () => [{ id: "screen:1", name: "Screen" }]),
            },
          }
        : require(
            name.startsWith(".")
              ? path.resolve(path.dirname(filename), name)
              : name
          ),
  });
  const destination = {
    mainFrame: { url: "https://heymoa.app/w" },
    isDestroyed: () => false,
    send: (...args) => packets.push(args),
  };
  const host = new exports.CaptureHost(destination, destination.mainFrame);
  const emit = (payload) =>
    ipcMain.emit(
      "heymoa:local-capture-packet",
      {
        sender: windows[0].webContents,
        senderFrame: windows[0].webContents.mainFrame,
      },
      payload
    );
  return { host, windows, packets, ipcMain, emit, destination };
}
test("source enumeration failure settles acquire even when destroyed Chromium evaluation never settles", async (t) => {
  const f = fixture(t, {
    neverSettleAcquire: true,
    getSources: async () => {
      // Electron may reject with a value that has no Error name/message.
      throw Object.create(null);
    },
  });
  await assert.rejects(f.host.acquire(), /AUDIO_CAPTURE_FAILED/);
  assert.equal(Object.keys(f.windows[0].selection).length, 0);
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.ipcMain.listenerCount("heymoa:local-capture-packet"), 0);
});
test("explicit disposal settles a pending acquire without a native rejection or timer", async (t) => {
  const f = fixture(t, { neverSettleAcquire: true });
  const acquiring = f.host.acquire();
  // Let native grant/selection finish, but keep the evaluated acquire Promise pending.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.windows[0].selection.audio, "loopback");
  f.host.dispose();
  await assert.rejects(acquiring, /AUDIO_CAPTURE_CANCELLED/);
  f.host.dispose();
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.ipcMain.listenerCount("heymoa:local-capture-packet"), 0);
  await assert.rejects(f.host.acquire(), /AUDIO_CAPTURE_CANCELLED/);
  assert.equal(f.windows.length, 1);
});
test("grant expiration settles an unresponsive acquisition and releases native resources", async (t) => {
  const f = fixture(t, { neverSettleAcquire: true });
  const acquiring = f.host.acquire();
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(120000);
  await assert.rejects(acquiring, /AUDIO_CAPTURE_CANCELLED/);
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.ipcMain.listenerCount("heymoa:local-capture-packet"), 0);
});
for (const operation of ["start", "stop"]) {
  test(`renderer destruction settles an in-progress ${operation} evaluation`, async (t) => {
    const f = fixture(t);
    const id = await f.host.acquire();
    f.windows[0].webContents.executeJavaScript = () => new Promise(() => {});
    const pending = f.host[operation](id);
    f.windows[0].destroy();
    await assert.rejects(pending, /AUDIO_CAPTURE_CANCELLED/);
    assert.equal(f.ipcMain.listenerCount("heymoa:local-capture-packet"), 0);
  });
}
test("only packaged local exact frame receives native media and external local requests fail closed", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  await f.host.acquire();
  const window = f.windows[0];
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.selection.audio, "loopback");
  assert.equal(f.packets.length, 0); // Native source/video never crosses to remote destination.
  let allowed;
  window.handlers.permission(
    f.destination,
    "media",
    (value) => (allowed = value),
    { isMainFrame: true, mediaTypes: ["audio"] }
  );
  assert.equal(allowed, false);
  window.handlers.permission(
    window.webContents,
    "media",
    (value) => (allowed = value),
    { isMainFrame: false, mediaTypes: ["audio"] }
  );
  assert.equal(allowed, false);
  let result;
  window.handlers.request(
    { url: "https://heymoa.app" },
    (value) => (result = value)
  );
  assert.equal(result.cancel, true);
});
test("PCM requires exact local frame, bounded schema, one ACK in flight and matching remote document", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  const id = await f.host.acquire();
  const packet = {
    kind: "pcm",
    id,
    sequence: 0,
    captureSamples: 128,
    samples: new ArrayBuffer(3200),
  };
  f.ipcMain.emit(
    "heymoa:local-capture-packet",
    { sender: f.destination, senderFrame: f.destination.mainFrame },
    packet
  );
  assert.equal(f.packets.length, 0);
  f.emit(packet);
  assert.equal(f.packets[0][1], packet);
  f.host.ack("old", 0);
  f.emit({ ...packet, sequence: 1, captureSamples: 1728 });
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.packets.at(-1)[1].kind, "error");
});
test("remote navigation stops local capture before forwarding another PCM packet", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  const id = await f.host.acquire();
  f.destination.mainFrame = { url: "https://heymoa.app/new" };
  f.emit({
    kind: "pcm",
    id,
    sequence: 0,
    captureSamples: 0,
    samples: new ArrayBuffer(3200),
  });
  assert.equal(f.packets.length, 0);
  assert.equal(f.windows[0].destroyed, true);
});
test("missing remote ACK times out and disposes local capture without a polling interval", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  const id = await f.host.acquire();
  f.emit({
    kind: "pcm",
    id,
    sequence: 0,
    captureSamples: 0,
    samples: new ArrayBuffer(3200),
  });
  t.mock.timers.tick(1999);
  assert.equal(f.windows[0].destroyed, false);
  t.mock.timers.tick(1);
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.packets.at(-1)[1].code, "DESKTOP_AUDIO_BACKPRESSURE");
});
test("correct ACK releases the next PCM packet and cancels the former deadline", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  const id = await f.host.acquire();
  f.emit({
    kind: "pcm",
    id,
    sequence: 0,
    captureSamples: 0,
    samples: new ArrayBuffer(3200),
  });
  f.host.ack(id, 0);
  t.mock.timers.tick(100);
  f.emit({
    kind: "pcm",
    id,
    sequence: 1,
    captureSamples: 1600,
    samples: new ArrayBuffer(3200),
  });
  f.host.ack(id, 1);
  t.mock.timers.tick(2000);
  assert.equal(f.windows[0].destroyed, false);
  assert.equal(
    f.packets.filter((packet) => packet[1]?.kind === "pcm").length,
    2
  );
});
test("rapid state events coalesce to the latest ended state instead of losing input failure", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  const id = await f.host.acquire();
  f.emit({ kind: "states", id, microphone: "live", systemAudio: "live" });
  f.emit({ kind: "states", id, microphone: "live", systemAudio: "muted" });
  f.emit({ kind: "states", id, microphone: "live", systemAudio: "ended" });
  assert.equal(f.packets.length, 1);
  t.mock.timers.tick(50);
  assert.equal(f.packets.length, 2);
  assert.equal(f.packets.at(-1)[1].systemAudio, "ended");
});
test("capture discontinuity keeps its sample coordinate without an arbitrary two-second cutoff", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  const id = await f.host.acquire();
  f.emit({
    kind: "pcm",
    id,
    sequence: 0,
    captureSamples: 0,
    samples: new ArrayBuffer(3200),
  });
  f.host.ack(id, 0);
  t.mock.timers.tick(100);
  f.emit({
    kind: "pcm",
    id,
    sequence: 1,
    captureSamples: 160000,
    samples: new ArrayBuffer(3200),
  });
  assert.equal(f.windows[0].destroyed, false);
  assert.equal(f.packets.at(-1)[1].captureSamples, 160000);
});
test("local renderer crash reports failure and releases its window and IPC listener", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  await f.host.acquire();
  f.windows[0].webContents.emit("render-process-gone");
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.packets.at(-1)[1].code, "AUDIO_CAPTURE_FAILED");
  assert.equal(f.ipcMain.listenerCount("heymoa:local-capture-packet"), 0);
});
test("failed local tail drain still destroys the capture host and preserves the failure", async (t) => {
  const f = fixture(t);
  t.after(() => f.host.dispose());
  const id = await f.host.acquire();
  f.windows[0].webContents.executeJavaScript = async () => {
    throw new Error("DESKTOP_AUDIO_BACKPRESSURE");
  };
  await assert.rejects(f.host.stop(id), /DESKTOP_AUDIO_BACKPRESSURE/);
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.ipcMain.listenerCount("heymoa:local-capture-packet"), 0);
});
