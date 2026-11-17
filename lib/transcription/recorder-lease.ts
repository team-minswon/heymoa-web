let tabInstanceId: string | null = null;
const TAB_INSTANCE_KEY = "heymoa.transcription.clientInstanceId";
/** sessionStorage 는 opener 를 가진 새 창에도 복사되어 창 이름이 맞을 때만 이어 씁니다. */
export function clientInstanceId() {
  if (tabInstanceId) return tabInstanceId;
  try {
    const stored = sessionStorage.getItem(TAB_INSTANCE_KEY);
    if (stored && window.name === stored) tabInstanceId = stored;
  } catch {}
  if (tabInstanceId) return tabInstanceId;
  tabInstanceId = crypto.randomUUID();
  try {
    sessionStorage.setItem(TAB_INSTANCE_KEY, tabInstanceId);
    window.name = tabInstanceId;
  } catch {}
  return tabInstanceId;
}

const RECORDING_KEY_PREFIX = "heymoa.transcription.recording:";
export const RECORDING_BEAT_MS = 2_000;
/** 숨은 탭도 타이머는 1초 단위로 돕니다. 이보다 오래 박동이 없으면 그 탭은 죽었습니다. */
const RECORDING_BEAT_STALE_MS = 6_000;
const RECORDING_RECORD_MAX_MS = 5 * 60_000;

export type RecordingRecord = {
  noteId: string;
  clientInstanceId: string;
  beatAt: number;
};

export type RecordingClaim = "mine" | "live" | "dead";

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

export function beatRecording(noteId: string, beatAt = Date.now()) {
  const id = clientInstanceId();
  const record: RecordingRecord = { noteId, clientInstanceId: id, beatAt };
  try {
    localStorage.setItem(RECORDING_KEY_PREFIX + id, JSON.stringify(record));
  } catch {}
}

export function touchRecording(beatAt = Date.now()) {
  const own = readRecords().find(
    (record) => record.clientInstanceId === clientInstanceId()
  );
  if (own) beatRecording(own.noteId, beatAt);
}

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

export function adoptDeadRecorder(noteId: string, now = Date.now()) {
  if (recordingClaimOf(noteId, now) !== "dead") return null;
  const dead = readRecords(now)
    .filter((record) => record.noteId === noteId)
    .sort((left, right) => right.beatAt - left.beatAt)[0];
  tabInstanceId = dead.clientInstanceId;
  try {
    sessionStorage.setItem(TAB_INSTANCE_KEY, tabInstanceId);
    window.name = tabInstanceId;
  } catch {}
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
  } catch {}
}
