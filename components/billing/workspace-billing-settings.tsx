"use client";

import { useTranslations } from "next-intl";

import { BillingNotice } from "@/components/billing/billing-parts";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { LinkButton } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import {
  billingInProgress,
  useWorkspaceBilling,
} from "@/lib/billing/use-workspace-billing";

/**
 * 설정 › 결제(PRO-75). 요약만 두고 요금제·결제 관리는 전용 화면(`/w/{id}/billing`)이 맡는다.
 * 머리글은 고정 문구라 조회를 기다리지 않고 그리고, 조회 자리만 skeleton 이다(rule `error-loading`).
 */
export function WorkspaceBillingSettings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = useTranslations("billing.settings");
  return (
    <div>
      <SettingsHeader title={t("title")} description={t("description")} />
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={
          <Skeleton aria-label={t("loading")} className="h-24 w-full" />
        }
      >
        <Summary workspaceId={workspaceId} />
      </DataBoundary>
    </div>
  );
}

function Summary({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.settings");
  const tKind = useTranslations("billing.page.kind");
  const format = useBillingFormat();
  const billing = useWorkspaceBilling(workspaceId);
  if (!billing.enforced) {
    return <BillingNotice>{t("notEnforced")}</BillingNotice>;
  }
  const period = billing.entitlement?.period ?? billing.currentPeriod;
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="w-full rounded-panel border border-[var(--el-hairline)] bg-white p-4">
        <p className="font-medium text-[var(--el-ink)]">
          {tKind(billing.entitlement?.kind ?? "FREE")}
        </p>
        {billing.entitlement ? (
          <p className="mt-1 text-sm text-[var(--el-muted)]">
            {format.allowance(billing.entitlement.recordingAllowanceMinutes)}
          </p>
        ) : null}
        {period ? (
          <p className="mt-1 text-sm text-[var(--el-muted)]">
            {format.period(period)}
          </p>
        ) : null}
        {billing.teamSetupInProgress ? (
          <p className="mt-1 text-sm text-[var(--el-muted)]">
            {t("teamInProgress")}
          </p>
        ) : billingInProgress(billing) ? (
          <p className="mt-1 text-sm text-[var(--el-muted)]">
            {t("inProgress")}
          </p>
        ) : null}
      </div>
      <LinkButton href={`/w/${workspaceId}/billing`} variant="outline">
        {t("openPage")}
      </LinkButton>
    </div>
  );
}
