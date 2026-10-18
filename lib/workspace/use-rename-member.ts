import { useQueryClient } from "@tanstack/react-query";

import { errorMessageOf } from "@/lib/api/error-message";
import { useRenameWorkspaceMember } from "@/lib/api/generated/workspace-members/workspace-members";
import { inWorkspace } from "@/lib/workspace/guest-name-cache";
import {
  cachedMemberName,
  holdsMemberName,
  writeMemberName,
  type MemberName,
} from "@/lib/workspace/member-name-cache";

/** 사람별 요청 상태. 컴포넌트 밖에 두는 이유는 `use-rename-guest` 와 같다. 열쇠는 워크스페이스+사람이다. */
const renames = new Map<string, { inFlight: number; confirmed: MemberName }>();

/**
 * 멤버의 워크스페이스 표시 이름을 **낙관적으로** 바꾼다 (APP-1206). 규칙은 임시 참여자(`useRenameGuest`)와 같다.
 *
 * - 요청 전에 이름 사본을 먼저 고쳐 바로 보인다. 빈 값은 「계정 이름으로 되돌림」이라 계정 이름을 미리 쓴다.
 * - 성공하면 응답의 값(서버가 정규화한 이름)을 같은 사본에 쓴다. **재조회로 덮지 않는다.**
 * - 실패하면 마지막으로 서버가 확인한 모습으로 되돌린다. 문구는 대화상자가 그 안에 그린다 — 전역 토스트는 끈다.
 */
export function useRenameMember({
  workspaceId,
  member,
}: {
  workspaceId: string;
  /** 지금 화면이 그리는 모습. 요청이 하나도 안 떠 있을 때 이 값이 서버가 확인한 모습이다. */
  member: MemberName;
}) {
  const queryClient = useQueryClient();
  const key = `${workspaceId}:${member.userId}`;

  function rollback() {
    if ((renames.get(key)?.inFlight ?? 0) > 1) return;
    writeMemberName(
      queryClient,
      workspaceId,
      renames.get(key)?.confirmed ?? member
    );
  }

  const mutation = useRenameWorkspaceMember({
    mutation: {
      meta: { suppressErrorToast: true },
      scope: { id: `rename-workspace-member:${key}` },
      onMutate: async (variables) => {
        // 되돌릴 기준은 대화상자를 연 순간이 아니라 **지금 캐시**다 — 연 뒤에 목록이 새 이름을 받았으면 그것이 확인된 값이다.
        const current =
          cachedMemberName(queryClient, workspaceId, member.userId) ?? member;
        const state = renames.get(key) ?? { inFlight: 0, confirmed: current };
        if (state.inFlight === 0) state.confirmed = current;
        state.inFlight += 1;
        renames.set(key, state);
        await queryClient.cancelQueries({
          predicate: inWorkspace(queryClient, workspaceId, holdsMemberName),
        });
        const next = variables.data?.displayName?.trim() || null;
        writeMemberName(queryClient, workspaceId, {
          ...current,
          name: next ?? current.accountName,
          displayName: next,
        });
      },
      onSuccess: async (response) => {
        if (response.status !== 200 || !response.data.success) {
          rollback();
          return;
        }
        const saved = response.data.data;
        const confirmed: MemberName = {
          userId: saved.userId,
          name: saved.name,
          displayName: saved.displayName ?? null,
          accountName: saved.accountName ?? saved.name,
        };
        const state = renames.get(key);
        if (state) state.confirmed = confirmed;
        if ((state?.inFlight ?? 0) > 1) return;
        // 저장 중에 새로 시작한 조회는 저장 전 값을 읽었을 수 있다 — 끊고 응답을 쓴다.
        await queryClient.cancelQueries({
          predicate: inWorkspace(queryClient, workspaceId, holdsMemberName),
        });
        writeMemberName(queryClient, workspaceId, confirmed);
      },
      onError: () => rollback(),
      onSettled: () => {
        const state = renames.get(key);
        if (!state) return;
        state.inFlight -= 1;
        if (state.inFlight <= 0) renames.delete(key);
      },
    },
  });

  return {
    isPending: mutation.isPending,
    /** 응답까지 기다린다. 빈 값은 계정 이름으로 되돌린다. 실패하면 문구, 성공하면 null. */
    rename: async (nextName: string): Promise<string | null> => {
      const trimmed = nextName.trim();
      try {
        const response = await mutation.mutateAsync({
          workspaceId,
          userId: member.userId,
          data: { displayName: trimmed.length > 0 ? trimmed : null },
        });
        return response.status === 200 && response.data.success
          ? null
          : "이름을 바꾸지 못했습니다.";
      } catch (error) {
        return errorMessageOf(error, "이름을 바꾸지 못했습니다.");
      }
    },
  };
}

/**
 * 멤버 목록 항목을 [MemberName] 으로 읽는다. **서버가 아직 `displayName`·`accountName` 을 안 줘도**(배포 전) 깨지지 않게
 * 계정 이름은 `name`, 표시 이름은 없음으로 본다.
 */
export function memberNameOf(item: {
  userId: string;
  name: string;
  displayName?: string | null;
  accountName?: string | null;
}): MemberName {
  return {
    userId: item.userId,
    name: item.name,
    displayName: item.displayName ?? null,
    accountName: item.accountName ?? item.name,
  };
}
