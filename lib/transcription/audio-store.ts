/** 서버가 확정하지 않은 조각 하나. 본문은 따로 읽는다 — 목록만으로 60분치를 메모리에 올리지 않는다. */
export type StoredChunk = {
  noteId: string;
  sessionId: string;
  chunkSeq: number;
  captureSamples: number;
  bytes: number;
};

/**
 * 탭이 닫혀도 남는 조각 저장소. 녹음 중에는 모든 조각을 써 두고 ACK 가 오면 지운다.
 * 쓰기가 실패하면(사생활 보호 창, 쿼터) 버퍼가 메모리만으로 물러난다.
 */
export type AudioStore = {
  put(chunk: StoredChunk, body: ArrayBuffer): Promise<void>;
  bodies(
    sessionId: string,
    fromSeq: number,
    toSeq: number
  ): Promise<Map<number, ArrayBuffer>>;
  deleteThrough(sessionId: string, chunkSeq: number): Promise<void>;
  list(): Promise<StoredChunk[]>;
};

export type StoredRecording = {
  noteId: string;
  sessionId: string;
  chunks: StoredChunk[];
};

const DATABASE = "heymoa-transcription";
const CHUNKS = "chunks";

/**
 * 키 하나에 목록이 쓰는 값을 다 싣는다: `[sessionId, chunkSeq, captureSamples, bytes, noteId]`.
 * 그래서 `getAllKeys` 만으로 본문 없이 목록을 만들고, `[sessionId, seq]` 앞부분으로 범위를 건다.
 */
type ChunkKey = [string, number, number, number, string];

const toKey = (chunk: StoredChunk): ChunkKey => [
  chunk.sessionId,
  chunk.chunkSeq,
  chunk.captureSamples,
  chunk.bytes,
  chunk.noteId,
];

const fromKey = ([
  sessionId,
  chunkSeq,
  captureSamples,
  bytes,
  noteId,
]: ChunkKey) => ({
  noteId,
  sessionId,
  chunkSeq,
  captureSamples,
  bytes,
});

/** 배열 키는 짧은 쪽이 앞이라 `[sid, to, Infinity]` 가 `[sid, to, …]` 전부를 덮는다. */
const seqRange = (sessionId: string, fromSeq: number, toSeq: number) =>
  IDBKeyRange.bound([sessionId, fromSeq], [sessionId, toSeq, Infinity]);

let shared: AudioStore | null | undefined;

/** IndexedDB 가 없으면(Node 실험 틀, 일부 사생활 보호 창) null. 한 페이지에 연결 하나를 나눠 쓴다. */
export function openAudioStore(): AudioStore | null {
  if (shared !== undefined) return shared;
  if (typeof indexedDB === "undefined") return (shared = null);

  const database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(CHUNKS);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // 열기 실패는 첫 쓰기가 거절로 받아 메모리로 물러난다. 그 전에 unhandled 로 새지 않게
  database.catch(() => undefined);

  function run<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest | IDBRequest[] | void
  ) {
    return database.then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(CHUNKS, mode);
          const request = operation(transaction.objectStore(CHUNKS));
          transaction.oncomplete = () =>
            resolve(
              (Array.isArray(request)
                ? request.map((r) => r.result)
                : request?.result) as T
            );
          transaction.onerror = transaction.onabort = () =>
            reject(transaction.error);
        })
    );
  }

  shared = {
    put: (chunk, body) =>
      run<void>("readwrite", (store) => {
        store.put(body, toKey(chunk));
      }),
    bodies: (sessionId, fromSeq, toSeq) =>
      run<[ChunkKey[], ArrayBuffer[]]>("readonly", (store) => {
        const range = seqRange(sessionId, fromSeq, toSeq);
        return [store.getAllKeys(range), store.getAll(range)];
      }).then(
        ([keys, values]) =>
          new Map(keys.map((key, i) => [key[1], values[i]] as const))
      ),
    deleteThrough: (sessionId, chunkSeq) =>
      run<void>("readwrite", (store) => {
        store.delete(seqRange(sessionId, -Infinity, chunkSeq));
      }),
    list: () =>
      run<ChunkKey[]>("readonly", (store) => store.getAllKeys()).then((keys) =>
        keys.map(fromKey)
      ),
  };
  return shared;
}

/** 지난 탭이 못 올리고 남긴 녹음들. 세션마다 번호 순서다. */
export async function findStoredRecordings(
  store: AudioStore | null = openAudioStore()
): Promise<StoredRecording[]> {
  if (!store) return [];
  const recordings = new Map<string, StoredRecording>();
  for (const chunk of await store.list().catch(() => [])) {
    const recording = recordings.get(chunk.sessionId) ?? {
      noteId: chunk.noteId,
      sessionId: chunk.sessionId,
      chunks: [],
    };
    recording.chunks.push(chunk);
    recordings.set(chunk.sessionId, recording);
  }
  return [...recordings.values()];
}
