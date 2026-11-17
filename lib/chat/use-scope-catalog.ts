"use client";

import { useQueries } from "@tanstack/react-query";

import { getGetNotesQueryOptions } from "@/lib/api/generated/notes/notes";
import { useGetProjects } from "@/lib/api/generated/projects/projects";

export type ScopeCandidate = {
  kind: "note" | "project";
  id: string;
  title: string;
  projectId?: string;
  at?: string;
};

export type ScopeSection = {
  kind: ScopeCandidate["kind"];
  items: ScopeCandidate[];
};

export function matchScope(
  candidates: { projects: ScopeCandidate[]; notes: ScopeCandidate[] },
  query: string,
  taken: Set<string>
): ScopeSection[] {
  const needle = query.trim().toLowerCase();
  const match = (each: ScopeCandidate) =>
    !taken.has(`${each.kind}:${each.id}`) &&
    (needle === "" || each.title.toLowerCase().includes(needle));
  return [
    {
      kind: "project" as const,
      items: candidates.projects.filter(match).slice(0, 5),
    },
    {
      kind: "note" as const,
      items: candidates.notes.filter(match).slice(0, 8),
    },
  ].filter((section) => section.items.length > 0);
}

export function useScopeCatalog(workspaceId: string, enabled: boolean) {
  const projectsQuery = useGetProjects(workspaceId, {
    query: { enabled },
  });
  const projects =
    projectsQuery.data?.status === 200 && projectsQuery.data.data.success
      ? (projectsQuery.data.data.data.projects ?? [])
      : [];

  const notes = useQueries({
    queries: enabled
      ? projects.map((project) => getGetNotesQueryOptions(project.projectId))
      : [],
    combine: (results) => ({
      items: results.flatMap((result) =>
        result.data?.status === 200 && result.data.data.success
          ? (result.data.data.data.notes ?? [])
          : []
      ),
      isPending: results.some((result) => result.isPending),
    }),
  });

  return {
    projects: projects.map(
      (project): ScopeCandidate => ({
        kind: "project",
        id: project.projectId,
        title: project.name,
      })
    ),
    notes: [...notes.items]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(
        (note): ScopeCandidate => ({
          kind: "note",
          id: note.noteId,
          title: note.title,
          projectId: note.projectId,
          at: note.meetingStartedAt ?? note.createdAt,
        })
      ),
    isPending: projectsQuery.isPending || notes.isPending,
  };
}
