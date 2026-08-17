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

export function formatGapDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}
