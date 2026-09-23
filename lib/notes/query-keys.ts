/**
 * 노트 목록 **둘 다**. 프로젝트 단위와 워크스페이스 단위가 같은 행을 그린다.
 *
 * **워크스페이스 키를 빼면 아무 소리도 안 난다** (APP-685). 「모든 노트」 화면이 종료 상태·
 * 바뀐 제목·지운 행을 다음 폴링까지 들고 있을 뿐이라, 에러도 경고도 없이 낡은 목록만 남는다.
 * 할 일 쪽에서 같은 자리를 먼저 밟고도 노트 쪽을 안 고쳤다 — `query-keys.test.ts` 가 지킨다.
 */
const NOTE_LIST_QUERY_PATTERNS = [
  /^\/v1\/projects\/[^/]+\/notes$/,
  /^\/v1\/workspaces\/[^/]+\/notes$/,
];

export function isNoteListQueryKey(queryKey: readonly unknown[]) {
  return (
    typeof queryKey[0] === "string" &&
    NOTE_LIST_QUERY_PATTERNS.some((pattern) =>
      pattern.test(queryKey[0] as string)
    )
  );
}

const WORKSPACE_GUESTS_QUERY_PATTERN = /^\/v1\/workspaces\/[^/]+\/guests$/;

/**
 * 워크스페이스의 임시 참여자 목록.
 *
 * **워크스페이스 id 없이 지목해야 하는 자리가 있다.** 전사에서 임시 참여자를 만드는 곳은
 * 노트만 알고 있는데, 그때 이 목록도 낡는다 — 설정과 참석자 필드가 후보를 여기서 세운다.
 */
export function isWorkspaceGuestsQueryKey(queryKey: readonly unknown[]) {
  return (
    typeof queryKey[0] === "string" &&
    WORKSPACE_GUESTS_QUERY_PATTERN.test(queryKey[0])
  );
}

const NOTE_QUERY_PATTERN = /^\/v1\/notes\/[^/]+$/;
const NOTE_TRANSCRIPT_QUERY_PATTERN = /^\/v1\/notes\/[^/]+\/transcript$/;

/**
 * 회의록 하나. **연동처럼 「어느 회의가 바뀌었는지 다 셀 수 없는」 변경이 쓴다** — 응답의
 * 회의 목록은 100건에서 잘려서, 그것만 짚으면 나머지가 옛 이름을 들고 남는다.
 */
export function isNoteQueryKey(query: { queryKey: readonly unknown[] }) {
  return (
    typeof query.queryKey[0] === "string" &&
    NOTE_QUERY_PATTERN.test(query.queryKey[0])
  );
}

export function isNoteTranscriptQueryKey(query: {
  queryKey: readonly unknown[];
}) {
  return (
    typeof query.queryKey[0] === "string" &&
    NOTE_TRANSCRIPT_QUERY_PATTERN.test(query.queryKey[0])
  );
}
