"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";

import { useRecording } from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  getGetNotesQueryOptions,
  getGetNotesQueryKey,
  type getNotesResponse,
  useCreateNote,
  useGetNotes,
} from "@/lib/api/generated/notes/notes";

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recording = useRecording();
  const createNote = useCreateNote();
  const { selectedProjectId, projects, isWorkspacePending, isWorkspaceError } =
    useWorkspaceShell();
  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId
  );
  const projectNames = Object.fromEntries(
    projects.map((project) => [project.projectId, project.name])
  );
  const targetProjectId = selectedProjectId ?? projects[0]?.projectId;
  const singleNotesQuery = useGetNotes(selectedProjectId ?? "", {
    query: { enabled: selectedProjectId !== null },
  });
  const allNotesQueries = useQueries({
    queries: selectedProjectId
      ? []
      : projects.map((project) => getGetNotesQueryOptions(project.projectId)),
    combine: (results) => ({
      notes: results.flatMap((result) =>
        result.data?.status === 200 && result.data.data.success
          ? (result.data.data.data.notes ?? [])
          : []
      ),
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      refetch: () => results.forEach((result) => void result.refetch()),
    }),
  });
  const selectedNotes =
    singleNotesQuery.data?.status === 200 && singleNotesQuery.data.data.success
      ? (singleNotesQuery.data.data.data.notes ?? [])
      : [];
  const notes: NoteListResponseDataNotesItem[] = selectedProjectId
    ? selectedNotes
    : allNotesQueries.notes;
  const isPending = selectedProjectId
    ? singleNotesQuery.isPending
    : isWorkspacePending || allNotesQueries.isPending;
  const isError = selectedProjectId
    ? singleNotesQuery.isError
    : isWorkspaceError || allNotesQueries.isError;
  const isRecordingActive = [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ].includes(recording.phase);
  const activeRecordingNoteId = isRecordingActive
    ? (recording.activeNoteId ?? recording.session?.noteId)
    : undefined;
  const isCreateMeetingDisabled =
    !targetProjectId || (isRecordingActive && !activeRecordingNoteId);

  const handleCreateMeeting = async () => {
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

  const retry = () => {
    if (selectedProjectId) {
      void singleNotesQuery.refetch();
      return;
    }
    allNotesQueries.refetch();
  };

  return (
    <section className="relative mx-auto min-h-full w-full max-w-4xl overflow-hidden px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 size-72 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--el-gradient-mint) 0%, transparent 68%)",
        }}
      />
      <header className="relative mb-10 flex flex-col gap-7 border-b border-[var(--el-hairline)] pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
            Meeting notes
          </p>
          <h2 className="mt-3 font-serif text-[40px] font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)] sm:text-5xl">
            {selectedProject?.name ?? "모든 회의"}
          </h2>
          <p className="mt-4 text-sm leading-6 text-[var(--el-muted)]">
            {notes.length}개의 회의 기록 · 발화와 결정이 시간순으로 보관됩니다.
          </p>
        </div>
        <Button
          size="xl"
          className="rounded-full px-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          loading={createNote.isPending}
          disabled={isCreateMeetingDisabled}
          onClick={() => void handleCreateMeeting()}
        >
          <Mic /> {activeRecordingNoteId ? "현재 녹음" : "새 회의 기록"}
        </Button>
      </header>
      <WorkspaceNoteList
        workspaceId={workspaceId}
        notes={notes}
        isPending={isPending}
        isError={isError}
        onRetry={retry}
        onCreateMeeting={() => void handleCreateMeeting()}
        projectNames={projectNames}
        createMeetingLabel={
          activeRecordingNoteId ? "현재 녹음" : "새 회의 기록"
        }
        isCreateMeetingDisabled={
          createNote.isPending || isCreateMeetingDisabled
        }
      />
    </section>
  );
}
