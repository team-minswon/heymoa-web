import "server-only";

import { dehydrate, type DehydratedState } from "@tanstack/react-query";

import { getServerApiRequestOptions } from "@/lib/api/server-request";
import { getGetActionItemsQueryOptions } from "@/lib/api/generated/action-items/action-items";
import {
  getGetNoteQueryOptions,
  getGetNotesQueryOptions,
} from "@/lib/api/generated/notes/notes";
import { getGetNotificationsQueryOptions } from "@/lib/api/generated/notifications/notifications";
import {
  getGetProjectQueryOptions,
  getGetProjectsQueryOptions,
} from "@/lib/api/generated/projects/projects";
import { getGetNoteTranscriptQueryOptions } from "@/lib/api/generated/transcription/transcription";
import {
  getGetWorkspaceQueryOptions,
  getGetWorkspacesQueryOptions,
} from "@/lib/api/generated/workspaces/workspaces";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { makeQueryClient } from "@/lib/query/query-client";

export async function prefetchWorkspaceShell({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<DehydratedState> {
  const queryClient = makeQueryClient();

  // Browser MSW starts after hydration and cannot fulfill Server Component
  // requests. Keep the server snapshot empty in mock mode so both sides agree.
  if (shouldEnableMocking()) {
    return dehydrate(queryClient);
  }

  const request = await getServerApiRequestOptions();
  const workspaceTasks = [
    queryClient.prefetchQuery(
      getGetWorkspacesQueryOptions({ request: request })
    ),
    queryClient.prefetchQuery(
      getGetWorkspaceQueryOptions(workspaceId, { request: request })
    ),
    queryClient.prefetchQuery(
      getGetProjectsQueryOptions(workspaceId, { request: request })
    ),
  ];

  await Promise.allSettled(workspaceTasks);
  return dehydrate(queryClient);
}

export async function prefetchNoteRoute({
  workspaceId,
  noteId,
}: {
  workspaceId: string;
  noteId: string;
}): Promise<DehydratedState> {
  const queryClient = makeQueryClient();

  if (shouldEnableMocking()) {
    return dehydrate(queryClient);
  }

  const request = await getServerApiRequestOptions();

  const noteTask = queryClient.fetchQuery(
    getGetNoteQueryOptions(noteId, { request: request })
  );
  const transcriptTask = queryClient.prefetchQuery(
    getGetNoteTranscriptQueryOptions(noteId, { request: request })
  );
  const [noteResult] = await Promise.all([
    noteTask.catch(() => null),
    transcriptTask.catch(() => undefined),
  ]);

  if (
    noteResult?.status === 200 &&
    noteResult.data.success &&
    noteResult.data.data.projectId
  ) {
    await queryClient.prefetchQuery(
      getGetProjectQueryOptions(workspaceId, noteResult.data.data.projectId, {
        request: request,
      })
    );
  }

  return dehydrate(queryClient);
}

/**
 * 첫 화면 데이터는 서버 스냅샷에 담는다. 안 담으면 주소로 바로 들어왔을 때 스켈레톤을
 * 한 번 거치고 브라우저가 다시 조회한다 — 이 레포의 규약이다.
 */
export async function prefetchActionItems(
  workspaceId: string
): Promise<DehydratedState> {
  const queryClient = makeQueryClient();
  if (shouldEnableMocking()) return dehydrate(queryClient);

  const request = await getServerApiRequestOptions();
  await queryClient
    .prefetchQuery(
      getGetActionItemsQueryOptions(workspaceId, { status: "OPEN" }, { request })
    )
    .catch(() => undefined);
  return dehydrate(queryClient);
}

export async function prefetchProjectTimeline(
  projectId: string
): Promise<DehydratedState> {
  const queryClient = makeQueryClient();
  if (shouldEnableMocking()) return dehydrate(queryClient);

  const request = await getServerApiRequestOptions();
  await queryClient
    .prefetchQuery(
      getGetNotesQueryOptions(projectId, { sort: "scheduledAt_asc" }, { request })
    )
    .catch(() => undefined);
  return dehydrate(queryClient);
}

export async function prefetchInbox(): Promise<DehydratedState> {
  const queryClient = makeQueryClient();
  if (shouldEnableMocking()) return dehydrate(queryClient);

  const request = await getServerApiRequestOptions();
  await queryClient
    .prefetchQuery(getGetNotificationsQueryOptions({ request }))
    .catch(() => undefined);
  return dehydrate(queryClient);
}
