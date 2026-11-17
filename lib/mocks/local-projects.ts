import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { mockDb } from "@/lib/mocks/db";

export type LocalProject = {
  projectId: string;
  workspaceId?: string;
  name: string;
  description?: string | null;
  links: ProjectMeetingLinksResponseData;
};

let projects: LocalProject[] = [];

export function parseLocalProjects(body: unknown): LocalProject[] {
  if (!Array.isArray(body)) return [];
  return body.filter((item): item is LocalProject => {
    if (typeof item !== "object" || item === null) return false;
    const { projectId, name, links } = item as Partial<LocalProject>;
    return (
      typeof projectId === "string" &&
      typeof name === "string" &&
      typeof links === "object" &&
      links !== null &&
      Array.isArray(links.notes)
    );
  });
}

export const localProjects = () => projects;

export const localProjectLinks = (projectId: string) =>
  projects.find((project) => project.projectId === projectId)?.links ?? null;

export async function loadLocalProjects() {
  if (process.env.NEXT_PUBLIC_MOCK_LOCAL_PROJECTS === "disabled") return;
  try {
    const response = await fetch("/mock-local/projects.json", {
      cache: "no-store",
    });
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
    projects = valid;
  } catch {}
}
