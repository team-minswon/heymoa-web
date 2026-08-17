export type PendingChunk = {
  chunkSeq: number;
  captureSamples: number;
  body: ArrayBuffer;
};

/**
 * 서버가 아직 내구 저장했다고 말하지 않은 조각을 들고 있다가 재연결하면 다시 보낸다.
 *
 * 소켓의 백프레셔(`bufferedAmount`)와 다른 것이다. 그쪽은 OS 소켓 버퍼가 밀렸는지를 보고,
 * 여기는 **서버가 S3에 썼는지**를 본다. 소켓을 떠난 조각도 서버가 쓰기 전에 죽으면 사라진다.
 *
 * 상한을 넘으면 오래된 것부터 버린다. 버린 구간은 `chunkSeq`에 구멍으로 남아 서버가
 * `UPLOAD` 공백으로 유도한다 — 조용히 이어 붙이지 않는 것이 설계다.
 */
export class ResendBuffer {
  private chunks: PendingChunk[] = [];
  private bufferedBytes = 0;
  private dropped: number[] = [];
  /** 여기까지는 소켓에 건넸다. 아직 ACK는 아니다. */
  private sentCount = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: PendingChunk) {
    this.chunks.push(chunk);
    this.bufferedBytes += chunk.body.byteLength;
    while (this.bufferedBytes > this.maxBytes && this.chunks.length > 0) {
      const evicted = this.chunks.shift()!;
      this.bufferedBytes -= evicted.body.byteLength;
      this.dropped.push(evicted.chunkSeq);
      if (this.sentCount > 0) this.sentCount -= 1;
    }
  }

  /** `throughChunkSeq`까지 내구 저장됐다. 누적값이라 늦게 온 옛 ACK는 아무것도 안 한다. */
  ackThrough(throughChunkSeq: number) {
    while (
      this.chunks.length > 0 &&
      this.chunks[0].chunkSeq <= throughChunkSeq
    ) {
      const acked = this.chunks.shift()!;
      this.bufferedBytes -= acked.body.byteLength;
      if (this.sentCount > 0) this.sentCount -= 1;
    }
  }

  /**
   * 아직 소켓에 못 건넨 것들. **순서대로** 보내야 하므로 앞에서부터 꺼낸다.
   * 소켓이 백프레셔로 거절하면 여기 남아 있다가 다음에 다시 시도된다.
   */
  unsent(): PendingChunk[] {
    return this.chunks.slice(this.sentCount);
  }

  markSent() {
    if (this.sentCount < this.chunks.length) this.sentCount += 1;
  }

  /**
   * 소켓이 새로 붙었다. 건넸지만 ACK 못 받은 것부터 다시 보낸다.
   * **번호를 다시 매기지 않는다** — 좌표는 `captureSamples`가 이미 들고 있다.
   */
  rewind() {
    this.sentCount = 0;
  }

  /** ACK 안 온 전부. */
  pending(): PendingChunk[] {
    return [...this.chunks];
  }

  get bytes() {
    return this.bufferedBytes;
  }

  /** 상한 때문에 버린 조각 번호. 서버가 이 구멍을 UPLOAD 공백으로 읽는다. */
  get droppedChunkSeqs(): number[] {
    return [...this.dropped];
  }

  reset() {
    this.chunks = [];
    this.bufferedBytes = 0;
    this.dropped = [];
    this.sentCount = 0;
  }
}
