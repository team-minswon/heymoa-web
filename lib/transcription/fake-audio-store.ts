import type { AudioStore, StoredChunk } from "@/lib/transcription/audio-store";

/**
 * 테스트용 `AudioStore`. IndexedDB 의 성질 중 버퍼가 기대는 것을 흉내 낸다.
 * - 결과는 다음 태스크(setTimeout 0)에 온다. 같은 틱 안에서는 아무것도 저장돼 있지 않다.
 * - 부른 순서대로 하나씩 끝난다(같은 store 의 readwrite 트랜잭션처럼).
 * - put 은 부르는 순간 본문을 복사한다(structured clone). 읽기도 복사본을 준다.
 * - 쿼터를 넘기면 `QuotaExceededError` DOMException 으로 거절한다.
 */
export class FakeAudioStore implements AudioStore {
  private readonly records = new Map<
    string,
    { chunk: StoredChunk; body: ArrayBuffer }
  >();
  private usedBytes = 0;
  reads = 0;

  constructor(private readonly options: { quotaBytes?: number } = {}) {}

  get size() {
    return this.records.size;
  }

  put(chunk: StoredChunk, body: ArrayBuffer) {
    const copy = body.slice(0);
    return this.run(() => {
      if (
        this.usedBytes + copy.byteLength >
        (this.options.quotaBytes ?? Infinity)
      ) {
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError"
        );
      }
      this.records.set(key(chunk.sessionId, chunk.chunkSeq), {
        chunk,
        body: copy,
      });
      this.usedBytes += copy.byteLength;
    });
  }

  bodies(sessionId: string, fromSeq: number, toSeq: number) {
    return this.run(() => {
      this.reads += 1;
      const found = new Map<number, ArrayBuffer>();
      for (const { chunk, body } of this.records.values()) {
        if (
          chunk.sessionId === sessionId &&
          chunk.chunkSeq >= fromSeq &&
          chunk.chunkSeq <= toSeq
        ) {
          found.set(chunk.chunkSeq, body.slice(0));
        }
      }
      return found;
    });
  }

  deleteThrough(sessionId: string, chunkSeq: number) {
    return this.run(() => {
      for (const [id, { chunk, body }] of this.records) {
        if (chunk.sessionId === sessionId && chunk.chunkSeq <= chunkSeq) {
          this.records.delete(id);
          this.usedBytes -= body.byteLength;
        }
      }
    });
  }

  list() {
    return this.run(() =>
      [...this.records.values()]
        .map(({ chunk }) => chunk)
        .sort((a, b) =>
          a.sessionId === b.sessionId
            ? a.chunkSeq - b.chunkSeq
            : a.sessionId.localeCompare(b.sessionId)
        )
    );
  }

  /** 부른 순간 줄을 선다. 같은 지연의 타이머는 선 순서대로 돈다. */
  private run<T>(operation: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(operation());
        } catch (error) {
          reject(error);
        }
      }, 0)
    );
  }
}

const key = (sessionId: string, chunkSeq: number) => `${sessionId}:${chunkSeq}`;
