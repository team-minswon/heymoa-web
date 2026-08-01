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
    const notesQueryKey = getGetNotesQueryKey(targetProjectId);

    queryClient.setQueryData<getNotesResponse>(notesQueryKey, (current) => {
      const existingNotes =
        current?.status === 200 && current.data.success
          ? current.data.data.notes
          : [];

      return {
        status: 200,
        headers: current?.headers ?? response.headers,
        data: {
          success: true,
          error: null,
          data: {
            notes: [
              {
                ...createdNote,
                lastRecordedAt: null,
                recordedDurationMs: 0,
              },
              ...existingNotes.filter((note) => note.noteId !== noteId),
            ],
          },
        },
      };
    });

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
