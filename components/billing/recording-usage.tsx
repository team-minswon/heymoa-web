"use client";

import { useTranslations } from "next-intl";

import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAppDate } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { useRecordingUsage } from "@/lib/billing/use-recording-usage";

const LABEL = "text-xs leading-4 text-[var(--el-muted)]";
const VALUE =
  "mt-2 flex items-baseline gap-1.5 text-2xl leading-7 font-light tracking-[-0.02em] text-[var(--el-ink)]";
const NOTE = "text-xs leading-4 text-[var(--el-muted)]";

/**
 * 이번 달 녹음 사용량(APP-1566). 요금제 패널의 오른쪽 칸에 들어가는 내용이라 자기 테두리가 없다.
 * 집행 대상이 아닌 공간(`enforced=false`)에는 아무것도 그리지 않는다. Free 는 한도와 진행 막대, Pro 는 무제한과 참고용 사용 시간이다.
 * 분은 서버가 내림해 준 값을 그대로 쓴다. 한도는 녹음을 **시작할 때만** 검사하고 진행 중인 회의는 끝까지 녹음된다 —
 * 사용량은 녹음이 끝나 처리된 뒤 반영된다.
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
  const format = useBillingFormat();
  if (!usage.enforced || usage.usedMinutes == null) return null;

  if (usage.unlimited) {
    return (
      <div>
        <p className={LABEL}>{t("label")}</p>
        <p className={VALUE}>{format.duration(usage.usedMinutes)}</p>
        <p className={`mt-3 ${NOTE}`}>{t("unlimited")}</p>
      </div>
    );
  }
  if (usage.allowanceMinutes == null) return null;

  const percent = Math.min(
    100,
    Math.round((usage.usedMinutes / Math.max(1, usage.allowanceMinutes)) * 100)
  );
  return (
    <div>
      <p className={LABEL}>{t("label")}</p>
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
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--el-hairline)]"
      >
        <div
          className="h-full rounded-full bg-[var(--el-ink)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {usage.periodEnd ? (
        <p className={`mt-3 ${NOTE}`}>
          {t(
            percent >= 100
              ? "exhausted"
              : percent >= 80
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

/** 사용량 자리. 라벨은 고정 문구라 그대로 그리고 값만 막대다. 요금제를 이미 알아서 Free(막대 포함)·Pro 의 높이를 각각 맞춘다. */
function UsageSkeleton({ label, paid }: { label: string; paid: boolean }) {
  const t = useTranslations("billing.usage");
  return (
    <div aria-label={label}>
      <p className={LABEL}>{t("label")}</p>
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
