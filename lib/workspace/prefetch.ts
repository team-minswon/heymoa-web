import "server-only";

import { dehydrate, type DehydratedState } from "@tanstack/react-query";

import { getServerApiRequestOptions } from "@/lib/api/server-request";
import { getGetNoteQueryOptions } from "@/lib/api/generated/notes/notes";
import {
  getGetProjectQueryOptions,
  getGetProjectsQueryOptions,
  getGetProjectTasksQueryOptions,
} from "@/lib/api/generated/projects/projects";
import { okData } from "@/lib/api/ok-data";
import { getGetWorkspaceQueryOptions } from "@/lib/api/generated/workspaces/workspaces";
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
  /**
   * **첫 페인트에 실제로 필요한 둘만 기다린다.**
   *
   * 이 prefetch는 `app/w/[workspaceId]/layout.tsx`가 `await`하므로 여기서 기다리는 시간이
   * 그대로 `/w/**` 모든 진입의 블로킹 구간이고, 그동안 `app/w/loading.tsx`의 골격이 뜬다.
   *
   * **워크스페이스 목록(`getWorkspaces`)은 빼냈다.** 첫 화면이 그것으로 그리는 것이 하나도
   * 없다 — 사이드바 헤더의 이름은 `getWorkspace`(단건)에서 오고, 목록은 상단 전환
   * 드롭다운을 **열 때만** 쓴다. 그 소비자들은 전부 비-suspense `useGetWorkspaces()`거나
   * 자기 `DataBoundary` 안에 있어서(설정 다이얼로그의 `useGetWorkspacesSuspense`) 셸을
   * 매달지 않는다. 하이드레이션 뒤 필요할 때 받아 온다.
   */
  await Promise.allSettled([
    queryClient.prefetchQuery(
      getGetWorkspaceQueryOptions(workspaceId, { request: request })
    ),
    queryClient.prefetchQuery(
      getGetProjectsQueryOptions(workspaceId, { request: request })
    ),
  ]);
  return dehydrate(queryClient);
}

/**
 * 할 일 화면의 주 데이터는 프로젝트마다의 할 일이다. 워크스페이스 단위 조회가 없어 프로젝트 목록을 먼저
 * 읽고 프로젝트마다 받는다. 한 프로젝트가 실패해도 나머지는 그린다 — 실패한 것은 화면이 다시 시도를 둔다.
 */
export async function prefetchTasksRoute({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<DehydratedState> {
  const queryClient = makeQueryClient();

  if (shouldEnableMocking()) {
    return dehydrate(queryClient);
  }

  const request = await getServerApiRequestOptions();
  const projectsResult = await queryClient
    .fetchQuery(getGetProjectsQueryOptions(workspaceId, { request: request }))
    .catch(() => undefined);
  const projects = okData(projectsResult)?.projects ?? [];
  await Promise.allSettled(
    projects.map((project) =>
      queryClient.prefetchQuery(
        getGetProjectTasksQueryOptions(workspaceId, project.projectId, { request: request })
      )
    )
  );
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

  /**
   * **전사를 안 기다린다.** 이 라우트에는 `loading.tsx` 가 없어서, 여기서 await 하는 것이
   * 곧 첫 페인트다 — 브라우저는 이 함수가 끝날 때까지 **이전 화면 그대로** 있는다. 전사가
   * 제일 느린데 그것이 노트를 여는 시간을 통째로 잡고 있었다 (APP-679).
   *
   * 클라이언트가 읽으면 `TranscriptView`·`NoteArchive` 의 스켈레톤이 그 자리를 채운다 —
   * 행 격자까지 실제와 맞춰 둔 것이 이미 있다.
   *
   * `getNote` 는 남긴다. 껍데기(제목·상태·탭 구성)가 그 값에 달려 있어 클라이언트로 미루면
   * 껍데기까지 흔들린다.
   */
  const noteResult = await queryClient
    .fetchQuery(getGetNoteQueryOptions(noteId, { request: request }))
    .catch(() => null);

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
