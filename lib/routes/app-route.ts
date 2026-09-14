export function isWorkspaceRoute(pathname: string) {
  return pathname === "/w" || pathname.startsWith("/w/");
}

/**
 * 마케팅 내비게이션과 푸터를 세우지 않는 경로. 두 게이트가 같은 목록을 따로 들면 한쪽만 고쳐져
 * 머리는 없는데 발만 남는다.
 *
 * 인증 콜백은 그릴 것이 없고, 워크스페이스는 제품 셸이 크롬을 갖고, 목 미리보기는 제품 화면을
 * 제 머리글 아래 틀로 띄운다.
 */
export function isChromelessRoute(pathname: string) {
  return (
    pathname === "/auth/callback" ||
    pathname === "/mock-review" ||
    isWorkspaceRoute(pathname)
  );
}
