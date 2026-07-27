"use client";

import { useMutationState } from "@tanstack/react-query";

/**
 * orval이 `useChangeDefaultWorkspace`에 박는 mutation key (`lib/api/generated/workspaces/workspaces.ts`).
 * 값이 바뀌면 아래 훅이 조용히 아무것도 안 잠그므로 `default-workspace.test.ts`가 산출물과 대조한다.
 */
export const CHANGE_DEFAULT_MUTATION_KEY = ["changeDefaultWorkspace"];

/**
 * 지금 기본으로 지정되는 중인 워크스페이스 id. 없으면 null.
 *
 * **전역 mutation 상태에서 읽는 이유**는 이 명령을 부르는 자리가 둘이기 때문이다 —
 * 내 계정의 기본 워크스페이스 목록(APP-237)과 워크스페이스 설정의 카드. 각자 자기
 * `isPending`만 보면 설정 탭을 옮기는 것만으로 두 번째 요청이 나가고, 어느 쪽이 최종
 * 기본값인지가 서버 처리 순서에 달린다. 지역 state는 언마운트되면 잠금도 함께 풀린다.
 */
export function usePendingDefaultWorkspaceId(): string | null {
  return (
    useMutationState({
      filters: { mutationKey: CHANGE_DEFAULT_MUTATION_KEY, status: "pending" },
      select: (mutation) =>
        (mutation.state.variables as { data?: { workspaceId?: string } })?.data
          ?.workspaceId ?? null,
    })[0] ?? null
  );
}
