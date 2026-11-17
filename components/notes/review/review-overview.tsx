import { useTranslations } from "next-intl";

import { SectionBlock } from "@/components/notes/review/section-block";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import {
  overviewText,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";

export function ReviewOverview({
  summary,
  pending = false,
  failed = false,
  onRetry,
}: {
  summary: MeetingReviewSummary | null;
  pending?: boolean;
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
      <p className="text-[16px] leading-7 text-[var(--el-ink)]">
        {overviewText(summary)}
      </p>
    </SectionBlock>
  );
}
