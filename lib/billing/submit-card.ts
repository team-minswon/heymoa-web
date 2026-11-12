import { apiFetch, REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import type { BillingSetupStatusResponse } from "@/lib/api/generated/models";
import type { cardRequestOf } from "@/lib/billing/card-input";

/**
 * 카드 제출(APP-1600). **훅(`useMutation`)으로 감싸지 않는다** — 뮤테이션 캐시가 변수(카드 정보)를 들고 있고, 전역
 * `MutationCache.onSuccess` 가 변수를 분석 이벤트(`trackMutation`)에 넘긴다.
 *
 * shortcut: server OpenAPI 가 나오기 전의 손 호출이다. 계약이 오면 생성 함수로 바꾼다.
 */
export function submitBillingCard(
  workspaceId: string,
  setupId: string,
  data: ReturnType<typeof cardRequestOf>
) {
  return apiFetch<{ data: BillingSetupStatusResponse; status: number }>(
    `/v1/workspaces/${workspaceId}/billing/setups/${setupId}/card`,
    { method: "POST", data, timeoutMs: REQUEST_TIMEOUT_MS }
  );
}
