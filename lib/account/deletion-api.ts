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
  type DeleteAccountRequest,
  type WorkspaceNameConfirmationRequest,
} from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";

export type DeletionPlanWorkspace =
  AccountDeletionPlanResponseDataWorkspacesItem;
export type DeletionPlan = AccountDeletionPlanResponseData;

export const WITHDRAWAL_REASON_CODES = Object.values(
  DeleteAccountRequestReasonCode
);
export type WithdrawalReasonCode = DeleteAccountRequestReasonCode;

/** 탈퇴 확인 문구입니다. 서버도 앞뒤 공백만 걷고 정확히 같은지 봅니다. */
export const WITHDRAWAL_CONFIRMATION = "회원 탈퇴";
export const WITHDRAWAL_DETAIL_MAX = 500;

type DeleteWorkspaceRequest = WorkspaceNameConfirmationRequest;

const DELETION_PLAN_QUERY_KEY = getGetDeletionPlanQueryKey();

export function useDeletionPlan(enabled: boolean) {
  return useQuery({
    queryKey: DELETION_PLAN_QUERY_KEY,
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const plan = okData(await getDeletionPlan({ signal }));
      if (!plan) throw new Error("Deletion plan response was empty");
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

export function confirmationMatches(input: string, expected: string) {
  return input.trim() === expected.trim() && expected.trim().length > 0;
}
