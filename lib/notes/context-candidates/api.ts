import { apiFetch } from "@/lib/api/fetcher";
import {
  contextCandidateSnapshotSchema,
  type ContextCandidateSnapshot,
} from "@/lib/notes/context-candidates/contract";

/**
 * 후보 snapshot 조회.
 *
 * **왜 생성 훅이 아닌가** — `openapi3.yml`에 이 경로가 아직 없어서 orval이 훅을 못 만든다.
 * 계약이 들어오면 이 파일은 사라지고 호출부가 `useGetNoteContextCandidates`로 바뀐다.
 * 그때까지도 **`fetch()`를 직접 쓰지 않고 공용 mutator를 지난다** — 401 → refresh → 재시도가
 * 거기 있고, 그걸 우회하면 이 조회만 토큰 만료에서 조용히 실패한다.
 *
 * 응답을 zod로 한 번 통과시킨다. draft 계약이라 server가 형태를 바꾸면 여기서 먼저 깨지는
 * 편이 화면이 조용히 비는 것보다 낫다.
 */
export async function fetchContextCandidates(
  noteId: string
): Promise<ContextCandidateSnapshot> {
  // **봉투가 두 겹이다.** `apiFetch` 가 `{ data, status, headers }` 로 한 번 감싸고, 그 `data`
  // 가 서버의 `{ success, data, error }` 봉투다. 생성 훅도 `res.data.data` 로 읽는다 —
  // 한 겹으로 읽으면 `success` 가 `undefined` 라 늘 실패한다(실제로 그렇게 비었다).
  const response = await apiFetch<{
    status: number;
    data: { success: boolean; data: unknown; error: unknown };
  }>(`/v1/notes/${noteId}/context-candidates`);

  if (!response.data?.success) {
    throw new Error("context candidates request failed");
  }
  return contextCandidateSnapshotSchema.parse(response.data.data);
}
