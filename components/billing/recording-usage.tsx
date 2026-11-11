"use client";

import { useTranslations } from "next-intl";

import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAppDate } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { useRecordingUsage } from "@/lib/billing/use-recording-usage";

const CARD = "w-full rounded-panel border border-[var(--el-hairline)] bg-white p-5";

/**
 * 녹음 사용량 블록(APP-1566). 집행 대상이 아닌 공간(`enforced=false`)에는 아무것도 그리지 않는다.
 * Free 는 달력월 한도와 진행 막대, Pro 는 무제한과 참고용 사용 시간이다. 분은 서버가 내림해 준 값을 그대로 쓴다.
 * 한도는 녹음을 **시작할 때만** 검사하고 진행 중인 회의는 끝까지 녹음된다 — 사용량은 녹음이 끝나 처리된 뒤 반영된다.
 */
export function RecordingUsage({
  workspaceId,
  paid,
}: {
  workspaceId: string;
  /** 스켈레톤 높이만 정한다. 실제 모양은 서버 응답이 정한다. */
  paid: boolean;
}) {
  const t = useTranslations("billing.usage");
  return (
    <DataBoundary
      resetKeys={[workspaceId]}
      fallback={<UsageSkeleton label={t("loading")} paid={paid} />}
    >
      <UsageBody workspaceId={workspaceId} />
    </DataBoundary>
  );
}

function UsageBody({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.usage");
  const locale = useDisplayLocale();
  const usage = useRecordingUsage(workspaceId);
  if (!usage.enforced || usage.usedMinutes == null) return null;

  if (usage.unlimited) {
    return (
      <div className={CARD}>
        <p className="text-base leading-6 font-medium text-[var(--el-ink)]">
          {t("unlimited")}
        </p>
        <p className="mt-2 text-sm leading-5 text-[var(--el-muted)]">
          {t("usedPaid", { used: usage.usedMinutes })}
        </p>
      </div>
    );
  }
  if (usage.allowanceMinutes == null) return null;

  const percent = Math.min(
    100,
    Math.round((usage.usedMinutes / Math.max(1, usage.allowanceMinutes)) * 100)
  );
  return (
    <div className={CARD}>
      <p className="text-base leading-6 font-medium text-[var(--el-ink)]">
        {t("usedFree", {
          used: usage.usedMinutes,
          allowance: usage.allowanceMinutes,
        })}
      </p>
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--el-surface-strong)]"
      >
        <div
          className="h-full bg-[var(--el-ink)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {usage.periodEnd ? (
        <p className="mt-2 text-xs leading-4 text-[var(--el-muted)]">
          {t("resets", {
            date: formatAppDate(
              usage.periodEnd,
              { month: "long", day: "numeric" },
              locale
            ),
          })}
        </p>
      ) : null}
      {usage.reservedSamples ? (
        <p className="mt-1 text-xs leading-4 text-[var(--el-muted)]">
          {t("reserved")}
        </p>
      ) : null}
    </div>
  );
}

/** 사용량 블록의 자리. 플랜을 이미 알아서 Free(막대 포함)·Pro 의 높이를 각각 맞춘다. */
function UsageSkeleton({
  label,
  paid,
}: {
  label: string;
  paid: boolean;
}) {
  return (
    <div aria-label={label} className={CARD}>
      <Skeleton className="h-6 w-48" />
      {paid ? (
        <Skeleton className="mt-2 h-5 w-32" />
      ) : (
        <>
          <Skeleton className="mt-3 h-2 w-full" />
          <Skeleton className="mt-2 h-4 w-28" />
        </>
      )}
    </div>
  );
}
