import type { AppliedRange } from "@/lib/notes/context-candidates/contract";
import type { CoverageGap } from "@/lib/notes/context-candidates/reducer";
import { formatOffset } from "@/lib/transcription/presentation";

/**
 * 분류가 닿지 않은 구간과 상한에 닿은 구간.
 *
 * **전사 공백과 다른 사건이다.** 전사 공백은 소리가 없어서 글이 없는 것이고, 이쪽은 글은
 * 있는데 정리가 안 된 것이다. 같은 문구로 그리면 사용자가 원인을 잘못 읽는다 — 하나는
 * 마이크를 보게 하고 하나는 기다리게 한다.
 *
 * **회의 중에는 원인을 단정하지 않는다.** 구멍이 「포기」인지 「아직 진행 중」인지는
 * heymoa-ai 의 attempt 원장에만 있고 이 화면에 오지 않는다. 회의가 끝나면 「진행 중」이
 * 없어지므로 그때는 단정할 수 있다.
 *
 * **끝난 뒤 문구가 「기다리라」가 되면 안 된다.** 포기한 구간은 워터마크가 이미 지나가서
 * 실시간 원장에 영영 안 들어온다(APP-452 spec.md:522-528). 종료 분석은 전사를 그대로
 * 읽으므로 그 구간의 내용은 요약에 반영되지만, **이 레일은 안 채워진다.** 「종료 후 분석이
 * 다시 읽습니다」라고 쓰면 사용자가 채워지지 않을 자리에서 기다린다 — 어디를 봐야 하는지를
 * 말한다.
 */
export function ContextCoverageGapRow({
  gap,
  meetingEnded,
}: {
  gap: CoverageGap;
  meetingEnded: boolean;
}) {
  return (
    <div
      data-testid="context-coverage-gap"
      className="grid grid-cols-1 gap-2 border-b border-dashed border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
    >
      <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] sm:w-32">
        {`${formatOffset(gap.fromStartedAtMs)} – ${formatOffset(gap.toEndedAtMs)}`}
      </time>
      <p className="min-w-0 text-read leading-7 text-[var(--el-muted-soft)]">
        {meetingEnded
          ? "이 구간은 실시간 정리에 들어오지 않았습니다"
          : "이 구간은 아직 정리되지 않았습니다"}
        <span className="ml-2 text-[13px] text-[var(--el-muted-soft)]">
          {meetingEnded
            ? "요약은 전사를 그대로 읽습니다 — 이 구간의 내용은 요약에 있습니다"
            : "전사는 계속 기록됩니다"}
        </span>
      </p>
    </div>
  );
}

/**
 * 모델이 한 배치에서 상한에 닿았다.
 *
 * **「더 있다」가 아니라 「더 있을 수 있다」다.** 상한 도달은 가능성이지 확정이 아니라서,
 * 단정하면 있지도 않은 누락을 사용자가 찾게 된다.
 *
 * 두 flag(`rawDeltaSaturated`·`semanticUnitSaturated`)를 화면에서 가르지 않는다 — 원인은
 * 다르지만 사용자가 할 일이 같다. 원인은 wire 에 그대로 남아 있다.
 */
export function ContextSaturatedRow({ range }: { range: AppliedRange }) {
  return (
    <div
      data-testid="context-saturated"
      className="grid grid-cols-1 gap-2 border-b border-dashed border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
    >
      <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] sm:w-32">
        {`${formatOffset(range.fromStartedAtMs)} – ${formatOffset(range.toEndedAtMs)}`}
      </time>
      <p className="min-w-0 text-read leading-7 text-[var(--el-muted-soft)]">
        이 구간에 항목이 더 있을 수 있어요
      </p>
    </div>
  );
}
