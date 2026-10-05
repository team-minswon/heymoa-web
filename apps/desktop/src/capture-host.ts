import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  type IpcMainEvent,
  type WebContents,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MediaGrant } from "./media-grant";
import {
  CAPTURE_ACK_TIMEOUT_MS,
  CAPTURE_ERRORS,
  CAPTURE_EVENT,
  CAPTURE_PACKET,
  INPUT_STATUS_INTERVAL_MS,
  LOCAL_ACK,
  PCM_DELIVERY_BURST_SAMPLES,
  PCM_SAMPLES_PER_MS,
  capturePacket,
  type CapturePacket,
} from "./capture-protocol";

export class CaptureHost {
  private host: BrowserWindow | null = null;
  private grant: MediaGrant | null = null;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: number | null = null;
  private nextSequence = 0;
  private nextSample: number | null = null;
  private pcmStartedAt = 0;
  private pcmSamples = 0;
  private lastLevelsAt = 0;
  private lastStatesAt = 0;
  private statesTimer: ReturnType<typeof setTimeout> | null = null;
  private queuedStates: Extract<CapturePacket, { kind: "states" }> | null =
    null;
  id: string | null = null;
  acquiring = true;
  private readonly destinationOrigin: string;
  constructor(
    private readonly destination: WebContents,
    private readonly destinationFrame: Electron.WebFrameMain,
    private readonly onDisposed: () => void = () => {}
  ) {
    this.destinationOrigin = new URL(destinationFrame.url).origin;
  }
  private sameDestination() {
    try {
      return (
        !this.destination.isDestroyed() &&
        this.destination.mainFrame === this.destinationFrame &&
        new URL(this.destinationFrame.url).origin === this.destinationOrigin
      );
    } catch {
      return false;
    }
  }
  private forward(packet: CapturePacket) {
    if (this.sameDestination()) this.destination.send(CAPTURE_EVENT, packet);
    else this.dispose();
  }
  private fail(code = "AUDIO_CAPTURE_FAILED") {
    if (this.id) this.forward({ kind: "error", id: this.id, code });
    this.dispose();
  }
  private packet = (event: IpcMainEvent, payload: unknown) => {
    const host = this.host;
    if (
      !host ||
      this.disposed ||
      event.sender !== host.webContents ||
      event.senderFrame !== host.webContents.mainFrame ||
      event.senderFrame.url !== this.url ||
      !this.id
    )
      return;
    try {
      const packet = capturePacket(payload, this.id);
      const now = Date.now();
      if (packet.kind === "pcm") {
        if (
          this.acquiring ||
          this.pending !== null ||
          packet.sequence !== this.nextSequence ||
          (this.nextSample !== null && packet.captureSamples < this.nextSample)
        )
          throw new Error("INVALID_CAPTURE_TIMING");
        if (!this.pcmStartedAt) this.pcmStartedAt = now;
        this.pcmSamples += packet.samples.byteLength / 2;
        if (
          this.pcmSamples >
          (now - this.pcmStartedAt) * PCM_SAMPLES_PER_MS +
            PCM_DELIVERY_BURST_SAMPLES
        )
          throw new Error("INVALID_CAPTURE_RATE");
        this.nextSequence++;
        this.nextSample = packet.captureSamples + packet.samples.byteLength / 2;
        this.pending = packet.sequence;
        this.timer = setTimeout(
          () => this.fail("DESKTOP_AUDIO_BACKPRESSURE"),
          CAPTURE_ACK_TIMEOUT_MS
        );
      } else if (packet.kind === "levels") {
        if (now - this.lastLevelsAt < INPUT_STATUS_INTERVAL_MS) return;
        this.lastLevelsAt = now;
      } else if (packet.kind === "states") {
        if (now - this.lastStatesAt < INPUT_STATUS_INTERVAL_MS) {
          this.queuedStates = packet;
          if (!this.statesTimer)
            this.statesTimer = setTimeout(
              () => {
                const latest = this.queuedStates;
                this.queuedStates = null;
                this.statesTimer = null;
                this.lastStatesAt = Date.now();
                if (latest && !this.disposed) this.forward(latest);
              },
              INPUT_STATUS_INTERVAL_MS - (now - this.lastStatesAt)
            );
          return;
        }
        if (this.statesTimer) clearTimeout(this.statesTimer);
        this.statesTimer = null;
        this.queuedStates = null;
        this.lastStatesAt = now;
      }
      this.forward(packet);
      if (packet.kind === "error") this.dispose();
    } catch {
      this.fail();
    }
  };
  private readonly url = pathToFileURL(path.join(__dirname, "capture.html"))
    .href;
  async acquire(): Promise<string> {
    const host = new BrowserWindow({
      show: false,
      width: 1,
      height: 1,
      webPreferences: {
        preload: path.join(__dirname, "capture-preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: `capture-${Date.now()}`,
        backgroundThrottling: false,
      },
    });
    this.host = host;
    const contents = host.webContents;
    const grant = new MediaGrant(
      (active) => {
        if (!active && this.id) this.dispose();
      },
      () => contents.mainFrame.url === this.url
    );
    this.grant = grant;
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event) => {
      event.preventDefault();
      this.fail();
    });
    contents.on("will-frame-navigate", (event) => {
      event.preventDefault();
      this.fail();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.on("render-process-gone", () => this.fail());
    contents.on("destroyed", () => this.dispose());
    const allowedFiles = new Set([
      this.url,
      pathToFileURL(path.join(__dirname, "capture-renderer.js")).href,
      pathToFileURL(path.join(__dirname, "pcm-capture-worklet.js")).href,
    ]);
    contents.session.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: !allowedFiles.has(details.url) })
    );
    contents.session.setPermissionCheckHandler(() => false);
    contents.session.setPermissionRequestHandler(
      (requester, permission, callback, details) => {
        const info = details as Electron.MediaAccessPermissionRequest;
        callback(
          requester === contents &&
            info.isMainFrame &&
            permission === "media" &&
            grant.allowPermission(
              contents.mainFrame,
              info.requestingUrl,
              "file://",
              info.mediaTypes
            )
        );
      }
    );
    contents.session.setDisplayMediaRequestHandler(
      (request, callback) => {
        const id = grant.claimDisplay(request, contents.mainFrame, "file://");
        const deny = () => {
          try {
            callback({});
          } catch {
            /* frame closed */
          }
        };
        if (!id) {
          deny();
          return;
        }
        void desktopCapturer
          .getSources({
            types: ["screen"],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: false,
          })
          .then((sources) => {
            if (
              !sources[0] ||
              this.disposed ||
              contents.isDestroyed() ||
              !grant.valid(
                id,
                request.frame,
                request.securityOrigin,
                "file://"
              ) ||
              request.frame !== contents.mainFrame
            ) {
              deny();
              return;
            }
            try {
              callback({ video: sources[0], audio: "loopback" });
            } catch {
              this.dispose();
            }
          })
          .catch(() => {
            deny();
            this.dispose();
          });
      },
      { useSystemPicker: false }
    );
    ipcMain.on(CAPTURE_PACKET, this.packet);
    try {
      await host.loadURL(this.url);
      if (this.disposed || !this.sameDestination())
        throw new Error("AUDIO_CAPTURE_CANCELLED");
      this.id = grant.begin(contents.mainFrame);
      await contents.executeJavaScript(
        `window.captureLocalAcquire(${JSON.stringify(this.id)})`,
        true
      );
      if (this.disposed || !this.sameDestination())
        throw new Error("AUDIO_CAPTURE_CANCELLED");
      grant.ready(this.id);
      this.acquiring = false;
      return this.id;
    } catch (error) {
      this.dispose();
      const code =
        error instanceof Error
          ? [...CAPTURE_ERRORS].find(
              (code) =>
                error.message === code ||
                error.message.endsWith(`Error: ${code}`)
            )
          : undefined;
      throw new Error(code ?? "AUDIO_CAPTURE_FAILED");
    }
  }
  async start(id: string) {
    if (id !== this.id || this.disposed || this.acquiring || !this.host)
      throw new Error("CAPTURE_NOT_READY");
    await this.host.webContents.executeJavaScript(
      "window.captureLocalStart()",
      false
    );
  }
  ack(id: string, sequence: number) {
    if (
      id !== this.id ||
      sequence !== this.pending ||
      !this.host ||
      this.disposed
    )
      return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.host.webContents.send(LOCAL_ACK, sequence);
  }
  async stop(id: string) {
    if (id !== this.id || !this.host || this.disposed) return;
    try {
      await this.host.webContents.executeJavaScript(
        "window.captureLocalStop()",
        false
      );
    } finally {
      this.dispose();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    if (this.statesTimer) clearTimeout(this.statesTimer);
    this.statesTimer = null;
    this.queuedStates = null;
    ipcMain.removeListener(CAPTURE_PACKET, this.packet);
    this.grant?.revoke();
    this.grant = null;
    const host = this.host;
    this.host = null;
    if (host && !host.isDestroyed()) host.destroy();
    this.onDisposed();
  }
}
