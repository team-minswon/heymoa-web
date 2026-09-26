import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
} from "@/lib/transcription/capture-config";

export type PendingChunk = {
  chunkSeq: number;
  captureSamples: number;
  body: ArrayBuffer;
};

/** 한도에서 멈춘 뒤 이만큼 빠져야 다시 받는다. 한도 언저리에서 조각마다 멈췄다 풀렸다 하지 않게. */
const RESUME_RATIO = 0.9;

export type ResendBufferOptions = {
  limitBytes: number;
};

/** 다시 붙거나 정체가 풀릴 때 실시간으로 보내는 가장 새 구간(D-09). 그 앞은 늦은 조각이라 server 가 S3 에만 쓴다. */
const LIVE_WINDOW_SAMPLES =
  (CAPTURE_TUNING.liveWindowMs * CAPTURE_CONTRACT.sampleRate) / 1000;

export type CatchUp = {
  /** 이번에 실시간에서 밀린 줄로 넘긴 조각 수. */
  lateChunks: number;
  /** 가장 새 캡처 끝에서 실시간 줄의 다음 조각까지. */
  liveLagMs: number;
};

type Entry = { chunk: PendingChunk; sent: boolean };

const endSamples = ({ captureSamples, body }: PendingChunk) =>
  captureSamples + body.byteLength / CAPTURE_CONTRACT.bytesPerSample;

/**
 * 서버가 내구 저장했다고 말하지 않은 조각을 메모리에 들고 있다가 다시 붙으면 다시 보낸다.
 *
 * 소켓의 백프레셔(`bufferedAmount`)와 다른 것이다. 그쪽은 OS 소켓 버퍼가 밀렸는지를 보고,
 * 여기는 **서버가 S3에 썼는지**를 본다.
 *
 * - 한도에 닿으면 **버리지 않고 더 받지 않는다**. 호출자가 캡처를 멈춘다.
 * - 보내는 순서: 실시간 줄이 먼저, 밀린 줄은 남는 자리로. 각 줄 안에서는 번호 순서다.
 *   server 는 받은 최대보다 앞 번호를 업체에 안 보내므로 실시간 줄이 가장 새 3초보다 뒤처지지 않게 한다.
 *   번호와 `captureSamples` 는 들어온 그대로다.
 */
export class ResendBuffer {
  private entries: Entry[] = [];
  private totalBytes = 0;
  private sentBytes = 0;
  /** [0, liveFrom) 은 밀린 줄, [liveFrom, 끝) 은 실시간 줄. */
  private liveFrom = 0;
  /** 각 줄에서 이 앞은 다 보냈다. 찾기를 줄이는 힌트다. */
  private backlogCursor = 0;
  private liveCursor = 0;
  private picked: number | null = null;
  private full = false;

  constructor(private readonly options: ResendBufferOptions) {}

  get bytes() {
    return this.totalBytes;
  }

  get unsentBytes() {
    return this.totalBytes - this.sentBytes;
  }

  /** ACK 못 받은 조각 수. */
  get count() {
    return this.entries.length;
  }

  /** 아직 들고 있는 가장 앞 번호. 비었으면 null. */
  get firstSeq(): number | null {
    return this.entries[0]?.chunk.chunkSeq ?? null;
  }

  get limitBytes() {
    return this.options.limitBytes;
  }

  /** 한도에 닿아 더 받지 않고 있다. */
  get paused() {
    return this.full;
  }

  /** 받지 못했으면 false. 번호를 쓰지 않았으니 호출자는 번호를 올리지 않는다. */
  push(chunk: PendingChunk): boolean {
    const bytes = chunk.body.byteLength;
    const room = this.full ? this.limitBytes * RESUME_RATIO : this.limitBytes;
    if (this.totalBytes + bytes > room) {
      this.full = true;
      return false;
    }
    this.full = false;
    this.entries.push({ chunk, sent: false });
    this.totalBytes += bytes;
    return true;
  }

  /** `throughChunkSeq`까지 내구 저장됐다. 누적값이라 늦게 온 옛 ACK는 아무것도 안 한다. */
  ackThrough(throughChunkSeq: number) {
    let count = 0;
    while (
      count < this.entries.length &&
      this.entries[count].chunk.chunkSeq <= throughChunkSeq
    ) {
      const { chunk, sent } = this.entries[count];
      this.totalBytes -= chunk.body.byteLength;
      if (sent) this.sentBytes -= chunk.body.byteLength;
      count += 1;
    }
    if (count === 0) return;
    this.entries.splice(0, count);
    this.liveFrom = Math.max(0, this.liveFrom - count);
    this.backlogCursor = Math.max(0, this.backlogCursor - count);
    this.liveCursor = Math.max(this.liveFrom, this.liveCursor - count);
  }

  /**
   * 소켓이 새로 붙었다. ACK 못 받은 것 전부를 다시 보낸다 — 가장 새 3초가 실시간, 그 앞이 밀린 것이다.
   * **번호를 다시 매기지 않는다** — 좌표는 `captureSamples`가 이미 들고 있다.
   */
  rewind(): CatchUp {
    for (const entry of this.entries) entry.sent = false;
    this.sentBytes = 0;
    this.backlogCursor = 0;
    this.liveFrom = 0;
    this.liveCursor = 0;
    return this.catchUp();
  }

  /** 안 보낸 실시간 조각 중 가장 새 3초보다 앞선 것을 밀린 줄로 넘긴다. 보낸 것은 그대로 둔다. */
  catchUp(): CatchUp {
    const newest = this.entries.at(-1);
    if (!newest) return { lateChunks: 0, liveLagMs: 0 };
    const liveStart = endSamples(newest.chunk) - LIVE_WINDOW_SAMPLES;
    let lateChunks = 0;
    let index = this.liveFrom;
    while (
      index < this.entries.length - 1 &&
      this.entries[index].chunk.captureSamples < liveStart
    ) {
      if (!this.entries[index].sent) lateChunks += 1;
      index += 1;
    }
    this.liveFrom = index;
    this.liveCursor = Math.max(this.liveCursor, index);
    const next = this.firstUnsent(this.liveCursor, this.entries.length);
    const liveLagMs =
      next === null
        ? 0
        : ((endSamples(newest.chunk) -
            this.entries[next].chunk.captureSamples) *
            1000) /
          CAPTURE_CONTRACT.sampleRate;
    return { lateChunks, liveLagMs };
  }

  /** 다음에 보낼 것. 보냈으면 `markSent()`. */
  next(): PendingChunk | null {
    this.liveCursor = this.skipSent(this.liveCursor, this.entries.length);
    this.backlogCursor = this.skipSent(this.backlogCursor, this.liveFrom);
    this.picked =
      this.liveCursor < this.entries.length
        ? this.liveCursor
        : this.backlogCursor < this.liveFrom
          ? this.backlogCursor
          : null;
    return this.picked === null ? null : this.entries[this.picked].chunk;
  }

  markSent() {
    const entry = this.entries[this.picked!];
    this.picked = null;
    entry.sent = true;
    this.sentBytes += entry.chunk.body.byteLength;
  }

  private skipSent(from: number, to: number) {
    let index = from;
    while (index < to && this.entries[index].sent) index += 1;
    return index;
  }

  private firstUnsent(from: number, to: number) {
    const index = this.skipSent(from, to);
    return index < to ? index : null;
  }
}
