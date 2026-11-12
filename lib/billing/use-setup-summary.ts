"use client";

import { useTranslations } from "next-intl";

import { useGetMyBillingSetup } from "@/lib/api/generated/billing/billing";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { planName } from "@/lib/billing/plan-name";
import { useBillingFormat } from "@/lib/billing/use-billing-format";

/**
 * 카드를 받을 등록과 그 한 줄 요약(「공간 · Pro 월 24,900원」, 카드 변경은 「카드만 등록하고…」). 카드 입력 화면과
 * 그 화면을 띄우는 모달(APP-1600)이 같이 쓴다. 요약은 둘 다 오기 전에는 `null` 이다(자리표시는 부르는 쪽이).
 */
export function useSetupSummary(setupId: string) {
  const t = useTranslations("billing.cardEntry");
  const format = useBillingFormat();
  const query = useGetMyBillingSetup(setupId);
  const setup = okData(query.data);
  const workspaceId = setup?.workspaceId ?? null;
  const workspace = okData(
    useGetWorkspace(workspaceId ?? "", {
      query: { enabled: Boolean(workspaceId) },
    }).data
  );
  const summary =
    setup && workspace
      ? setup.purpose === "REPLACE"
        ? t("summaryReplace", { workspace: workspace.name })
        : setup.planCode && setup.amountKrw != null
          ? t("summary", {
              workspace: workspace.name,
              plan: planName(setup.planCode),
              amount: format.money(setup.amountKrw),
            })
          : workspace.name
      : null;
  return { query, setup, workspaceId, summary };
}
