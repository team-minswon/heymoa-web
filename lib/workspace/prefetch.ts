import "server-only";

import { dehydrate, type DehydratedState } from "@tanstack/react-query";

import { getServerApiRequestOptions } from "@/lib/api/server-request";
import { getGetNoteQueryOptions } from "@/lib/api/generated/notes/notes";
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
