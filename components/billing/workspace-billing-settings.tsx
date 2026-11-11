"use client";

import { useTranslations } from "next-intl";

import { SettingsHeader } from "@/components/settings/settings-layout";
import { LinkButton } from "@/components/ui/button";

/**
 * 설정 › 결제(PRO-75). 요약만 두고 요금제·결제 관리는 전용 화면(`/w/{id}/billing`)이 맡는다.
 *
 * 현재 플랜·잔여량은 서버 계약이 나오면 이 자리(머리글 아래)에 채운다. 그때 조회는 `DataBoundary` + skeleton 이고,
 * 머리글은 고정 문구라 skeleton 이 가리지 않는다(rule `error-loading`).
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
      <LinkButton href={`/w/${workspaceId}/billing`} variant="outline">
        {t("openPage")}
      </LinkButton>
    </div>
  );
}
