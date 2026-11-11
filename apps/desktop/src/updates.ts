import type { AppUpdater } from "electron-updater";
import type { DesktopUpdateState } from "@heymoa/desktop-contracts";

type Updater = Pick<
  AppUpdater,
  | "on"
  | "autoDownload"
  | "autoInstallOnAppQuit"
  | "autoRunAppAfterInstall"
  | "allowPrerelease"
  | "allowDowngrade"
  | "checkForUpdates"
  | "quitAndInstall"
  | "downloadUpdate"
>;
type Options = {
  currentVersion: string;
  available: boolean;
  automatic: boolean;
  safe(): boolean;
  prepareInstall(): boolean;
  cancelInstall(): void;
  saveAutomatic(enabled: boolean): Promise<void>;
  changed(state: DesktopUpdateState): void;
};

/** The updater never installs on its own: every installation passes the native audio guard. */
export class DesktopUpdates {
  private status: DesktopUpdateState["status"];
  private version?: string;
  private percent?: number;
  private checking: Promise<void> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private updater: Updater,
    private options: Options
  ) {
    this.status = options.available ? "idle" : "unavailable";
    updater.autoDownload = options.automatic;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on("checking-for-update", () => this.change("checking"));
    updater.on("update-not-available", () => {
      this.version = undefined;
      this.percent = undefined;
      this.change("current");
    });
    updater.on("update-available", (info) => {
      this.version = info.version;
      this.percent = 0;
      this.change(updater.autoDownload ? "downloading" : "available");
    });
    updater.on("download-progress", (progress) => {
      this.percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
      this.publish();
    });
    updater.on("update-downloaded", (info) => {
      this.version = info.version;
      this.percent = 100;
      this.change("ready");
    });
    updater.on("error", () => this.failed());
  }
  state(): DesktopUpdateState {
    return {
      currentVersion: this.options.currentVersion,
      automatic: this.options.automatic,
      status: this.status,
      version: this.version,
      percent: this.percent,
      canRestart: this.status === "ready" && this.options.safe(),
    };
  }
  publish() {
    this.options.changed(this.state());
  }
  private failed() {
    if (this.status === "installing") this.options.cancelInstall();
    this.change("error");
  }
  private change(status: DesktopUpdateState["status"]) {
    this.status = status;
    this.publish();
  }
  start() {
    if (!this.options.available) return;
    void this.check(this.options.automatic);
    this.timer = setInterval(
      () => {
        void this.check(this.options.automatic);
      },
      4 * 60 * 60 * 1000
    );
    this.timer.unref();
  }
  async check(download = true): Promise<DesktopUpdateState> {
    if (
      !this.options.available ||
      ["ready", "installing", "downloading"].includes(this.status)
    )
      return this.state();
    this.checking ??= this.runCheck(download).finally(() => {
      this.checking = null;
    });
    await this.checking;
    if (download && this.status === "available") return this.check(true);
    return this.state();
  }
  private async runCheck(download: boolean) {
    try {
      if (this.status === "available" && download) {
        this.change("downloading");
        await this.updater.downloadUpdate();
        return;
      }
      this.updater.autoDownload = download;
      const result = await this.updater.checkForUpdates();
      // Await the automatic download too, so repeated checks cannot start parallel downloads.
      await result?.downloadPromise;
    } catch {
      this.change("error");
    }
  }
  async setAutomatic(enabled: boolean) {
    const save = this.saving
      .catch(() => {})
      .then(async () => {
        await this.options.saveAutomatic(enabled);
        this.options.automatic = enabled;
        this.publish();
        if (enabled) void this.check();
      });
    this.saving = save;
    await save;
    return this.state();
  }
  restart(): DesktopUpdateState {
    return this.install(true);
  }
  private install(relaunch: boolean): DesktopUpdateState {
    if (this.status !== "ready" || !this.options.prepareInstall())
      return this.state();
    this.change("installing");
    try {
      this.updater.autoRunAppAfterInstall = relaunch;
      this.updater.quitAndInstall(true, relaunch);
    } catch {
      this.failed();
    }
    return this.state();
  }
  onQuit(): boolean {
    if (!this.options.automatic || this.status !== "ready") return false;
    return this.install(false).status === "installing";
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
  }
}
