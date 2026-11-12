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

/**
 * Free 사용량의 표시 단계(APP-1596). 요금제 탭과 사이드바가 이것 하나로 글과 색을 정한다.
 * - `ok` 80% 미만 — 「쓴 양 / 한도」
 * - `near` 80% 이상 다 쓰기 전 — 「N 남음」, 주의색
 * - `exhausted` 다 썼다 — 「이번 달 한도를 다 썼습니다」, 위험색(빨강은 여기만)
 * 다 썼는지는 서버의 남은 샘플(없으면 분)로 가른다 — 분은 내림이라 몇십 초 남은 공간이 0분으로 보여도 아직 시작할 수 있다.
 * `percent` 는 막대 폭이고 언제나 쓴 만큼 차오른다. 다 쓰기 전에는 99 를 넘지 않는다.
 */
export function freeUsageLevel(usage: {
  usedMinutes: number | null;
  allowanceMinutes: number | null;
  remainingMinutes: number | null;
  remainingSamples: number | null;
}) {
  const used = usage.usedMinutes ?? 0;
  const allowance = usage.allowanceMinutes ?? 0;
  const ratio = (used / Math.max(1, allowance)) * 100;
  const exhausted =
    usage.remainingSamples != null
      ? usage.remainingSamples <= 0
      : used >= allowance;
  const level: "ok" | "near" | "exhausted" = exhausted
    ? "exhausted"
    : ratio >= 80
      ? "near"
      : "ok";
  return {
    level,
    percent: exhausted ? 100 : Math.min(99, Math.floor(ratio)),
    remainingMinutes: Math.max(0, usage.remainingMinutes ?? allowance - used),
  };
}
