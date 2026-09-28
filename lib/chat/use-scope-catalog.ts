"use client";

import { useQueries } from "@tanstack/react-query";

import { getGetNotesQueryOptions } from "@/lib/api/generated/notes/notes";
import { useGetProjects } from "@/lib/api/generated/projects/projects";

/** 피커가 고를 수 있는 것 하나. */
export type ScopeCandidate = {
  kind: "note" | "project";
  id: string;
  title: string;
  /** 회의록일 때 그것이 속한 프로젝트. 겹침 안내가 추가 조회 없이 이 값으로 판정한다. */
  projectId?: string;
};

/** 피커가 한 번에 그리는 묶음. */
export type ScopeSection = { label: string; items: ScopeCandidate[] };

/**
 * 질의에 맞는 후보만 추린다. 결과가 비면 컴포저가 피커를 닫아 Enter 가 문장으로 돌아간다.
 * 질의는 공백을 품고(「알림 정책」), 양끝 공백은 떼고 본다.
 */
export function matchScope(
  candidates: { projects: ScopeCandidate[]; notes: ScopeCandidate[] },
  query: string,
  taken: Set<string>
): ScopeSection[] {
  const needle = query.trim().toLowerCase();
  const match = (each: ScopeCandidate) =>
    !taken.has(`${each.kind}:${each.id}`) &&
    (needle === "" || each.title.toLowerCase().includes(needle));
  // 섹션 순서는 「프로젝트」 → 「회의록」이다(design.pen).
  return [
    { label: "프로젝트", items: candidates.projects.filter(match).slice(0, 5) },
    { label: "회의록", items: candidates.notes.filter(match).slice(0, 8) },
  ].filter((section) => section.items.length > 0);
}

/**
 * `@` 피커가 고를 수 있는 것 전부. 워크스페이스 전체 회의록을 주는 공개 엔드포인트가 없어
 * 프로젝트 수만큼 조회가 나간다. `workspace-page.tsx` 와 같은 팬아웃이라 캐시를 함께 쓴다.
 * 프로젝트가 수십 개로 늘면 `/v1/workspaces/{id}/notes` 를 만든다.
 */
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
    // 회의록은 방금 끝난 것을 다시 묻는 일이 많아 최근 것이 위로 온다.
    notes: [...notes.items]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(
        (note): ScopeCandidate => ({
          kind: "note",
          id: note.noteId,
          title: note.title,
          projectId: note.projectId,
        })
      ),
    isPending: projectsQuery.isPending || notes.isPending,
  };
}
