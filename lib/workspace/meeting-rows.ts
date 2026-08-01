import type { NoteSummary } from "@/lib/api/generated/models";
import { APP_TIME_ZONE, formatAppDate } from "@/lib/format/date";

export type MeetingSectionKey = "scheduled" | "started";

export type MeetingSection = {
  key: MeetingSectionKey;
  label: string;
  /** 「2건 · 가까운 순」의 오른쪽 절반. 정렬 기준을 말하지 않으면 순서가 임의로 보인다. */
  order: string;
  notes: NoteSummary[];
};

/** 목록에서 회의를 두 덩어리로 가르는 기준 — 아직 시작 안 한 것과 이미 시작한 것. */
function isScheduled(note: NoteSummary): boolean {
  return note.meetingStatus === "NOT_STARTED";
}

/** 시작된 회의의 시간 기준. 시작 시각이 없으면 만들어진 시각으로 떨어진다. */
function startedAnchor(note: NoteSummary): number {
  const started = note.meetingStartedAt ?? note.lastRecordedAt;
  const parsed = started ? Date.parse(started) : Number.NaN;
  return Number.isNaN(parsed) ? Date.parse(note.createdAt) : parsed;
}

/** 예정 회의의 시간 기준. 일시 미정은 맨 뒤로 — 시간 없는 것을 시간 사이에 끼우지 않는다. */
function scheduledAnchor(note: NoteSummary): number {
  const parsed = note.scheduledAt ? Date.parse(note.scheduledAt) : Number.NaN;
  return Number.isNaN(parsed) ? Infinity : parsed;
}

/**
 * 「예정」은 가까운 순, 「시작된 회의」는 최근 시작순. 방향이 반대인 게 핵심이다 —
 * 예정은 다음에 뭐가 오는지가, 지난 것은 방금 뭘 했는지가 궁금한 것이라서다.
 */
export function groupMeetings(notes: readonly NoteSummary[]): MeetingSection[] {
  const scheduled = notes.filter(isScheduled).sort((a, b) => {
    const delta = scheduledAnchor(a) - scheduledAnchor(b);
    return Number.isNaN(delta) || delta === 0
      ? a.noteId.localeCompare(b.noteId)
      : delta;
  });
  const started = notes.filter((note) => !isScheduled(note)).sort((a, b) => {
    const delta = startedAnchor(b) - startedAnchor(a);
    return Number.isNaN(delta) || delta === 0
      ? b.noteId.localeCompare(a.noteId)
      : delta;
  });

  return [
    {
      key: "scheduled" as const,
      label: "예정",
      order: `${scheduled.length}건 · 가까운 순`,
      notes: scheduled,
    },
    {
      key: "started" as const,
      label: "시작된 회의",
      order: `${started.length}건 · 최근 시작순`,
      notes: started,
    },
  ].filter((section) => section.notes.length > 0);
}

/** 누적 녹음 시간을 목록 칸에 넣을 한 마디로. 0이면 아직 기록이 없다는 뜻이라 「—」다. */
export function formatRecordedDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60_000);
  if (minutes < 1) return "—";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 서비스 시간대 기준 자정으로 내림 — 「오늘/어제」를 UTC로 재면 한국 새벽에 하루 어긋난다. */
function appDayStart(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  return Date.parse(`${parts}T00:00:00${appOffset(ms)}`);
}

/** 서비스 시간대의 UTC 오프셋. 서울은 고정이지만 값을 박아 넣지 않는다. */
function appOffset(ms: number): string {
  const name = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(ms))
    .find((part) => part.type === "timeZoneName")?.value;
  return name?.replace("GMT", "") || "+00:00";
}

/**
 * 목록의 일시 칸. 오늘·어제는 이름으로, 그 밖은 날짜로 — 상대 표기(「3일 전」)는
 * 회의를 다시 찾을 때 쓸 수 없다.
 *
 * `now`가 null 이면(서버 렌더) 날짜만 돌려준다. 렌더 중에 `Date.now()`를 부르면 hydration이 어긋난다.
 */
export function formatMeetingWhen(iso: string, now: number | null): string {
  const time = formatAppDate(iso, { hour: "numeric", minute: "2-digit" });
  if (now === null) {
    return `${formatAppDate(iso, { month: "long", day: "numeric" })} ${time}`;
  }
  const today = appDayStart(now);
  const target = appDayStart(Date.parse(iso));
  if (target === today) return `오늘 ${time}`;
  if (target === today - DAY_MS) return `어제 ${time}`;
  return `${formatAppDate(iso, { month: "long", day: "numeric" })} ${time}`;
}

/** 예정 회의의 일시 칸. 요일을 붙인다 — 「8월 3일」만으로는 언제인지 안 잡힌다. */
export function formatScheduledWhen(iso: string | null): string {
  if (!iso) return "일시 미정";
  return formatAppDate(iso, {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
