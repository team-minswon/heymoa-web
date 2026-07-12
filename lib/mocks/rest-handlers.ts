import type {
  CreateNoteRequest,
  CreateWorkspaceRequest,
  FolderNameRequest,
  UpdateCurrentUserRequest,
  UpdateNoteRequest,
  UpdateWorkspaceRequest,
} from "@/lib/api/generated/models";
import { getListWorkspaceFoldersMockHandler } from "@/lib/api/generated/folder/folder.msw";
import { getListWorkspaceNotesMockHandler } from "@/lib/api/generated/note/note.msw";
import {
  getGetActiveTranscriptionSessionMockHandler,
  getListNoteTranscriptSegmentsMockHandler,
  getListNoteTranscriptionSessionsMockHandler,
} from "@/lib/api/generated/transcription/transcription.msw";
import { HttpResponse, http } from "msw";

import { mockDb } from "@/lib/mocks/db";

const statusByCode: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  WORKSPACE_NOT_FOUND: 404,
  NOTE_NOT_FOUND: 404,
  FOLDER_NOT_FOUND: 404,
  TRANSCRIPTION_SESSION_NOT_FOUND: 404,
  TRANSCRIPT_SEGMENT_NOT_FOUND: 404,
  FOLDER_NAME_ALREADY_EXISTS: 409,
  ACTIVE_TRANSCRIPTION_SESSION_EXISTS: 409,
  INVALID_TRANSCRIPTION_SESSION_STATE: 409,
  STT_PROVIDER_UNAVAILABLE: 503,
};

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

function pageOptions(request: Request) {
  const url = new URL(request.url);
  return {
    cursor: url.searchParams.get("cursor"),
    limit: Number(url.searchParams.get("limit") ?? 20),
  };
}

function success<T>(data: T) {
  return { success: true as const, data };
}

function unit() {
  return { success: true as const, data: null };
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
  return HttpResponse.json(
    {
      success: false as const,
      error: {
        code,
        message: code,
        details: null,
      },
    },
    { status: statusByCode[code] ?? 500 }
  );
}

function withStore<T>(operation: () => T) {
  try {
    return HttpResponse.json(success(operation()), { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export const restHandlers = [
  http.get("*/v1/users/me", () =>
    HttpResponse.json(success(mockDb.getCurrentUser()))
  ),
  http.patch("*/v1/users/me", async ({ request }) => {
    const body = (await request.json()) as UpdateCurrentUserRequest;
    return withStore(() => mockDb.updateCurrentUser(body));
  }),
  http.get("*/v1/workspaces", () =>
    HttpResponse.json(success(mockDb.listWorkspaces()))
  ),
  http.post("*/v1/workspaces", async ({ request }) => {
    const body = (await request.json()) as CreateWorkspaceRequest;
    return withStore(() => mockDb.createWorkspace(body));
  }),
  http.get("*/v1/workspaces/:workspaceId", ({ params }) =>
    withStore(() => mockDb.getWorkspace(id(params.workspaceId)))
  ),
  http.patch("*/v1/workspaces/:workspaceId", async ({ request, params }) => {
    const body = (await request.json()) as UpdateWorkspaceRequest;
    return withStore(() =>
      mockDb.updateWorkspace(id(params.workspaceId), body)
    );
  }),
  http.put("*/v1/workspaces/:workspaceId/default", ({ params }) =>
    withStore(() => mockDb.setDefaultWorkspace(id(params.workspaceId)))
  ),
  getListWorkspaceNotesMockHandler(({ request, params }) => {
    const url = new URL(request.url);
    return success(
      mockDb.listNotes(id(params.workspaceId), {
        ...pageOptions(request),
        folderId: url.searchParams.get("folderId"),
      })
    );
  }),
  http.post(
    "*/v1/workspaces/:workspaceId/notes",
    async ({ request, params }) => {
      const body = (await request.json()) as CreateNoteRequest;
      return withStore(() => mockDb.createNote(id(params.workspaceId), body));
    }
  ),
  http.get("*/v1/notes/:noteId", ({ params }) =>
    withStore(() => mockDb.getNote(id(params.noteId)))
  ),
  http.put("*/v1/notes/:noteId", async ({ request, params }) => {
    const body = (await request.json()) as UpdateNoteRequest;
    return withStore(() => mockDb.updateNote(id(params.noteId), body));
  }),
  http.delete("*/v1/notes/:noteId", ({ params }) => {
    try {
      mockDb.deleteNote(id(params.noteId));
      return HttpResponse.json(unit());
    } catch (error) {
      return errorResponse(error);
    }
  }),
  getListWorkspaceFoldersMockHandler(({ params }) =>
    success(mockDb.listFolders(id(params.workspaceId)))
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/folders",
    async ({ request, params }) => {
      const body = (await request.json()) as FolderNameRequest;
      return withStore(() => mockDb.createFolder(id(params.workspaceId), body));
    }
  ),
  http.put("*/v1/folders/:folderId", async ({ request, params }) => {
    const body = (await request.json()) as FolderNameRequest;
    return withStore(() => mockDb.updateFolder(id(params.folderId), body));
  }),
  http.delete("*/v1/folders/:folderId", ({ params }) => {
    try {
      mockDb.deleteFolder(id(params.folderId));
      return HttpResponse.json(unit());
    } catch (error) {
      return errorResponse(error);
    }
  }),
  http.put("*/v1/notes/:noteId/folders/:folderId", ({ params }) =>
    withStore(() => mockDb.attachFolder(id(params.noteId), id(params.folderId)))
  ),
  http.delete("*/v1/notes/:noteId/folders/:folderId", ({ params }) =>
    withStore(() => mockDb.detachFolder(id(params.noteId), id(params.folderId)))
  ),
  http.post("*/v1/notes/:noteId/transcription-sessions", ({ params }) => {
    return withStore(() => {
      const session = mockDb.createSession(id(params.noteId));
      return {
        session,
        socketUrl: `ws://localhost:8080/v1/transcription-sessions/${session.sessionId}/stream?ticket=mock-ticket`,
        ticketExpiresAt: "2026-07-11T09:01:00Z",
      };
    });
  }),
  getListNoteTranscriptionSessionsMockHandler(({ request, params }) =>
    success(mockDb.listSessions(id(params.noteId), pageOptions(request)))
  ),
  getGetActiveTranscriptionSessionMockHandler(
    success({ session: mockDb.getActiveSession() })
  ),
  http.get("*/v1/transcription-sessions/:sessionId", ({ params }) =>
    withStore(() => mockDb.getSession(id(params.sessionId)))
  ),
  http.post(
    "*/v1/transcription-sessions/:sessionId/connection-ticket",
    ({ params }) =>
      withStore(() => {
        const session = mockDb.getSession(id(params.sessionId));
        return {
          session,
          socketUrl: `ws://localhost:8080/v1/transcription-sessions/${session.sessionId}/stream?ticket=mock-ticket`,
          ticketExpiresAt: "2026-07-11T09:01:00Z",
        };
      })
  ),
  getListNoteTranscriptSegmentsMockHandler(({ request, params }) =>
    success(mockDb.listSegments(id(params.noteId), pageOptions(request)))
  ),
  http.delete("*/v1/transcript-segments/:segmentId", ({ params }) => {
    try {
      mockDb.deleteSegment(id(params.segmentId));
      return HttpResponse.json(unit());
    } catch (error) {
      return errorResponse(error);
    }
  }),
];
