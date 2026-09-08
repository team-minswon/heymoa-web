/**
 * 수동 쿼리 키. 계약이 `openapi3.yml` 에 들어오면 orval 이 같은 뜻의 키 함수를 만들고
 * 이 파일은 사라진다 — `api.ts` 와 같은 수명이다(`ADAPTER.md`).
 */
export function getMeetingReviewQueryKey(noteId: string) {
  return ["/v1/notes/:noteId/meeting-review", noteId] as const;
}

export function getMeetingApprovalQueryKey(noteId: string) {
  return ["/v1/notes/:noteId/meeting-approval", noteId] as const;
}

export function getConceptSummaryQueryKey(projectId: string) {
  return ["/v1/projects/:projectId/concept-summary", projectId] as const;
}
