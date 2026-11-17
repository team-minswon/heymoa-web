"use client";

import { useTranslations } from "next-intl";

import { USAGE_TONE } from "@/components/billing/recording-usage";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { useGetRecordingUsage } from "@/lib/api/generated/billing/billing";
import { okData } from "@/lib/api/ok-data";
import { planName } from "@/lib/billing/plan-name";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import {
  freeUsageLevel,
  isPaidPeriod,
  RECORDING_USAGE_QUERY,
} from "@/lib/billing/use-recording-usage";
import { cn } from "@/lib/utils";

const BUTTON =
  "w-full rounded-control px-2.5 py-2 text-left text-xs leading-4 outline-hidden hover:bg-[var(--el-surface-strong)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring/40";

export function SidebarUsage({
  workspaceId,
  onOpen,
}: {
  workspaceId: string;
  onOpen: () => void;
}) {
  const t = useTranslations("billing.usage");
  const format = useBillingFormat();
  const usage = okData(
    useGetRecordingUsage(workspaceId, { query: RECORDING_USAGE_QUERY }).data
  );
  if (!usage?.enforced || usage.usedMinutes == null) return null;

  const paid = isPaidPeriod(usage);
  if (usage.unlimited) {
    return (
      <SidebarMenuItem>
        <button type="button" onClick={onOpen} className={BUTTON}>
          <span className="block truncate text-[var(--el-muted)]">
            {t("sidebarPaid", {
              plan: planName("PRO"),
              used: format.duration(usage.usedMinutes),
            })}
          </span>
        </button>
      </SidebarMenuItem>
    );
  }
  if (usage.allowanceMinutes == null) return null;
  const { percent, level, remainingMinutes, underMinute } =
    freeUsageLevel(usage);
  const tone = USAGE_TONE[level];
  return (
    <SidebarMenuItem>
      <button type="button" onClick={onOpen} className={BUTTON}>
        <span className="flex items-baseline justify-between gap-2">
          {level === "exhausted" ? (
            <span className={cn("truncate", tone.text)}>
              {t("limitReached")}
            </span>
          ) : (
            <>
              <span className="truncate text-[var(--el-muted)]">
                {t(paid ? "labelPaid" : "sidebarLabel")}
              </span>
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap tabular-nums",
                  tone.text
                )}
              >
                {level === "near"
                  ? underMinute
                    ? t("remainingUnderMinute")
                    : t("remaining", {
                        duration: format.duration(remainingMinutes),
                      })
                  : `${format.duration(usage.usedMinutes)} ${t("ofAllowance", {
                      allowance: format.duration(usage.allowanceMinutes),
                    })}`}
              </span>
            </>
          )}
        </span>
        <span
          role="progressbar"
          aria-label={t("progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 block h-1 overflow-hidden rounded-full bg-[var(--el-hairline)]"
        >
          <span
            className={cn("block h-full rounded-full", tone.bar)}
            style={{ width: `${percent}%` }}
          />
        </span>
      </button>
    </SidebarMenuItem>
  );
}
