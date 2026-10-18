import { useQueryClient } from "@tanstack/react-query";

import { errorMessageOf } from "@/lib/api/error-message";
import { useRenameWorkspaceGuest } from "@/lib/api/generated/workspaces/workspaces";
import {
  holdsGuestName,
  writeGuestName,
} from "@/lib/workspace/guest-name-cache";

/**
 * 사람별 요청 상태. **컴포넌트 밖에 둔다** — 설정의 다른 섹션에 갔다 오면 행이 다시 마운트되는데, `scope` 는 요청을
 * 계속 한 줄로 세우므로 앞 요청을 모르는 새 훅이 같은 사람의 뒤 요청을 처리하면 순서·롤백 기준이 어긋난다.
 */
const renames = new Map<string, { inFlight: number; confirmed: string }>();

/**
 * 임시 참여자 이름을 **낙관적으로** 바꾼다 (APP-1194).
 *
 * - 요청 전에 이름 사본을 먼저 고쳐 바로 보인다(`onMutate`).
 * - 성공하면 응답의 값(서버가 정규화한 이름)을 같은 사본에 쓴다. **재조회로 덮지 않는다.**
 * - 실패하면 **마지막으로 서버가 확인한 이름**으로 되돌린다. 문구는 이름 변경 대화상자가 그 안에 그린다(APP-1210) —
 *   그래서 전역 토스트는 끈다.
 *
 * 같은 사람에 대한 요청은 `scope` 로 한 줄에 세운다 — 연달아 고쳐도 서버에는 누른 순서대로 간다. 큐에 서 있는
 * 요청도 `onMutate` 는 바로 돌아 화면은 즉시 따라온다. 그래서 **실패한 요청이 뒤에 더 서 있으면 되돌리지 않는다**
 * (뒤 요청이 곧 이름을 덮어쓴다). 확인된 이름은 앞 요청이 성공할 때마다 갱신된다.
 *
 * 훅을 임시 참여자 한 명(행)마다 건다 — `scope` 가 사람마다 달라야 서로 다른 사람의 요청이 줄 서지 않는다.
 */
export function useRenameGuest({
  workspaceId,
  guestId,
  displayName,
}: {
  workspaceId: string;
  guestId: string;
  /** 지금 화면이 그리는 이름. 요청이 하나도 안 떠 있을 때 이 값이 서버가 확인한 이름이다. */
  displayName: string;
}) {
  const queryClient = useQueryClient();

  function rollback() {
    // 이 요청은 아직 세어져 있다(`onSettled` 에서 뺀다). 자기 말고 더 서 있으면 그쪽이 덮어쓴다.
    if ((renames.get(guestId)?.inFlight ?? 0) > 1) return;
    writeGuestName(queryClient, {
      guestId,
      displayName: renames.get(guestId)?.confirmed ?? displayName,
    });
  }

  const mutation = useRenameWorkspaceGuest({
    mutation: {
      meta: { suppressErrorToast: true },
      scope: { id: `rename-workspace-guest:${guestId}` },
      onMutate: async (variables) => {
        const state = renames.get(guestId) ?? {
          inFlight: 0,
          confirmed: displayName,
        };
        if (state.inFlight === 0) state.confirmed = displayName;
        state.inFlight += 1;
        renames.set(guestId, state);
        // 이름 변경 전에 떠 있던 조회가 늦게 도착해 새 이름을 옛 값으로 덮지 못하게 끊는다.
        await queryClient.cancelQueries({
          predicate: (query) => holdsGuestName(query.queryKey),
        });
        writeGuestName(queryClient, {
          guestId,
          displayName: variables.data?.displayName.trim() ?? displayName,
        });
      },
      onSuccess: (response) => {
        // 200 이 아니거나 success:false 면 실패와 같다 — 낙관적 이름을 되돌린다.
        if (response.status !== 200 || !response.data.success) {
          rollback();
          return;
        }
        const state = renames.get(guestId);
        if (state) state.confirmed = response.data.data.displayName;
        // 뒤에 더 서 있으면 그 요청의 낙관적 이름이 화면의 진실이다 — 앞 응답으로 덮으면 잠깐 되돌아간다.
        if ((renames.get(guestId)?.inFlight ?? 0) > 1) return;
        writeGuestName(queryClient, {
          guestId,
          displayName: response.data.data.displayName,
        });
      },
      onError: () => rollback(),
      onSettled: () => {
        const state = renames.get(guestId);
        if (!state) return;
        state.inFlight -= 1;
        if (state.inFlight <= 0) renames.delete(guestId);
      },
    },
  });

  return {
    isPending: mutation.isPending,
    /** 응답까지 기다린다. 실패하면 사람에게 보일 문구, 성공하면 null. */
    rename: async (nextName: string): Promise<string | null> => {
      try {
        const response = await mutation.mutateAsync({
          workspaceId,
          guestId,
          data: { displayName: nextName.trim() },
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
