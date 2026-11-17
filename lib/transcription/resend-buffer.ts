import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
} from "@/lib/transcription/capture-config";

export type PendingChunk = {
  chunkSeq: number;
  captureSamples: number;
  body: ArrayBuffer;
};

const RESUME_RATIO = 0.9;

export type ResendBufferOptions = {
  limitBytes: number;
};

const LIVE_WINDOW_SAMPLES =
  (CAPTURE_TUNING.liveWindowMs * CAPTURE_CONTRACT.sampleRate) / 1000;

export type CatchUp = {
  lateChunks: number;
  liveLagMs: number;
};

type Entry = { chunk: PendingChunk; sent: boolean };

const endSamples = ({ captureSamples, body }: PendingChunk) =>
  captureSamples + body.byteLength / CAPTURE_CONTRACT.bytesPerSample;

export class ResendBuffer {
  private entries: Entry[] = [];
  private totalBytes = 0;
  private sentBytes = 0;
  private liveFrom = 0;
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

  get count() {
    return this.entries.length;
  }

  get firstSeq(): number | null {
    return this.entries[0]?.chunk.chunkSeq ?? null;
  }

  get limitBytes() {
    return this.options.limitBytes;
  }

  get paused() {
    return this.full;
  }

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

  rewind(): CatchUp {
    for (const entry of this.entries) entry.sent = false;
    this.sentBytes = 0;
    this.backlogCursor = 0;
    this.liveFrom = 0;
    this.liveCursor = 0;
    return this.catchUp();
  }

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
