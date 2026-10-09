"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import {
  getGetNotesQueryKey,
  type getNotesResponse,
  useCreateNote,
} from "@/lib/api/generated/notes/notes";

/**
 * "새 노트" 진입점의 단일 출처 —
 * 노트 생성 → 목록 낙관 갱신 → full 라우팅.
 * 워크스페이스 셸 컨텍스트(선택 프로젝트·프로젝트 목록) 안에서만 쓴다.
 */
export function useCreateMeeting(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createNote = useCreateNote();
  const { selectedProjectId, projects } = useWorkspaceShell();

  const targetProjectId = selectedProjectId ?? projects[0]?.projectId;
  const disabled = createNote.isPending || !targetProjectId;

  /** 실제로 만들어졌으면 true. 호출부는 이 값으로만 다이얼로그를 닫는다. */
  const createMeeting = async (title: string): Promise<boolean> => {
    if (!targetProjectId) return false;
    const response = await createNote.mutateAsync({
      projectId: targetProjectId,
      data: { title },
    });
    if (
      response.status !== 201 ||
      !response.data.success ||
      !response.data.data
    ) {
      return false;
    }
    const createdNote = response.data.data;
    const noteId = createdNote.noteId;
    // 같은 프로젝트의 목록 캐시를 **전부** 고친다 — 쪽 수가 키에 들어가므로(`useNoteListPages`) 키 하나를
    // 짚으면 쪽 수가 다른 사본이 낡은 채 남는다. 캐시에 없는 키는 그냥 지나간다.
    queryClient.setQueriesData<getNotesResponse>(
      { queryKey: getGetNotesQueryKey(targetProjectId) },
      (current) => {
        if (current?.status !== 200 || !current.data.success) return current;
        return {
          ...current,
          data: {
            ...current.data,
            data: {
              ...current.data.data,
              notes: [
                {
                  ...createdNote,
                  lastRecordedAt: null,
                  recordedDurationMs: 0,
                },
                ...current.data.data.notes.filter(
                  (note) => note.noteId !== noteId
                ),
              ],
            },
          },
        };
      }
    );

    // 안 읽어 둔 목록이면 이 노트 하나로 채워 둔다 — 목록 화면이 처음 열릴 때 빈 화면이 안 비치게.
    // 서버 응답이 오면 덮인다.
    const baseKey = getGetNotesQueryKey(targetProjectId);
    if (queryClient.getQueryData(baseKey) === undefined) {
      queryClient.setQueryData<getNotesResponse>(baseKey, {
        status: 200,
        headers: response.headers,
        data: {
          success: true,
          error: null,
          data: {
            notes: [
              { ...createdNote, lastRecordedAt: null, recordedDurationMs: 0 },
            ],
            hasMore: false,
            nextNoteId: null,
            nextSortedAt: null,
          },
        },
      });
    }

    // `tab`을 안 붙인다 — 어차피 전사가 기본 탭이고, 붙여 두면 "기록하러 왔다"는 뜻으로
    // 읽힌다. 새 노트는 NOT_STARTED라 「회의 시작」을 눌러야 기록이 시작된다.
    router.push(`/w/${workspaceId}/notes/${noteId}?view=full`);

    return true;
  };

  return {
    createMeeting,
    disabled,
    isPending: createNote.isPending,
  };
}
