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

/**
 * 서버가 내구 저장했다고 말하지 않은 조각을 메모리에 들고 있다가 다시 붙으면 다시 보낸다.
 *
 * 소켓의 백프레셔(`bufferedAmount`)와 다른 것이다. 그쪽은 OS 소켓 버퍼가 밀렸는지를 보고,
 * 여기는 **서버가 S3에 썼는지**를 본다.
 *
 * - 한도에 닿으면 **버리지 않고 더 받지 않는다**. 호출자가 캡처를 멈춘다.
 * - 보내는 순서: 마지막 `rewind` 뒤에 들어온 조각(실시간)이 먼저, 그 전 것(밀린 것)은 남는 자리로.
 *   각 줄 안에서는 번호 순서다. 번호와 `captureSamples` 는 들어온 그대로다.
 */
export class ResendBuffer {
  private entries: PendingChunk[] = [];
  private totalBytes = 0;
  private sentBytes = 0;
  /** [0, liveFrom) 은 밀린 것, [liveFrom, 끝) 은 실시간. 둘 다 앞에서부터 보낸다. */
  private liveFrom = 0;
  private backlogCursor = 0;
  private liveCursor = 0;
  private picked: "live" | "backlog" | null = null;
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
    return this.entries[0]?.chunkSeq ?? null;
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
    this.entries.push(chunk);
    this.totalBytes += bytes;
    return true;
  }

  /** `throughChunkSeq`까지 내구 저장됐다. 누적값이라 늦게 온 옛 ACK는 아무것도 안 한다. */
  ackThrough(throughChunkSeq: number) {
    let count = 0;
    while (
      count < this.entries.length &&
      this.entries[count].chunkSeq <= throughChunkSeq
    ) {
      const bytes = this.entries[count].body.byteLength;
      this.totalBytes -= bytes;
      if (this.wasSent(count)) this.sentBytes -= bytes;
      count += 1;
    }
    if (count === 0) return;
    this.entries.splice(0, count);
    this.liveFrom = Math.max(0, this.liveFrom - count);
    this.backlogCursor = Math.max(0, this.backlogCursor - count);
    this.liveCursor = Math.max(this.liveFrom, this.liveCursor - count);
  }

  /**
   * 소켓이 새로 붙었다. ACK 못 받은 것 전부가 밀린 것이 되고, 이제부터 들어오는 것이 실시간이다.
   * **번호를 다시 매기지 않는다** — 좌표는 `captureSamples`가 이미 들고 있다.
   */
  rewind() {
    this.sentBytes = 0;
    this.backlogCursor = 0;
    this.liveFrom = this.entries.length;
    this.liveCursor = this.liveFrom;
  }

  /** 다음에 보낼 것. 보냈으면 `markSent()`. */
  next(): PendingChunk | null {
    this.picked = null;
    if (this.liveCursor < this.entries.length) {
      this.picked = "live";
      return this.entries[this.liveCursor];
    }
    if (this.backlogCursor < this.liveFrom) {
      this.picked = "backlog";
      return this.entries[this.backlogCursor];
    }
    return null;
  }

  markSent() {
    const index =
      this.picked === "live" ? this.liveCursor++ : this.backlogCursor++;
    this.picked = null;
    this.sentBytes += this.entries[index].body.byteLength;
  }

  private wasSent(index: number) {
    return index < this.liveFrom
      ? index < this.backlogCursor
      : index < this.liveCursor;
  }
}
