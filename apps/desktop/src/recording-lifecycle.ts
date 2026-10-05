import type {
  DesktopRecordingAction,
  RecordingSummary,
} from "@heymoa/desktop-contracts";

export const STOP_WAIT_NOTICE_MS = 30_000;
const ACTIVE = new Set<RecordingSummary["phase"]>([
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
]);
const LABELS: Record<RecordingSummary["phase"], string> = {
  idle: "녹음 대기",
  "requesting-permission": "권한 확인 중",
  connecting: "연결 중",
  recording: "녹음 중",
  stopping: "녹음 중지 중",
  completed: "녹음 완료",
  failed: "녹음 중단",
};
export type QuitChoice = "cancel" | "wait" | "discard";
export type QuitPrompt = "protect" | "waiting" | "discard";
export type RecordingView = {
  label: string;
  elapsed: string | null;
  pending: boolean;
  inputWarning: string | null;
  unknown: boolean;
  waiting: boolean;
};
type Dependencies = {
  now(): number;
  confirm(prompt: QuitPrompt): Promise<QuitChoice>;
  action(action: DesktopRecordingAction): void;
  quit(): void;
  changed(): void;
  notifyWaiting(): void;
  schedule(callback: () => void, ms: number): () => void;
};

/** Native state follows validated web summaries; it never marks a stop request as completion. */
export class RecordingLifecycle {
  private summary: RecordingSummary | null = null;
  // Remote media permissions are denied: before the first native request or
  // unsafe web report, an unavailable document cannot own captured audio.
  private activityObserved = false;
  private captureActive = false;
  private waiting = false;
  private disposed = false;
  private confirming = false;
  private cancelNotice: (() => void) | null = null;
  constructor(private readonly deps: Dependencies) {}

  update(summary: RecordingSummary): void {
    if (this.disposed) return;
    this.summary = { ...summary };
    if (ACTIVE.has(summary.phase) || summary.pendingMs > 0)
      this.activityObserved = true;
    this.deps.changed();
    if (this.waiting && this.safe()) this.exit();
  }
  unavailable(): void {
    if (this.disposed) return;
    this.summary = null;
    this.deps.changed();
  }
  captureRequested(): void {
    if (this.disposed) return;
    this.activityObserved = true;
    this.captureActive = true;
    this.summary = null;
    this.deps.changed();
  }
  captureDisposed(): void {
    if (this.disposed) return;
    this.captureActive = false;
    this.deps.changed();
    if (this.waiting && this.safe()) this.exit();
  }
  safe(): boolean {
    return (
      !this.captureActive &&
      (this.summary === null
        ? !this.activityObserved
        : !ACTIVE.has(this.summary.phase) && this.summary.pendingMs === 0)
    );
  }
  isRecording(): boolean {
    return this.summary?.phase === "recording";
  }
  view(): RecordingView {
    const s = this.summary;
    const neverStarted = !s && !this.activityObserved && !this.captureActive;
    const seconds =
      s?.startedAt === null || !s || !ACTIVE.has(s.phase)
        ? null
        : Math.max(0, Math.floor((this.deps.now() - s.startedAt) / 1000));
    const warnings = s
      ? [
          ["마이크", s.microphone],
          ["시스템 소리", s.systemAudio],
        ]
          .filter(([, state]) => state !== null && state !== "live")
          .map(
            ([label, state]) =>
              `${label} ${state === "muted" ? "음소거" : state === "suspended" ? "일시 중단" : "종료"}`
          )
      : [];
    return {
      label: s
        ? LABELS[s.phase]
        : neverStarted
          ? LABELS.idle
          : "녹음 상태 확인 불가",
      elapsed:
        seconds === null
          ? null
          : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
      pending: Boolean(s?.pendingMs),
      inputWarning: warnings.join(" · ") || null,
      unknown: !s && !neverStarted,
      waiting: this.waiting,
    };
  }
  action(action: DesktopRecordingAction): void {
    if (!this.disposed) this.deps.action(action);
  }
  async requestQuit(): Promise<void> {
    if (this.disposed || this.confirming) return;
    if (this.safe()) {
      this.exit();
      return;
    }
    this.confirming = true;
    try {
      const choice = await this.deps.confirm(
        this.waiting ? "waiting" : "protect"
      );
      if (this.disposed) return;
      if (choice === "cancel") {
        this.clearWait();
        this.deps.changed();
        return;
      }
      if (choice === "discard") {
        const confirmed = await this.deps.confirm("discard");
        if (!this.disposed && confirmed === "discard") this.exit();
        return;
      }
      if (this.safe()) {
        this.exit();
        return;
      }
      if (!this.waiting) {
        this.waiting = true;
        this.cancelNotice = this.deps.schedule(() => {
          this.cancelNotice = null;
          if (!this.disposed && this.waiting) this.deps.notifyWaiting();
        }, STOP_WAIT_NOTICE_MS);
        this.deps.changed();
        this.deps.action("stop");
      }
    } catch {
      // Dialog or action delivery failure cannot authorize audio loss.
      this.clearWait();
      if (!this.disposed) this.deps.changed();
    } finally {
      this.confirming = false;
    }
  }
  dispose(): void {
    this.disposed = true;
    this.clearWait();
  }
  private clearWait(): void {
    this.waiting = false;
    this.cancelNotice?.();
    this.cancelNotice = null;
  }
  private exit(): void {
    this.disposed = true;
    this.clearWait();
    this.deps.quit();
  }
}
