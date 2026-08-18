export type TranscriptGap = {
  gapId: string;
  kind: string;
  startedAtMs: number;
  endedAtMs: number;
  startedAt: string;
  endedAt?: string | null;
  reason?: string | null;
};

/**
 * 화면에 그리는 공백. **세 종류를 두 부류로 접는다** — `PAUSE`/`CAPTURE`/`UPLOAD` 는
 * 내부 구현이고, 사용자가 알아야 하는 것은 「내가 멈췄나」 하나다. 사고끼리는 할 일이
 * 같아서(자리를 옮기거나 화면을 켜 둔다) 나눌 이유가 없다.
 */
export type GapRow = {
  gapId: string;
  kind: "PAUSE" | "LOST";
  /** 회의 축. `PAUSE` 는 점이라 둘이 같다. */
  startedAtMs: number;
  endedAtMs: number;
  startedAt: string;
  endedAt: string | null;
  /** 화면에 쓸 길이. `PAUSE` 는 벽시계에서, 나머지는 회의 축에서 온다. */
  durationMs: number;
};

function wallClockMs(startedAt: string, endedAt: string | null) {
  if (!endedAt) return 0;
  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
}

/** 두 끝이 같은 분으로 반올림되면 절대 시각 줄을 숨긴다. */
export function spansVisibleClockMinutes(row: GapRow) {
  if (!row.endedAt) return false;
  return (
    Math.floor(Date.parse(row.startedAt) / 60_000) !==
    Math.floor(Date.parse(row.endedAt) / 60_000)
  );
}

/**
 * 겹친 사고 공백을 행 하나로 합친다.
 *
 * `gaps` 는 겹친다 — 캡처가 끊기면 업로드도 끊긴다. 겹친 것마다 행을 만들면 같은 20분에
 * 세 줄이 쌓여 **회의록이 장애 로그처럼 보인다.** `PAUSE` 는 점이라 절대 안 합쳐진다.
 */
export function toGapRows(gaps: TranscriptGap[]): GapRow[] {
  const rows: GapRow[] = [];

  const ordered = [...gaps].sort((a, b) => a.startedAtMs - b.startedAtMs);
  for (const gap of ordered) {
    const endedAt = gap.endedAt ?? null;
    if (gap.kind === "PAUSE") {
      rows.push({
        gapId: gap.gapId,
        kind: "PAUSE",
        startedAtMs: gap.startedAtMs,
        endedAtMs: gap.endedAtMs,
        startedAt: gap.startedAt,
        endedAt,
        // 중지는 회의 축에서 빠지므로 축의 차가 항상 0이다. 길이는 벽시계에서만 나온다.
        durationMs: wallClockMs(gap.startedAt, endedAt),
      });
      continue;
    }

    const previous = rows.at(-1);
    if (
      previous &&
      previous.kind === "LOST" &&
      gap.startedAtMs <= previous.endedAtMs
    ) {
      previous.endedAtMs = Math.max(previous.endedAtMs, gap.endedAtMs);
      previous.durationMs = previous.endedAtMs - previous.startedAtMs;
      // 진행 중(null)이 하나라도 있으면 합친 행도 진행 중이다.
      previous.endedAt = previous.endedAt && endedAt ? endedAt : null;
      continue;
    }

    rows.push({
      gapId: gap.gapId,
      kind: "LOST",
      startedAtMs: gap.startedAtMs,
      endedAtMs: gap.endedAtMs,
      startedAt: gap.startedAt,
      endedAt,
      durationMs: gap.endedAtMs - gap.startedAtMs,
    });
  }

  return rows;
}

/**
 * **대충 말한다.** 단위 하나만, 반올림해서, 「약」을 붙인다.
 *
 * 정확한 값이 필요한 자리가 아니다 — 「9분 48초」의 48초로 하는 일이 없고, 중지는 정확한
 * 두 끝을 아랫줄(`10:00에 멈추고 …`)이 이미 말한다. 여기가 답하는 질문은 **「많이 비었나」**
 * 하나다.
 *
 * 큰 단위까지 올라가는 것은 안 접는다. 분에서 멈추면 두 시간 반이 `150분`, 이틀 반이
 * `3600분` 으로 나와 읽는 사람이 60 으로 두 번 나눠야 한다.
 */
export function formatGapDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  // 1분 미만에 「약 40초」라고 쓰면 안 대충이다. 이 구간은 길이가 뜻을 안 바꾼다.
  if (seconds < 60) return "잠깐";

  // 반올림한 뒤에 칸을 다시 고른다. 그래야 59분 40초가 「약 60분」이 아니라 「약 1시간」이다.
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `약 ${minutes}분`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `약 ${hours}시간`;

  return `약 ${Math.round(hours / 24)}일`;
}

/** 두 끝이 다른 날이면 시:분만으로는 거꾸로 읽힌다. */
export function spansCalendarDays(row: GapRow) {
  if (!row.endedAt) return false;
  const started = new Date(row.startedAt);
  const ended = new Date(row.endedAt);
  return started.toDateString() !== ended.toDateString();
}
