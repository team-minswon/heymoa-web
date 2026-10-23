import { useMutation, useQuery } from "@tanstack/react-query";

import {
  deleteAccount,
  getDeletionPlan,
  getGetDeletionPlanQueryKey,
} from "@/lib/api/generated/account/account";
import { deleteWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import {
  DeleteAccountRequestReasonCode,
  type AccountDeletionPlanResponseData,
  type AccountDeletionPlanResponseDataWorkspacesItem,
  type AccountDeletionPlanResponseDataWorkspacesItemAction,
  type DeleteAccountRequest,
  type WorkspaceNameConfirmationRequest,
} from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";

/**
 * 계정 탈퇴 · 워크스페이스 삭제 · 이름 확인 나가기 API (PRO-69, APP-1383).
 *
 * 계약은 server openapi(APP-1378·1380·1381)에서 생성한 클라이언트다. 여기는 화면이 쓰는 이름과
 * 훅 모양(처리 목록은 매번 새로, 실패 토스트는 화면이 직접)만 붙인다.
 * 재로그인 증명이 없거나 만료되면 403 `REAUTH_REQUIRED`, 녹음 중이면 409 `RECORDING_IN_PROGRESS` —
 * 화면은 서버 문구를 그대로 보인다(`errorMessageOf`).
 */

export type DeletionPlanAction =
  AccountDeletionPlanResponseDataWorkspacesItemAction;
export type DeletionPlanWorkspace =
  AccountDeletionPlanResponseDataWorkspacesItem;
export type DeletionPlan = AccountDeletionPlanResponseData;

export const WITHDRAWAL_REASON_CODES = Object.values(
  DeleteAccountRequestReasonCode
);
export type WithdrawalReasonCode = DeleteAccountRequestReasonCode;

/** 탈퇴 확인 문구. 서버도 앞뒤 공백만 걷고 정확히 같은지 본다. */
export const WITHDRAWAL_CONFIRMATION = "회원 탈퇴";
export const WITHDRAWAL_DETAIL_MAX = 500;

export type { DeleteAccountRequest };
export type DeleteWorkspaceRequest = WorkspaceNameConfirmationRequest;

export const DELETION_PLAN_QUERY_KEY = getGetDeletionPlanQueryKey();

export function useDeletionPlan(enabled: boolean) {
  return useQuery({
    queryKey: DELETION_PLAN_QUERY_KEY,
    enabled,
    // 열 때마다 지금 상태로 다시 받는다 — 그사이 멤버가 나가면 처리가 바뀐다.
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const plan = okData(await getDeletionPlan({ signal }));
      if (!plan) throw new Error("처리 목록을 불러오지 못했습니다.");
      return plan;
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationKey: ["deleteAccount"],
    meta: { suppressErrorToast: true },
    mutationFn: (data: DeleteAccountRequest) => deleteAccount(data),
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
      deleteWorkspace(workspaceId, data),
  });
}

/** 확인 입력이 맞는가. 서버와 같은 규칙 — 앞뒤 공백만 걷고 정확히 같아야 한다. */
export function confirmationMatches(input: string, expected: string) {
  return input.trim() === expected.trim() && expected.trim().length > 0;
}
