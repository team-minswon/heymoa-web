import type { QueryClient } from "@tanstack/react-query";

import {
  getGetAnalysisFlowQueryKey,
  type getAnalysisFlowResponse,
} from "@/lib/api/generated/analysis/analysis";
import type { MeetingAnalysisFlowResponseDataStatus } from "@/lib/api/generated/models";

/**
 * 흐름 상태를 얼마마다 다시 물을까. 끝나는 시각을 모르는 단계는 자주, 사람을 기다리는 단계(분석 실패 ·
 * 검토 가능)도 드물게 묻는다 — 다른 참석자가 다시 요청하거나 확정한 것이 열린 화면에 옮겨 와야 한다.
 * 확정 뒤와 분석 흐름 밖의 노트는 더 바뀌지 않는다.
 */
export function flowPollInterval(status: MeetingAnalysisFlowResponseDataStatus | null): number | false {
  switch (status) {
    case "DIARIZING":
    case "NOT_REQUESTED":
    case "ANALYZING":
      return 3_000;
    case "ANALYSIS_FAILED":
    case "REVIEWABLE":
      return 15_000;
    default:
      return false;
  }
}

/**
 * 흐름 상태를 바꾸는 요청(분석 재요청 · 확정)이 받아들여지면 캐시의 상태를 먼저 옮긴다. 뒤따르는 재조회가
 * 실패해도 화면이 옛 상태(분석 실패 · 검토 가능)에 머물러 이미 끝난 조작을 다시 내밀지 않게 한다.
 * 서버 값으로의 수렴은 호출부의 재조회가 맡는다.
 */
export function moveFlowStatus(
  queryClient: QueryClient,
  noteId: string,
  status: MeetingAnalysisFlowResponseDataStatus
) {
  queryClient.setQueryData<getAnalysisFlowResponse>(getGetAnalysisFlowQueryKey(noteId), (previous) =>
    previous?.status === 200 && previous.data.success
      ? ({ ...previous, data: { ...previous.data, data: { ...previous.data.data, status } } } as getAnalysisFlowResponse)
      : previous
  );
}
