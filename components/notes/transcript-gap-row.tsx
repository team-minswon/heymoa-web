import {
  formatGapDuration,
  spansCalendarDays,
  spansVisibleClockMinutes,
  type GapRow,
} from "@/lib/transcription/gaps";
import { formatOffset } from "@/lib/transcription/presentation";

/**
 * 날짜는 **필요할 때만** 붙인다. 중지가 날을 넘기면 `14:05에 멈추고 09:20에 재개했습니다`
 * 가 시간을 거슬러 올라간 것처럼 읽힌다 — 실제로는 이틀 뒤다.
 */
function clockTime(iso: string, withDate: boolean) {
  const date = new Date(iso);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
  return withDate ? `${date.getMonth() + 1}/${date.getDate()} ${time}` : time;
}

/**
 * 없는 것을 없다고 말한다.
 *
 * 안 그리면 사용자는 **연속인 줄로 읽는다** — 10분이 빈 회의록을 완전한 것으로 읽으면
 * 틀린 근거로 일한다. 접지도 않는다: 접으면 다시 「연속인 줄」이 된다.
 *
 * 세 종류(`PAUSE`·`CAPTURE`·`UPLOAD`)를 **두 부류**로 접는다. 가르는 기준은 하나 —
 * 자기가 멈췄나. 그 밖은 전부 사고이고 사고끼리는 사용자가 할 일이 같다.
 */
export function TranscriptGapRow({ row }: { row: GapRow }) {
  const paused = row.kind === "PAUSE";
  const open = row.endedAt === null;
  const withDate = spansCalendarDays(row);

  // 중지는 회의 축에서 점이다 — 축이 안 나아갔으니 끝 좌표가 없다.
  const offsetLabel = paused
    ? formatOffset(row.startedAtMs)
    : `${formatOffset(row.startedAtMs)} – ${
        open ? "진행 중" : formatOffset(row.endedAtMs)
      }`;

  const duration = open ? null : formatGapDuration(row.durationMs);
  const headline = paused
    ? duration
      ? `${duration} 중지했습니다`
      : "중지했습니다"
    : duration
      ? `${duration} 소리가 없습니다`
      : "소리가 없습니다";

  return (
    <div
      data-testid="transcript-gap"
      data-gap-kind={row.kind}
      data-gap-open={open || undefined}
      className="grid grid-cols-1 gap-2 border-b border-dashed border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
    >
      <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] sm:w-32">
        {offsetLabel}
      </time>
      <p className="min-w-0 text-read leading-7 text-[var(--el-muted-soft)]">
        {headline}
        {/* 절대 시각이 필요한 자리가 정확히 공백이다 — 「얼마나」는 위가 말하고
            「왜」는 이 줄이 말한다. 두 끝이 같은 분이면 숨긴다. */}
        {paused && spansVisibleClockMinutes(row) ? (
          <span className="ml-2 text-[13px] text-[var(--el-muted-soft)]">
            {clockTime(row.startedAt, withDate)}에 멈추고{" "}
            {clockTime(row.endedAt!, withDate)}에 재개했습니다
          </span>
        ) : null}
      </p>
    </div>
  );
}
