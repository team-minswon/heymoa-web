"use client";

import { useQueries } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";

import { useRecording } from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  getGetNotesQueryOptions,
  useCreateNote,
  useGetNotes,
} from "@/lib/api/generated/notes/notes";
import { useGetProjects } from "@/lib/api/generated/projects/projects";

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const recording = useRecording();
  const createNote = useCreateNote();
  const { selectedProjectId } = useWorkspaceShell();
  const projectsQuery = useGetProjects(workspaceId);
  const projects =
    projectsQuery.data?.status === 200 && projectsQuery.data.data.success
      ? (projectsQuery.data.data.data.projects ?? [])
      : [];
  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId
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
    singleNotesQuery.data?.status === 200 &&
    singleNotesQuery.data.data.success
      ? (singleNotesQuery.data.data.data.notes ?? [])
      : [];
  const notes: NoteListResponseDataNotesItem[] = selectedProjectId
    ? selectedNotes
    : allNotesQueries.notes;
  const isPending = selectedProjectId
    ? singleNotesQuery.isPending
    : projectsQuery.isPending || allNotesQueries.isPending;
  const isError = selectedProjectId
    ? singleNotesQuery.isError
    : projectsQuery.isError || allNotesQueries.isError;

  const handleCreateMeeting = async () => {
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
    const noteId = response.data.data.noteId;
    router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=transcript`);
    await recording.start(noteId);
  };

  const retry = () => {
    if (selectedProjectId) {
      void singleNotesQuery.refetch();
      return;
    }
    void projectsQuery.refetch();
    allNotesQueries.refetch();
  };

  return (
    <section className="mx-auto min-h-full w-full max-w-[1320px] bg-card px-4 py-7 sm:px-8 lg:px-12 xl:px-16">
      <header className="mb-8 flex flex-col gap-5 border-b border-[var(--el-hairline)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--el-muted)]">
            Meeting notes
          </p>
          <h2 className="mt-2 font-serif text-4xl font-light tracking-[-0.035em] text-[var(--el-ink)]">
            {selectedProject?.name ?? "모든 회의"}
          </h2>
          <p className="mt-2 text-sm text-[var(--el-muted)]">
            {notes.length}개의 회의 기록
          </p>
        </div>
        <Button
          className="rounded-full"
          loading={createNote.isPending}
          disabled={!targetProjectId}
          onClick={() => void handleCreateMeeting()}
        >
          <Mic /> 새 회의
        </Button>
      </header>
      <WorkspaceNoteList
        workspaceId={workspaceId}
        notes={notes}
        isPending={isPending}
        isError={isError}
        onRetry={retry}
        onCreateMeeting={() => void handleCreateMeeting()}
      />
    </section>
  );
}
