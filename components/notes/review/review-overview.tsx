import { useTranslations } from "next-intl";

import { SectionBlock } from "@/components/notes/review/section-block";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import {
  overviewText,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";

/**
 * 요약. 회의 전체를 말하는 한 문장이다. 주제는 바로 아래 주제 목차가 맡는다.
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
  const t = useTranslations("notes.review.overview");
  const tSummary = useTranslations("notes.summary");
  if (failed && onRetry) {
    return (
      <SectionBlock title={t("title")}>
        <InlineRetry
          variant="line"
          label={tSummary("loadFailed")}
          onRetry={onRetry}
          className="pt-1"
        />
      </SectionBlock>
    );
  }

  if (pending) {
    return (
      <SectionBlock title={t("title")}>
        <div aria-label={tSummary("loading")}>
          <Skeleton className="h-7 w-[86%] rounded-chip" />
          <Skeleton className="mt-1 h-7 w-[62%] rounded-chip" />
        </div>
      </SectionBlock>
    );
  }

  if (!summary || summary.status !== "SUCCEEDED") {
    return (
      <SectionBlock title={t("title")}>
        <p className="pt-1 text-[13px] text-[var(--el-muted)]">
          {summary?.status === "FAILED" ? t("failed") : t("none")}
        </p>
      </SectionBlock>
    );
  }

  return (
    <SectionBlock title={t("title")}>
      {/* 주제마다의 한 줄은 아래 주제 목차가 맡는다 */}
      <p className="text-[16px] leading-7 text-[var(--el-ink)]">
        {overviewText(summary)}
      </p>
    </SectionBlock>
  );
}
