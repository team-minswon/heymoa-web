"use client";

import { useQueries } from "@tanstack/react-query";

import { getGetNotesQueryOptions } from "@/lib/api/generated/notes/notes";
import { useGetProjects } from "@/lib/api/generated/projects/projects";

/** 피커가 고를 수 있는 것 하나. */
export type ScopeCandidate = {
  kind: "note" | "project";
  id: string;
  title: string;
  /** 회의록일 때 그것이 속한 프로젝트. 겹침 안내가 이 값으로 판정한다 — 추가 조회 0. */
  projectId?: string;
};

/** 피커가 한 번에 그리는 묶음. 비어 있으면 **피커를 열 이유가 없다.** */
export type ScopeSection = { label: string; items: ScopeCandidate[] };

/**
 * 질의에 맞는 후보만 추린다.
 *
 * **피커를 여는 조건이기도 하다.** 결과가 비면 컴포저가 피커를 닫고, 그러면 Enter 가
 * 문장으로 돌아간다 — 「고를 것이 없는데 Enter 가 먹히는」 구간이 안 생긴다.
 * 반대로 맞는 것이 하나라도 있으면 Enter 는 그것을 고르는 키다.
 *
 * 질의는 공백을 품는다(`MENTION`). 「알림 정책」처럼 두 낱말로 좁히는 것이 흔해서다.
 * 양끝 공백은 떼고 본다 — 「알림 」에서 피커가 닫히면 안 된다.
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
  // design.pen: 섹션은 「프로젝트」 → 「회의록」 순서다.
  return [
    { label: "프로젝트", items: candidates.projects.filter(match).slice(0, 5) },
    { label: "회의록", items: candidates.notes.filter(match).slice(0, 8) },
  ].filter((section) => section.items.length > 0);
}

/**
 * `@` 피커가 고를 수 있는 것 전부.
 *
 * **워크스페이스 전체 회의록을 한 번에 주는 공개 엔드포인트가 없다.** `/v1/projects/{id}/notes`
 * 뿐이라 프로젝트 수만큼 조회가 나간다 — 워크스페이스 화면(`workspace-page.tsx`)이 이미
 * 같은 팬아웃을 쓰고 있어서 캐시를 함께 쓴다.
 *
 * 프로젝트가 수십 개로 늘면 이 팬아웃이 먼저 아프다. 그때 `/v1/workspaces/{id}/notes`를
 * 만든다 — ai 쪽에는 이미 `/internal/v1/workspaces/{id}/notes`로 있다.
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
    // 최근에 만진 것이 위로. 회의록은 방금 끝난 것을 다시 묻는 일이 압도적으로 많다.
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
