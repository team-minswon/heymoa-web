import { HttpResponse, http } from "msw";
import { mockDb } from "@/lib/mocks/db";

import { getGetCurrentUserMockHandler } from "@/lib/api/generated/users/users.msw";
import {
  getGetWorkspacesMockHandler,
  getCreateWorkspaceMockHandler,
  getGetWorkspaceMockHandler,
  getUpdateWorkspaceMockHandler,
  getChangeDefaultWorkspaceMockHandler,
} from "@/lib/api/generated/workspaces/workspaces.msw";
import {
  getGetProjectsMockHandler,
  getCreateProjectMockHandler,
  getGetProjectMockHandler,
  getUpdateProjectMockHandler,
} from "@/lib/api/generated/projects/projects.msw";
import {
  getGetNoteMockHandler,
  getUpdateNoteMockHandler,
  getGetNotesMockHandler,
  getCreateNoteMockHandler,
} from "@/lib/api/generated/notes/notes.msw";
import {
  getGetTranscriptionSessionMockHandler,
  getGetNoteTranscriptMockHandler,
} from "@/lib/api/generated/transcription/transcription.msw";

import type {
  CreateWorkspaceRequest,
  ProjectRequest,
  NoteRequest,
  UpdateWorkspaceRequest,
} from "@/lib/api/generated/models";

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

export const restHandlers = [
  // Users
  getGetCurrentUserMockHandler(() => ({
    success: true,
    data: mockDb.getCurrentUser(),
    error: null,
  })),

  // Workspaces
  getGetWorkspacesMockHandler(() => ({
    success: true,
    data: { workspaces: mockDb.listWorkspaces() },
    error: null,
  })),
  getCreateWorkspaceMockHandler(async ({ request }) => {
    try {
      const body = (await request.json()) as CreateWorkspaceRequest;
      const data = mockDb.createWorkspace(body);
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
          details: null,
        },
      };
    }
  }),
  getGetWorkspaceMockHandler(({ params }) => {
    try {
      const data = mockDb.getWorkspace(id(params.workspaceId));
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "워크스페이스를 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),
  getUpdateWorkspaceMockHandler(async ({ request, params }) => {
    try {
      const body = (await request.json()) as UpdateWorkspaceRequest;
      const data = mockDb.updateWorkspace(id(params.workspaceId), body);
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
          details: null,
        },
      };
    }
  }),
  getChangeDefaultWorkspaceMockHandler(({ params }) => {
    try {
      const data = mockDb.setDefaultWorkspace(id(params.workspaceId));
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "워크스페이스를 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),

  // Projects
  getGetProjectsMockHandler(({ params }) => {
    try {
      const projects = mockDb.listProjects(id(params.workspaceId));
      return { success: true, data: { projects }, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "워크스페이스를 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),
  getCreateProjectMockHandler(async ({ request, params }) => {
    try {
      const body = (await request.json()) as ProjectRequest;
      const data = mockDb.createProject(id(params.workspaceId), body);
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
          details: null,
        },
      };
    }
  }),
  getGetProjectMockHandler(({ params }) => {
    try {
      const data = mockDb.getProject(id(params.workspaceId), id(params.projectId));
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "프로젝트를 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),
  getUpdateProjectMockHandler(async ({ request, params }) => {
    try {
      const body = (await request.json()) as ProjectRequest;
      const data = mockDb.updateProject(
        id(params.workspaceId),
        id(params.projectId),
        body
      );
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
          details: null,
        },
      };
    }
  }),
  // Hand-written (not the Orval getDeleteProjectMockHandler): needs 204/409
  // status codes the generated wrapper can't express.
  http.delete(
    "*/v1/workspaces/:workspaceId/projects/:projectId",
    async ({ params }) => {
      try {
        mockDb.deleteProject(id(params.workspaceId), id(params.projectId));
        return new HttpResponse(null, { status: 204 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        if (msg === "PROJECT_HAS_NOTES") {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: {
                code: "PROJECT_HAS_NOTES",
                message: "노트가 있는 프로젝트는 삭제할 수 없습니다.",
                details: null,
              },
            },
            { status: 409 }
          );
        }
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: msg,
              message: msg,
              details: null,
            },
          },
          { status: 404 }
        );
      }
    }
  ),

  // Notes
  getGetNotesMockHandler(({ params }) => {
    try {
      const notes = mockDb.listNotes(id(params.projectId));
      return { success: true, data: { notes }, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "프로젝트를 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),
  getCreateNoteMockHandler(async ({ request, params }) => {
    try {
      const body = (await request.json()) as NoteRequest;
      const data = mockDb.createNote(id(params.projectId), body);
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
          details: null,
        },
      };
    }
  }),
  getGetNoteMockHandler(({ params }) => {
    try {
      const data = mockDb.getNote(id(params.noteId));
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "NOTE_NOT_FOUND",
          message: "노트를 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),
  getUpdateNoteMockHandler(async ({ request, params }) => {
    try {
      const body = (await request.json()) as NoteRequest;
      const data = mockDb.updateNote(id(params.noteId), body);
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
          details: null,
        },
      };
    }
  }),

  // Transcription
  getGetTranscriptionSessionMockHandler(({ params }) => {
    try {
      const data = mockDb.getSession(id(params.sessionId));
      return { success: true, data, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "TRANSCRIPTION_SESSION_NOT_FOUND",
          message: "전사 세션을 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),
  getGetNoteTranscriptMockHandler(({ params }) => {
    try {
      const segments = mockDb.listSegments(id(params.noteId));
      return { success: true, data: { segments }, error: null };
    } catch {
      return {
        success: false,
        data: null as unknown as never,
        error: {
          code: "NOTE_NOT_FOUND",
          message: "노트를 찾을 수 없습니다.",
          details: null,
        },
      };
    }
  }),
  // Hand-written (not the Orval getStartTranscriptionSessionMockHandler): needs
  // 201/409 status codes the generated wrapper can't express.
  http.post(
    "*/v1/notes/:noteId/transcription-sessions",
    async ({ params }) => {
      try {
        const data = mockDb.createSession(id(params.noteId));
        return HttpResponse.json({ success: true, data, error: null }, { status: 201 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        if (msg === "ACTIVE_TRANSCRIPTION_SESSION") {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: {
                code: "ACTIVE_TRANSCRIPTION_SESSION",
                message: "이미 진행 가능한 전사 세션이 있습니다.",
                details: null,
              },
            },
            { status: 409 }
          );
        }
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: msg,
              message: msg,
              details: null,
            },
          },
          { status: 404 }
        );
      }
    }
  ),
];
