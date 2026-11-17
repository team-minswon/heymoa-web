"use client";

import { useTranslations } from "next-intl";

import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAppDate } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { cn } from "@/lib/utils";
import {
  freeUsageLevel,
  isPaidPeriod,
  useRecordingUsage,
} from "@/lib/billing/use-recording-usage";

const LABEL = "text-xs leading-4 text-[var(--el-muted)]";
const VALUE =
  "mt-2 flex items-baseline gap-1.5 text-2xl leading-7 font-light tracking-[-0.02em] text-[var(--el-ink)]";
const NOTE = "text-xs leading-4 text-[var(--el-muted)]";

export const USAGE_TONE = {
  ok: { text: "text-[var(--el-ink)]", bar: "bg-[var(--el-ink)]" },
  near: {
    text: "text-[var(--el-warning-strong)]",
    bar: "bg-[var(--el-warning-strong)]",
  },
  exhausted: {
    text: "text-[var(--el-error-strong)]",
    bar: "bg-[var(--el-error)]",
  },
} as const;

export function RecordingUsage({
  workspaceId,
  paid,
  className,
}: {
  workspaceId: string;
  paid: boolean;
  className?: string;
}) {
  const t = useTranslations("billing.usage");
  return (
    <DataBoundary
      resetKeys={[workspaceId]}
      fallback={
        <div className={className}>
          <UsageSkeleton label={t("loading")} paid={paid} />
        </div>
      }
    >
      <UsageBody workspaceId={workspaceId} className={className} />
    </DataBoundary>
  );
}

function UsageBody({
  workspaceId,
  className,
}: {
  workspaceId: string;
  className?: string;
}) {
  const t = useTranslations("billing.usage");
  const locale = useDisplayLocale();
  const usage = useRecordingUsage(workspaceId);
  const format = useBillingFormat();
  if (!usage.enforced || usage.usedMinutes == null) return null;
  const paid = isPaidPeriod(usage);
  const label = t(paid ? "labelPaid" : "label");

  if (usage.unlimited) {
    return (
      <div className={className}>
        <p className={LABEL}>{label}</p>
        <p className={VALUE}>{format.duration(usage.usedMinutes)}</p>
        <p className={`mt-3 ${NOTE}`}>{t("unlimited")}</p>
        {paid && usage.periodStart && usage.periodEnd ? (
          <p className={`mt-1 ${NOTE}`}>
            {t("paidPeriod", {
              start: format.date(usage.periodStart),
              end: format.date(usage.periodEnd),
            })}
          </p>
        ) : null}
        {usage.recordingInProgress ? (
          <p className={`mt-1 ${NOTE}`}>{t("recordingInProgress")}</p>
        ) : null}
      </div>
    );
  }
  if (usage.allowanceMinutes == null) return null;

  const { percent, level, remainingMinutes, underMinute } =
    freeUsageLevel(usage);
  return (
    <div className={className}>
      <p className={LABEL}>{label}</p>
      {level === "ok" ? (
        <p className={VALUE}>
          <span className="whitespace-nowrap">
            {format.duration(usage.usedMinutes)}
          </span>
          <span className="text-sm font-normal tracking-normal whitespace-nowrap text-[var(--el-muted)]">
            {t("ofAllowance", {
              allowance: format.duration(usage.allowanceMinutes),
            })}
          </span>
        </p>
      ) : level === "near" ? (
        <p className={cn(VALUE, USAGE_TONE.near.text)}>
          <span className="whitespace-nowrap">
            {underMinute
              ? t("remainingUnderMinute")
              : t("remaining", { duration: format.duration(remainingMinutes) })}
          </span>
        </p>
      ) : (
        <p
          className={cn(
            "mt-2 text-base leading-7 font-medium",
            USAGE_TONE.exhausted.text
          )}
        >
          {t("limitReached")}
        </p>
      )}
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--el-hairline)]"
      >
        <div
          className={cn("h-full rounded-full", USAGE_TONE[level].bar)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {usage.periodEnd ? (
        <p className={`mt-3 ${NOTE}`}>
          {t(
            level === "exhausted"
              ? "exhausted"
              : level === "near"
                ? "nearLimit"
                : "resets",
            {
              percent,
              date: formatAppDate(
                usage.periodEnd,
                { month: "long", day: "numeric" },
                locale
              ),
            }
          )}
        </p>
      ) : null}
      {usage.recordingInProgress ? (
        <p className={`mt-1 ${NOTE}`}>{t("recordingInProgress")}</p>
      ) : null}
    </div>
  );
}

function UsageSkeleton({ label, paid }: { label: string; paid: boolean }) {
  const t = useTranslations("billing.usage");
  return (
    <div aria-label={label}>
      <p className={LABEL}>{t(paid ? "labelPaid" : "label")}</p>
      <Skeleton className="mt-2 h-7 w-32" />
      {paid ? (
        <Skeleton className="mt-3 h-4 w-16" />
      ) : (
        <>
          <Skeleton className="mt-3 h-1.5 w-full" />
          <Skeleton className="mt-3 h-4 w-24" />
        </>
      )}
    </div>
  );
}
