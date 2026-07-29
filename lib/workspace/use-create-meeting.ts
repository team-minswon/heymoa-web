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

  const createMeeting = async () => {
    if (!targetProjectId) return;
    const response = await createNote.mutateAsync({
      projectId: targetProjectId,
      data: { title: "실시간 기록 노트" },
    });
    if (
      response.status !== 201 ||
      !response.data.success ||
      !response.data.data
    ) {
      return;
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

    router.push(`/w/${workspaceId}/notes/${noteId}?view=full&tab=transcript`);
  };

  return {
    createMeeting,
    disabled,
    isPending: createNote.isPending,
  };
}
