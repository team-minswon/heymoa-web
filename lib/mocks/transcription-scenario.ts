import { mockDb } from "@/lib/mocks/db";
import {
  parseClientCommand,
  type ClientCommand,
  type ServerEvent,
  type TranscriptionSessionStatus,
} from "@/lib/transcription/protocol";

const WORDS = [
  "안녕하세요.",
  "오늘 회의를 시작하겠습니다.",
  "첫 번째 안건을 확인하겠습니다.",
  "다음 주까지 사용자 테스트를 진행합니다.",
];

type Send = (event: ServerEvent) => void;
type Close = (code: number, reason: string) => void;

export class MockTranscriptionScenario {
  private status: TranscriptionSessionStatus = "CONNECTING";
  private itemSequence = 1;
  private audioFrameCount = 0;
  private partialText = "";
  private disposed = false;

  constructor(
    private readonly sessionId: string,
    private readonly send: Send,
    private readonly requestClose: Close = () => undefined
  ) {}

  open() {
    if (this.disposed) return;
    this.send({ type: "SESSION_READY", sessionId: this.sessionId });
    this.setStatus("STREAMING");
  }

  receive(command: ClientCommand) {
    if (this.disposed) return;

    switch (command.type) {
      case "TURN_COMMIT":
        this.commitPartial();
        break;
      case "SESSION_PAUSE":
        this.commitPartial();
        this.setStatus("PAUSED");
        break;
      case "SESSION_RESUME":
        this.setStatus("STREAMING");
        break;
      case "SESSION_COMPLETE":
        this.commitPartial();
        this.setStatus("FINALIZING");
        this.setStatus("COMPLETED");
        this.send({ type: "SESSION_COMPLETED", sessionId: this.sessionId });
        this.requestClose(1000, "completed");
        break;
      case "PING":
        this.send({ type: "PONG" });
        break;
    }
  }

  async receiveFrame(frame: string | ArrayBufferLike | ArrayBufferView | Blob) {
    if (typeof frame === "string") {
      this.receive(parseClientCommand(frame));
      return;
    }

    if (frame instanceof Blob) {
      await frame.arrayBuffer();
    }

    if (this.status !== "STREAMING" || this.disposed) return;
    this.audioFrameCount += 1;
    const wordCount = Math.min(WORDS.length, this.audioFrameCount);
    this.partialText = WORDS.slice(0, wordCount).join(" ");
    this.send({
      type: "TRANSCRIPT_PARTIAL",
      itemId: this.itemId,
      text: this.partialText,
    });
  }

  dispose() {
    this.disposed = true;
  }

  private get itemId() {
    return `provider-item-${this.itemSequence}`;
  }

  private setStatus(status: TranscriptionSessionStatus) {
    this.status = status;
    mockDb.updateSessionStatus(this.sessionId, status);
    this.send({ type: "SESSION_STATUS", status });
  }

  private commitPartial() {
    if (!this.partialText) return;
    const itemId = this.itemId;
    const segment = mockDb.addSegment(this.sessionId, {
      text: this.partialText,
      startedAtMs: (this.itemSequence - 1) * 5000,
      endedAtMs: Math.max(1200, this.audioFrameCount * 800),
    });
    this.send({ type: "TRANSCRIPT_FINAL", itemId, segment });
    this.itemSequence += 1;
    this.audioFrameCount = 0;
    this.partialText = "";
  }
}
