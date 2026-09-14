import { SectionBlock } from "@/components/notes/review/section-block";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { overviewToMarkdown } from "@/lib/notes/review/markdown";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

/**
 * 개요. 회의 전체를 말하는 한두 문장이다. 주제는 바로 아래 주제 목차가 맡는다.
 * 요약이 없어도 섹션 검토는 되므로, 왜 없는지만 한 줄로 말한다.
 */
export function ReviewOverview({
  summary,
  pending = false,
  failed = false,
  onRetry,
}: {
  summary: MeetingReviewSummary | null;
  /** 요약이 아직 오는 중. 없다고 먼저 말했다가 도착하면 뒤집히지 않게 자리만 잡는다 */
  pending?: boolean;
  /** 조회가 실패했다. 「요약이 없다」와 다르다 — 다시 불러올 길을 둔다 */
  failed?: boolean;
  onRetry?: () => void;
}) {
  if (failed && onRetry) {
    return (
      <SectionBlock title="개요">
        <InlineRetry variant="line" label="요약을 불러오지 못했습니다." onRetry={onRetry} className="pt-1" />
      </SectionBlock>
    );
  }

  if (pending) {
    return (
      <SectionBlock title="개요">
        <div aria-label="개요 불러오는 중">
          <Skeleton className="h-7 w-[86%] rounded-chip" />
          <Skeleton className="mt-1 h-7 w-[62%] rounded-chip" />
        </div>
      </SectionBlock>
    );
  }

  if (!summary || summary.status !== "SUCCEEDED") {
    return (
      <SectionBlock title="개요">
        <p className="pt-1 text-[13px] text-[var(--el-muted)]">
          {summary?.status === "FAILED"
            ? "요약을 만들지 못했습니다. 아래 항목은 그대로 검토할 수 있습니다."
            : "이 회의에는 주제 요약이 없습니다. 아래 항목은 그대로 검토할 수 있습니다."}
        </p>
      </SectionBlock>
    );
  }

  return (
    <SectionBlock title="개요" copy={{ build: () => overviewToMarkdown(summary) }}>
      {summary.headline ? <p className="sr-only">{summary.headline.text}</p> : null}
      <p className="max-w-[60ch] text-base leading-7 break-keep text-[var(--el-ink)]">
        {summary.lead.map((line) => line.text).join(" ")}
      </p>
    </SectionBlock>
  );
}
