/**
 * 후보 조회 쿼리 키. 계약이 `openapi3.yml`에 들어오면 orval이 같은 이름의 키 함수를 만들고
 * 이 파일은 그 재수출이 된다 — `contract.ts`와 같은 수명이다.
 */
export function getContextCandidatesQueryKey(noteId: string) {
  return ["/v1/notes/:noteId/context-candidates", noteId] as const;
}

export function getContextCandidateRevisionsQueryKey(
  noteId: string,
  candidateId: string
) {
  return [
    "/v1/notes/:noteId/context-candidates/:candidateId/revisions",
    noteId,
    candidateId,
  ] as const;
}
