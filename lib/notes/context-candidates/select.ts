import type { getContextCandidatesResponse } from "@/lib/api/generated/context-candidates/context-candidates";
import {
  contextCandidateSnapshotSchema,
  type ContextCandidateSnapshot,
} from "@/lib/notes/context-candidates/contract";

/**
 * 생성 훅 응답에서 후보 snapshot 을 꺼낸다.
 *
 * **봉투가 두 겹이다.** 생성 훅은 `{ status, data, headers }` 로 한 번 감싸고, 그 `data` 가
 * 서버의 `{ success, data, error }` 봉투다. 한 겹만 벗기면 `candidates` 가 `undefined` 라
 * 레일이 늘 빈다 — 손으로 부르던 시절 실제로 그렇게 비었다.
 *
 * **`status` 를 먼저 좁힌다.** 생성 반환 타입은 200·401·404 의 union 인데 런타임에는 성공만
 * 여기 온다 — `apiFetch` 가 non-ok 를 던져서 실패는 `isError` 로 빠진다
 * (`lib/api/fetcher.ts`: `if (!response.ok) throw responseData`).
 *
 * 그 어긋남을 그냥 두면 `parse(unknown)` 이 union 을 통째로 삼켜서 **타입이 거짓말을 해도
 * 컴파일이 통과한다.** 좁혀 두면 계약이 성공 응답 형태를 바꾸는 순간 여기서 걸린다.
 *
 * **zod 를 한 번 더 지나는 이유** — 생성 타입은 컴파일 시점 약속이지 런타임 검사가 아니다.
 * 서버가 형태를 바꾸면 화면이 조용히 비는 것보다 여기서 먼저 깨지는 편이 낫다. WS 경로도
 * 같은 스키마로 파싱하므로 두 경로의 판정이 갈리지 않는다.
 */
export function selectContextSnapshot(
  response: getContextCandidatesResponse
): ContextCandidateSnapshot {
  if (response.status !== 200) {
    throw new Error(`예상 못 한 후보 조회 응답: ${response.status}`);
  }
  return contextCandidateSnapshotSchema.parse(response.data.data);
}
