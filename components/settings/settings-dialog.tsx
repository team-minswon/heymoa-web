/**
 * 설정은 라우트다(`/w/{workspaceId}/settings/*`). 전면 다이얼로그였던 AS-IS 를 걷어냈다 —
 * 연동은 OAuth 로 브라우저가 밖에 나갔다 오는데, 모달은 URL 이 없어 돌아올 자리가 없었다.
 *
 * 이 타입만 남는다: 유저 메뉴 같은 호출부가 「어느 절로 갈지」를 말하는 어휘다.
 */
export type SettingsSection =
  | "account"
  | "workspace"
  | "members"
  | "integrations";
