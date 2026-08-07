const STORAGE_KEY = "heymoa:last-workspace";

/**
 * 마지막으로 연 워크스페이스 id. 서버에 없던 `isDefault`를 대신한다(APP-401).
 *
 * **읽는 값을 목록으로 검증하는 것이 이 모듈의 전부다.** 같은 브라우저에서 계정을 바꾸거나,
 * 저장해 둔 워크스페이스에서 추방당하면 그 id는 더 이상 내 것이 아니다 — `pickWorkspaceId`가
 * 목록에 있는지 확인하고 없으면 첫 항목으로 떨어진다. 그래서 키를 유저별로 나누지 않는다.
 * 나눠 봐야 「추방당한 뒤」는 못 막고, 못 막는 것을 막는 척하는 키만 남는다.
 *
 * 목록의 첫 항목이 폴백인 이유는 서버가 **합류한 순서**로 주기 때문이다.
 */
export function readLastWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Safari 프라이빗 모드처럼 localStorage 접근 자체가 던지는 환경이 있다. 목적지를 못 고르는
    // 것과 앱이 터지는 것은 다르다 — 여기서는 「기억이 없다」로 취급하고 첫 항목으로 간다.
    return null;
  }
}

export function rememberWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, workspaceId);
  } catch {
    // 기억하지 못할 뿐이다. 다음 진입은 첫 항목으로 간다.
  }
}

/**
 * 어느 워크스페이스를 열 것인가. 목록이 비면 `undefined` — 부르는 쪽이 그 상태를 그린다.
 *
 * **서버 응답에 기대지 않는다.** 예전에는 `find(isDefault) ?? items[0]`이 다섯 군데에
 * 흩어져 있었고, 그 중 셋의 주석이 서로 다른 이야기를 하고 있었다.
 */
export function pickWorkspaceId(
  items: readonly { workspaceId: string }[]
): string | undefined {
  const remembered = readLastWorkspaceId();
  const match = remembered
    ? items.find((item) => item.workspaceId === remembered)
    : undefined;
  return (match ?? items[0])?.workspaceId;
}

/**
 * 스위처 목록의 순서. **기억한 워크스페이스가 맨 위**이고 나머지는 서버 순서(합류 순)를
 * 그대로 지킨다.
 *
 * `pickWorkspaceId`가 여는 것과 이 함수가 위로 올리는 것이 같은 값이어야 한다 — 다르면
 * 「진입하면 열리는 곳」과 「목록의 첫 줄」이 갈린다. 그래서 두 함수가 같은 모듈에 있다.
 *
 * **정렬이 아니라 hoist다.** 비교 함수로 짜면 나머지 항목의 상대 순서가 구현에 따라 흔들리고,
 * 서버가 합류 순으로 주는 의미가 사라진다.
 *
 * **새 배열을 돌려준다.** 인자는 쿼리 캐시의 배열이라 제자리 정렬하면 캐시를 망친다.
 */
export function sortByLastVisited<T extends { workspaceId: string }>(
  items: readonly T[]
): T[] {
  const remembered = readLastWorkspaceId();
  const index = remembered
    ? items.findIndex((item) => item.workspaceId === remembered)
    : -1;
  // 기억이 없거나(-1) 이미 맨 위면(0) 손댈 것이 없다.
  if (index <= 0) return [...items];
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}
