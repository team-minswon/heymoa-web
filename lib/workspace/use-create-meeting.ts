"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { usePersonalChat } from "@/components/chat/personal-chat";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import {
  getGetNotesQueryKey,
  type getNotesResponse,
  useCreateNote,
} from "@/lib/api/generated/notes/notes";

export function useCreateMeeting(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createNote = useCreateNote({
    request: { timeoutMs: REQUEST_TIMEOUT_MS },
  });
  const { selectedProjectId, projects } = useWorkspaceShell();
  const { startFreshChat } = usePersonalChat();

  const defaultProjectId = selectedProjectId ?? projects[0]?.projectId;
  const disabled = createNote.isPending || !defaultProjectId;

  const createMeeting = async (
    title: string,
    projectId?: string
  ): Promise<boolean> => {
    const targetProjectId = projectId ?? defaultProjectId;
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
                  pausedAt: null,
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
              {
                ...createdNote,
                lastRecordedAt: null,
                recordedDurationMs: 0,
                pausedAt: null,
              },
            ],
            hasMore: false,
            nextNoteId: null,
            nextSortedAt: null,
          },
        },
      });
    }

    startFreshChat();

    router.push(`/w/${workspaceId}/notes/${noteId}?view=full`);

    return true;
  };

  return {
    createMeeting,
    disabled,
    isPending: createNote.isPending,
  };
}
