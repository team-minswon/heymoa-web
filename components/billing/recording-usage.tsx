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
  useRecordingUsage,
} from "@/lib/billing/use-recording-usage";

const LABEL = "text-xs leading-4 text-[var(--el-muted)]";
const VALUE =
  "mt-2 flex items-baseline gap-1.5 text-2xl leading-7 font-light tracking-[-0.02em] text-[var(--el-ink)]";
const NOTE = "text-xs leading-4 text-[var(--el-muted)]";

/** 사용량 단계의 글·막대 색. 사이드바도 같은 것을 쓴다. 빨강은 다 썼을 때만. */
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

/**
 * 이번 달 녹음 사용량(APP-1566). 요금제 패널의 오른쪽 칸에 들어가는 내용이라 자기 테두리가 없다.
 * 집행 대상이 아닌 공간(`enforced=false` — 판매 중지 뒤 끝난 구독도 여기)에는 칸 틀까지 그리지 않는다. Free 는 한도와 진행 막대, Pro 는 무제한과 참고용 사용 시간이다.
 * 분은 서버가 내림해 준 값을 그대로 쓴다. 한도는 녹음을 **시작할 때만** 검사하고 진행 중인 회의는 끝까지 녹음된다 —
 * 사용량은 녹음이 끝나 처리된 뒤 반영된다.
 */
export function RecordingUsage({
  workspaceId,
  paid,
  className,
}: {
  workspaceId: string;
  /** 스켈레톤 높이만 정한다. 실제 모양은 서버 응답이 정한다. */
  paid: boolean;
  /** 칸 틀. 보여 줄 사용량이 없으면 틀째 그리지 않아 빈 칸이 남지 않는다. */
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

  if (usage.unlimited) {
    return (
      <div className={className}>
        <p className={LABEL}>{t("label")}</p>
        <p className={VALUE}>{format.duration(usage.usedMinutes)}</p>
        <p className={`mt-3 ${NOTE}`}>{t("unlimited")}</p>
        {usage.recordingInProgress ? (
          <p className={`mt-1 ${NOTE}`}>{t("recordingInProgress")}</p>
        ) : null}
      </div>
    );
  }
  if (usage.allowanceMinutes == null) return null;

  const { percent, level, remainingMinutes } = freeUsageLevel(usage);
  return (
    <div className={className}>
      <p className={LABEL}>{t("label")}</p>
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
            {t("remaining", { duration: format.duration(remainingMinutes) })}
          </span>
        </p>
      ) : (
        // 문장이라 숫자 크기로 쓰면 칸(248px)에서 세 줄로 꺾인다 — 한 단계 작게.
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
