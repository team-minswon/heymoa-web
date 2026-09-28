let tabInstanceId: string | null = null;
const TAB_INSTANCE_KEY = "heymoa.transcription.clientInstanceId";
/**
 * 탭 수명 동안 하나. 같은 탭의 재부착과 다른 탭·기기의 부착을 서버가 가른다.
 * 새로고침한 탭의 시작 요청도 같은 값이라 서버가 옛 세션을 리스가 살아 있어도 곧바로 닫는다.
 *
 * sessionStorage 는 opener 를 가진 새 창에도 복사된다. 같은 값이면 서버가 그 창의 시작을 이 탭의
 * 재시작으로 읽어 이 탭의 녹음을 닫는다. 창 이름은 새로고침에는 남고 새 창에는 안 넘어가서, 둘이
 * 맞을 때만 이어 쓴다.
 */
export function clientInstanceId() {
  if (tabInstanceId) return tabInstanceId;
  try {
    const stored = sessionStorage.getItem(TAB_INSTANCE_KEY);
    if (stored && window.name === stored) tabInstanceId = stored;
  } catch {
    // Node 실험 틀·저장소가 막힌 창
  }
  if (tabInstanceId) return tabInstanceId;
  tabInstanceId = crypto.randomUUID();
  try {
    sessionStorage.setItem(TAB_INSTANCE_KEY, tabInstanceId);
    window.name = tabInstanceId;
  } catch {
    // 위와 같다
  }
  return tabInstanceId;
}

const RECORDING_KEY_PREFIX = "heymoa.transcription.recording:";
export const RECORDING_BEAT_MS = 2_000;
/** 숨은 탭도 타이머는 1초 단위로 돈다. 이보다 오래 박동이 없으면 그 탭은 죽었다. */
const RECORDING_BEAT_STALE_MS = 6_000;
/** 워치독이 이미 닫았을 기록. 남기면 다른 기기가 재개한 녹음을 이어받으려다 409 로 간다. */
const RECORDING_RECORD_MAX_MS = 5 * 60_000;

export type RecordingRecord = {
  noteId: string;
  clientInstanceId: string;
  beatAt: number;
};

export type RecordingClaim = "mine" | "live" | "dead";

/**
 * 이 노트의 녹음 기록을 누가 쥐고 있나. mine: 이 탭(새로고침 전), live: 박동이 살아 있는 다른 탭,
 * dead: 박동이 식은 탭. 살아 있는 다른 탭이 있으면 이 탭의 기록보다 앞선다.
 */
export function claimOf(
  records: RecordingRecord[],
  noteId: string,
  ownId: string,
  now: number
): RecordingClaim | null {
  const forNote = records.filter((record) => record.noteId === noteId);
  const others = forNote.filter((record) => record.clientInstanceId !== ownId);
  if (others.some((record) => now - record.beatAt <= RECORDING_BEAT_STALE_MS))
    return "live";
  if (forNote.length > others.length) return "mine";
  return others.length > 0 ? "dead" : null;
}

/**
 * 녹음 중인 탭의 박동. 새로고침한 탭(같은 ID)과 닫힌 탭을 새 탭으로 다시 연 경우(식은 박동) 모두
 * 서버가 그 ID 의 새 시작을 받아 옛 세션을 곧바로 닫으므로 독을 잠그면 안 된다.
 * 탭마다 키가 따로라 두 탭이 다른 노트를 녹음해도 서로 덮지 않는다.
 */
export function beatRecording(noteId: string, beatAt = Date.now()) {
  const id = clientInstanceId();
  const record: RecordingRecord = { noteId, clientInstanceId: id, beatAt };
  try {
    localStorage.setItem(RECORDING_KEY_PREFIX + id, JSON.stringify(record));
  } catch {
    // 저장소가 막힌 창은 서버 워치독이 정리할 때까지 기다린다
  }
}

/** 이 탭의 기록이 있으면 박동만 새로 적는다. */
export function touchRecording(beatAt = Date.now()) {
  const own = readRecords().find(
    (record) => record.clientInstanceId === clientInstanceId()
  );
  if (own) beatRecording(own.noteId, beatAt);
}

/** 탭이 닫힐 때. 지우면 새 탭이 이어받을 ID 를 잃는다. */
export function expireRecording() {
  touchRecording(Date.now() - RECORDING_BEAT_STALE_MS - 1);
}

export function forgetRecording() {
  removeRecord(clientInstanceId());
}

export function forgetNoteRecordings(noteId: string) {
  for (const record of readRecords()) {
    if (record.noteId === noteId) removeRecord(record.clientInstanceId);
  }
}

export function recordingClaimOf(noteId: string, now = Date.now()) {
  return claimOf(readRecords(now), noteId, clientInstanceId(), now);
}

/**
 * 박동이 식은 탭의 ID 를 이 탭의 것으로 삼는다. 시작과 이후 재부착이 모두 그 ID 로 나가야 서버가
 * 같은 탭으로 본다. 창 이름도 같이 바꿔 새로고침에는 이어지고 새 창에는 안 넘어간다.
 */
export function adoptDeadRecorder(noteId: string, now = Date.now()) {
  if (recordingClaimOf(noteId, now) !== "dead") return null;
  const dead = readRecords(now)
    .filter((record) => record.noteId === noteId)
    .sort((left, right) => right.beatAt - left.beatAt)[0];
  tabInstanceId = dead.clientInstanceId;
  try {
    sessionStorage.setItem(TAB_INSTANCE_KEY, tabInstanceId);
    window.name = tabInstanceId;
  } catch {
    // 이 탭 수명 동안은 메모리 값으로 이어 간다
  }
  return { clientInstanceId: tabInstanceId, beatAgeMs: now - dead.beatAt };
}

function readRecords(now = Date.now()): RecordingRecord[] {
  const records: RecordingRecord[] = [];
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(RECORDING_KEY_PREFIX)) continue;
      const record = parseRecord(localStorage.getItem(key));
      if (!record || now - record.beatAt > RECORDING_RECORD_MAX_MS) {
        localStorage.removeItem(key);
        continue;
      }
      records.push(record);
    }
  } catch {
    return [];
  }
  return records;
}

function parseRecord(raw: string | null): RecordingRecord | null {
  try {
    const value = JSON.parse(raw ?? "") as Partial<RecordingRecord>;
    return typeof value.noteId === "string" &&
      typeof value.clientInstanceId === "string" &&
      typeof value.beatAt === "number"
      ? (value as RecordingRecord)
      : null;
  } catch {
    return null;
  }
}

function removeRecord(id: string) {
  try {
    localStorage.removeItem(RECORDING_KEY_PREFIX + id);
  } catch {
    // 위와 같다
  }
}
