import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/fetcher";

/**
 * 계정 탈퇴 · 워크스페이스 삭제 · 이름 확인 나가기 API (PRO-69, APP-1383).
 *
 * **임시 손 계약이다.** server(APP-1378·1380·1381)가 계약을 아직 내지 않아 docs
 * `projects/PRO-69-…/docs/contract.md` 의 제안 경로로 적었다. server openapi 가 나오면 `openapi3.yml` 사본을
 * 맞추고 `pnpm orval` 의 생성 훅으로 바꾼 뒤 이 파일을 지운다(rule `api-data`). 그때 이름·필드가 다르면 여기만 고친다.
 */

export type DeletionPlanAction =
  /** 나 혼자 쓰는 워크스페이스 — 지운다 */
  | "DELETE"
  /** 다른 관리자가 있거나 내가 멤버 — 나간다 */
  | "LEAVE"
  /** 내가 유일한 관리자이고 다른 멤버가 있다 — 관리자를 넘기거나 지운다 */
  | "TRANSFER_OR_DELETE";

export type DeletionPlanMember = {
  userId: string;
  name: string;
  email: string;
};

export type DeletionPlanWorkspace = {
  workspaceId: string;
  name: string;
  action: DeletionPlanAction;
  /** `TRANSFER_OR_DELETE` 일 때 넘겨받을 수 있는 멤버, 가입순 */
  successorCandidates: DeletionPlanMember[];
  /** 기본으로 고를 사람(가장 오래된 멤버). `TRANSFER_OR_DELETE` 가 아니면 null */
  defaultSuccessorUserId: string | null;
};

export type DeletionPlan = { workspaces: DeletionPlanWorkspace[] };

export const WITHDRAWAL_REASON_CODES = [
  "MISSING_FEATURE",
  "SECURITY_CONCERN",
  "TRANSCRIPTION_QUALITY",
  "OTHER_SERVICE",
  "RARELY_USED",
  "OTHER",
] as const;
export type WithdrawalReasonCode = (typeof WITHDRAWAL_REASON_CODES)[number];

/** 탈퇴 확인 문구. 서버도 앞뒤 공백만 걷고 정확히 같은지 본다. */
export const WITHDRAWAL_CONFIRMATION = "회원 탈퇴";
export const WITHDRAWAL_DETAIL_MAX = 500;

export type WorkspaceDecision =
  | { workspaceId: string; decision: "TRANSFER"; successorUserId: string }
  | { workspaceId: string; decision: "DELETE" };

export type DeleteAccountRequest = {
  confirmation: string;
  /** `TRANSFER_OR_DELETE` 워크스페이스마다 하나. 나머지는 서버가 정한 대로 한다 */
  workspaces: WorkspaceDecision[];
  reason?: { code: WithdrawalReasonCode; detail?: string };
};

export type DeleteWorkspaceRequest = {
  workspaceName: string;
};

type Envelope<T> = { data: { success: boolean; data: T }; status: number };

export const DELETION_PLAN_QUERY_KEY = ["/v1/users/me/deletion-plan"] as const;

export function useDeletionPlan(enabled: boolean) {
  return useQuery({
    queryKey: DELETION_PLAN_QUERY_KEY,
    enabled,
    // 열 때마다 지금 상태로 다시 받는다 — 그사이 멤버가 나가면 처리가 바뀐다.
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const response = await apiFetch<Envelope<DeletionPlan>>(
        DELETION_PLAN_QUERY_KEY[0],
        { method: "GET", signal }
      );
      return response.data.data;
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationKey: ["deleteAccount"],
    meta: { suppressErrorToast: true },
    mutationFn: (data: DeleteAccountRequest) =>
      apiFetch<{ status: number }>("/v1/users/me", { method: "DELETE", data }),
  });
}

export function useDeleteWorkspace() {
  return useMutation({
    mutationKey: ["deleteWorkspace"],
    meta: { suppressErrorToast: true },
    mutationFn: ({
      workspaceId,
      ...data
    }: DeleteWorkspaceRequest & { workspaceId: string }) =>
      apiFetch<{ status: number }>(`/v1/workspaces/${workspaceId}`, {
        method: "DELETE",
        data,
      }),
  });
}

/** 확인 입력이 맞는가. 서버와 같은 규칙 — 앞뒤 공백만 걷고 정확히 같아야 한다. */
export function confirmationMatches(input: string, expected: string) {
  return input.trim() === expected.trim() && expected.trim().length > 0;
}
