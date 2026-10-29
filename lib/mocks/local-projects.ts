import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { mockDb } from "@/lib/mocks/db";

/**
 * 로컬 전용 목 프로젝트. `public/mock-local/projects.json`(git 에 없다)이 있으면 그 프로젝트와 회의를 목 사이드바·노트 목록에
 * 올리고, 안건 지도는 프로젝트마다 그 응답을 돌려준다. 파일이 없으면 아무 일도 하지 않는다. 실제 팀 데이터를 레포에 두지 않으면서
 * 실제 모양으로 화면을 보려는 길이다. 파일은 `[{ projectId, workspaceId?, name, description?, links }]` 이고 `links` 는
 * `GET /v1/projects/{projectId}/meeting-links` 응답의 `data` 다.
 */
export type LocalProject = {
  projectId: string;
  workspaceId?: string;
  name: string;
  description?: string | null;
  links: ProjectMeetingLinksResponseData;
};

let projects: LocalProject[] = [];

/** 모양이 맞는 항목만 남긴다(잘못된 항목은 건너뛴다). 하나도 안 맞으면 빈 목록이라 기본 목이 그대로 쓰인다 */
export function parseLocalProjects(body: unknown): LocalProject[] {
  if (!Array.isArray(body)) return [];
  return body.filter((item): item is LocalProject => {
    if (typeof item !== "object" || item === null) return false;
    const { projectId, name, links } = item as Partial<LocalProject>;
    return typeof projectId === "string" && typeof name === "string" && typeof links === "object" && links !== null && Array.isArray(links.notes);
  });
}

export const localProjects = () => projects;

export const localProjectLinks = (projectId: string) =>
  projects.find((project) => project.projectId === projectId)?.links ?? null;

/** 목 워커가 켜지기 전에 한 번 읽는다. 없거나 깨졌으면 조용히 건너뛴다. */
export async function loadLocalProjects() {
  try {
    const response = await fetch("/mock-local/projects.json", { cache: "no-store" });
    if (!response.ok) return;
    const body: unknown = await response.json();
    const valid = parseLocalProjects(body);
    if (valid.length === 0) return;
    mockDb.applyLocalSeed(
      valid.map((project) => ({
        projectId: project.projectId,
        workspaceId: project.workspaceId,
        name: project.name,
        description: project.description ?? null,
        notes: project.links.notes.map((note) => ({
          noteId: note.noteId,
          title: note.title,
          startedAt: note.startedAt,
        })),
      }))
    );
    // 시드가 문제없이 들어간 뒤에만 반영한다(중간에 실패하면 기본 목 그대로)
    projects = valid;
  } catch {
    // 파일이 없는 것이 보통이다.
  }
}
