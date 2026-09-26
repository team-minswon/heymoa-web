import type { AudioStore, StoredChunk } from "@/lib/transcription/audio-store";

export type PendingChunk = {
  chunkSeq: number;
  captureSamples: number;
  body: ArrayBuffer;
};

type Entry = {
  chunkSeq: number;
  captureSamples: number;
  bytes: number;
  /** null 이면 디스크에만 있다. 보낼 때 읽어 온다. */
  body: ArrayBuffer | null;
  stored: boolean;
};

/** 디스크에서 한 번에 읽는 양. 60분치를 한꺼번에 올리지 않는다. */
const LOAD_BATCH_BYTES = 1_048_576;
/** 한도에서 멈춘 뒤 이만큼 빠져야 다시 받는다. 한도 언저리에서 조각마다 멈췄다 풀렸다 하지 않게. */
const RESUME_RATIO = 0.9;

export type ResendBufferOptions = {
  memoryLimitBytes: number;
  diskLimitBytes: number;
  store: AudioStore | null;
  noteId: string;
  sessionId: string;
  /** 디스크에서 본문이 왔거나 디스크 쓰기가 막혔다. 다시 보내 보고 상태를 다시 알릴 때다. */
  onChange: () => void;
};

/**
 * 서버가 내구 저장했다고 말하지 않은 조각을 들고 있다가 다시 붙으면 다시 보낸다.
 *
 * 소켓의 백프레셔(`bufferedAmount`)와 다른 것이다. 그쪽은 OS 소켓 버퍼가 밀렸는지를 보고,
 * 여기는 **서버가 S3에 썼는지**를 본다.
 *
 * - 모든 조각을 디스크(IndexedDB)에 써 두고 ACK 가 오면 지운다. 탭이 닫혀도 남는다.
 * - 본문은 최근 `memoryLimitBytes` 만 메모리에 둔다. 그보다 오래된 것은 디스크에서 읽어 보낸다.
 * - 한도(디스크를 못 쓰면 메모리 한도)에 닿으면 **버리지 않고 더 받지 않는다**. 호출자가 캡처를 멈춘다.
 * - 보내는 순서: 마지막 `rewind` 뒤에 들어온 조각(실시간)이 먼저, 그 전 것(밀린 것)은 남는 자리로.
 *   각 줄 안에서는 번호 순서다. 번호와 `captureSamples` 는 들어온 그대로다.
 */
export class ResendBuffer {
  private entries: Entry[] = [];
  private totalBytes = 0;
  private sentBytes = 0;
  /** [0, liveFrom) 은 밀린 것, [liveFrom, 끝) 은 실시간. 둘 다 앞에서부터 보낸다. */
  private liveFrom = 0;
  private backlogCursor = 0;
  private liveCursor = 0;
  /** [hotFrom, 끝) 은 본문을 메모리에 둔다. */
  private hotFrom = 0;
  private hotBytes = 0;
  private picked: "live" | "backlog" | null = null;
  private loading = false;
  private writable: boolean;
  private full = false;

  constructor(private readonly options: ResendBufferOptions) {
    this.writable = options.store !== null;
  }

  get bytes() {
    return this.totalBytes;
  }

  get unsentBytes() {
    return this.totalBytes - this.sentBytes;
  }

  /** 아직 들고 있는 가장 앞 번호. 비었으면 null. */
  get firstSeq(): number | null {
    return this.entries[0]?.chunkSeq ?? null;
  }

  get persistent() {
    return this.writable;
  }

  get limitBytes() {
    return this.writable
      ? this.options.diskLimitBytes
      : this.options.memoryLimitBytes;
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
    const entry: Entry = { ...chunk, bytes, stored: false };
    this.entries.push(entry);
    this.totalBytes += bytes;
    this.hotBytes += bytes;
    this.coolDown();
    if (this.writable) this.persist(entry);
    return true;
  }

  /** `throughChunkSeq`까지 내구 저장됐다. 누적값이라 늦게 온 옛 ACK는 아무것도 안 한다. */
  ackThrough(throughChunkSeq: number) {
    let count = 0;
    while (
      count < this.entries.length &&
      this.entries[count].chunkSeq <= throughChunkSeq
    ) {
      const entry = this.entries[count];
      this.totalBytes -= entry.bytes;
      if (count >= this.hotFrom) this.hotBytes -= entry.bytes;
      if (this.wasSent(count)) this.sentBytes -= entry.bytes;
      count += 1;
    }
    if (count === 0) return;
    this.entries.splice(0, count);
    this.hotFrom = Math.max(0, this.hotFrom - count);
    this.liveFrom = Math.max(0, this.liveFrom - count);
    this.backlogCursor = Math.max(0, this.backlogCursor - count);
    this.liveCursor = Math.max(this.liveFrom, this.liveCursor - count);
    void this.options.store
      ?.deleteThrough(this.options.sessionId, throughChunkSeq)
      .catch(() => undefined);
  }

  /** 서버가 세션을 닫았다. 남은 것은 서버가 받을 길이 없다. */
  forget() {
    void this.options.store
      ?.deleteThrough(this.options.sessionId, Infinity)
      .catch(() => undefined);
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

  /** 다음에 보낼 것. 본문을 디스크에서 읽는 중이면 그 줄은 건너뛴다. 보냈으면 `markSent()`. */
  next(): PendingChunk | null {
    this.picked = null;
    if (this.liveCursor < this.entries.length) {
      const chunk = this.ready(this.liveCursor);
      if (chunk) {
        this.picked = "live";
        return chunk;
      }
    }
    if (this.backlogCursor < this.liveFrom) {
      const chunk = this.ready(this.backlogCursor);
      if (chunk) {
        this.picked = "backlog";
        return chunk;
      }
    }
    return null;
  }

  markSent() {
    const index =
      this.picked === "live" ? this.liveCursor++ : this.backlogCursor++;
    this.picked = null;
    const entry = this.entries[index];
    this.sentBytes += entry.bytes;
    if (index < this.hotFrom && entry.stored) entry.body = null;
  }

  /** 지난 탭이 디스크에 남긴 조각으로 채운다. 본문은 보낼 때 읽는다. */
  restore(chunks: StoredChunk[]) {
    this.entries = chunks.map((chunk) => ({
      chunkSeq: chunk.chunkSeq,
      captureSamples: chunk.captureSamples,
      bytes: chunk.bytes,
      body: null,
      stored: true,
    }));
    this.totalBytes = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
    this.hotFrom = this.entries.length;
    this.rewind();
  }

  private wasSent(index: number) {
    return index < this.liveFrom
      ? index < this.backlogCursor
      : index < this.liveCursor;
  }

  /** 메모리 창을 넘은 오래된 조각은 디스크에 써진 것만 본문을 놓는다. */
  private coolDown() {
    while (
      this.hotBytes > this.options.memoryLimitBytes &&
      this.hotFrom < this.entries.length - 1
    ) {
      const entry = this.entries[this.hotFrom];
      this.hotBytes -= entry.bytes;
      this.hotFrom += 1;
      if (entry.stored) entry.body = null;
    }
  }

  private persist(entry: Entry) {
    const { noteId, sessionId, store } = this.options;
    store!
      .put(
        {
          noteId,
          sessionId,
          chunkSeq: entry.chunkSeq,
          captureSamples: entry.captureSamples,
          bytes: entry.bytes,
        },
        entry.body!
      )
      .then(
        () => {
          entry.stored = true;
          const hotStart = this.entries[this.hotFrom]?.chunkSeq ?? Infinity;
          if (entry.chunkSeq < hotStart) entry.body = null;
        },
        () => {
          if (!this.writable) return;
          this.writable = false;
          this.options.onChange();
        }
      );
  }

  private ready(index: number): PendingChunk | null {
    const entry = this.entries[index];
    if (entry.body) {
      return {
        chunkSeq: entry.chunkSeq,
        captureSamples: entry.captureSamples,
        body: entry.body,
      };
    }
    this.load(index);
    return null;
  }

  private load(index: number) {
    const store = this.options.store;
    if (this.loading || !store) return;
    const batch: Entry[] = [];
    let bytes = 0;
    for (
      let i = index;
      i < this.entries.length &&
      !this.entries[i].body &&
      bytes < LOAD_BATCH_BYTES;
      i += 1
    ) {
      batch.push(this.entries[i]);
      bytes += this.entries[i].bytes;
    }
    this.loading = true;
    store
      .bodies(
        this.options.sessionId,
        batch[0].chunkSeq,
        batch[batch.length - 1].chunkSeq
      )
      .then(
        (bodies) => {
          for (const entry of batch)
            entry.body ??= bodies.get(entry.chunkSeq) ?? null;
          this.loading = false;
          this.options.onChange();
        },
        // 다음 펌프에서 다시 읽는다
        () => {
          this.loading = false;
        }
      );
  }
}
