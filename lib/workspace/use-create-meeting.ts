"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useRecording } from "@/components/transcription/recording-provider";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import {
  getGetNotesQueryKey,
  type getNotesResponse,
  useCreateNote,
} from "@/lib/api/generated/notes/notes";

const ACTIVE_RECORDING_PHASES = [
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
];

/**
 * "새 노트" 진입점의 단일 출처. 상단바와 허브 빈 상태가 같은 로직을 쓴다 —
 * 노트 생성 → 목록 낙관 갱신 → side 라우팅 → 녹음 시작. 이미 녹음 중이면 그 노트로 이동한다.
 * 워크스페이스 셸 컨텍스트(선택 프로젝트·프로젝트 목록) 안에서만 쓴다.
 */
export function useCreateMeeting(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recording = useRecording();
  const createNote = useCreateNote();
  const { selectedProjectId, projects } = useWorkspaceShell();

  const targetProjectId = selectedProjectId ?? projects[0]?.projectId;
  const isRecordingActive = ACTIVE_RECORDING_PHASES.includes(recording.phase);
  const activeRecordingNoteId = isRecordingActive
    ? (recording.activeNoteId ?? recording.session?.noteId)
    : undefined;
  const disabled =
    createNote.isPending ||
    !targetProjectId ||
    (isRecordingActive && !activeRecordingNoteId);

  const createMeeting = async () => {
    if (isRecordingActive) {
      if (activeRecordingNoteId) {
        router.push(
          `/w/${workspaceId}/notes/${activeRecordingNoteId}?view=side&tab=transcript`
        );
      }
      return;
    }
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

    router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=transcript`);
    await recording.start(noteId);
  };

  return {
    createMeeting,
    disabled,
    isPending: createNote.isPending,
    /** 이미 녹음 중이면 버튼이 "현재 녹음"으로 바뀌고 그 노트로 이동한다. */
    isRecordingCurrent: Boolean(activeRecordingNoteId),
  };
}
