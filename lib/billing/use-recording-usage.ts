import { useTranslations } from "next-intl";

import { useGetRecordingUsageSuspense } from "@/lib/api/generated/billing/billing";
import { okData } from "@/lib/api/ok-data";

/**
 * 그 공간의 녹음 사용량(suspense). 값은 전부 서버가 준 분 필드이고 샘플 값으로 다시 계산하지 않는다. 키가 공간 id 를 품는다.
 * 사용량은 녹음이 끝나 처리된 뒤 바뀌므로 항상 새로 읽는다.
 */
export function useRecordingUsage(workspaceId: string) {
  const t = useTranslations("billing");
  const data = okData(
    useGetRecordingUsageSuspense(workspaceId, { query: { staleTime: 0 } }).data
  );
  if (!data) throw new Error(t("loadFailed"));
  return data;
}
