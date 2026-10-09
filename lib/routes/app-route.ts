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
/**
 * 마케팅 `Navbar` · `Footer` 대신 랜딩 상단 바 · 랜딩 푸터(`components/heymoa/landing/`)를 세우는 경로.
 * 위와 같은 이유로 두 게이트가 이것 하나를 같이 본다. 약관 · 개인정보 · 데스크톱 다운로드는 랜딩과 같은 면이라 여기 든다.
 */
export function isLandingChromeRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/download"
  );
}

/**
 * 카드 하나만 세우는 흐름(외부 에이전트 동의 · 초대). 마케팅 크롬 대신 로고 · 로그아웃만 둔 머리글과 약관 링크만 둔 발
 * (`components/layout/focus-chrome.tsx`)을 세운다. 위와 같은 이유로 두 게이트가 이것 하나를 같이 본다.
 */
export function isFocusChromeRoute(pathname: string) {
  return pathname === "/invite" || pathname.startsWith("/oauth/");
}

export function isChromelessRoute(pathname: string) {
  return (
    pathname === "/auth/callback" ||
    pathname === "/mock-review" ||
    isWorkspaceRoute(pathname)
  );
}
