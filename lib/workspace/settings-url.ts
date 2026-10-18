/**
 * 설정 창을 주소(`?settings=<section>`)에 남기는 길 하나.
 *
 * 같은 화면 안의 상태라 라우터가 아니라 `history.pushState/replaceState` 다(rule `architecture`) —
 * Next 16 이 라우터와 통합해 `useSearchParams` 를 갱신하고 RSC 왕복은 안 나간다.
 * 주소는 호출 시점의 `window.location` 에서 읽어 `settings` 만 더하거나 빼므로
 * `newMeeting`·노트 `view`·`tab` 같은 다른 쿼리와 해시는 그대로 남는다.
 */
export const SETTINGS_SECTIONS = [
  "account",
  "workspace",
  "members",
  "guests",
  "terms",
  "integrations",
  "workspaceAgents",
  "agents",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_PARAM = "settings";

/** 없는 값·권한 없는 값이 열릴 때의 탭. */
export const DEFAULT_SETTINGS_SECTION: SettingsSection = "workspace";

/** 모르는 값이면 `null`. */
export function parseSettingsSection(
  value: string | null
): SettingsSection | null {
  return SETTINGS_SECTIONS.find((section) => section === value) ?? null;
}

function hrefWith(section: SettingsSection | null, drop: string[] = []) {
  const { pathname, search, hash } = window.location;
  const params = new URLSearchParams(search);
  for (const key of drop) params.delete(key);
  if (section) params.set(SETTINGS_PARAM, section);
  else params.delete(SETTINGS_PARAM);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

/** 창을 연다 — 방문 기록을 하나 쌓아 뒤로 가기 한 번에 닫힌다. */
export function pushSettings(section: SettingsSection) {
  window.history.pushState(null, "", hrefWith(section));
}

/** 탭을 바꾼다 — 기록을 안 쌓는다. `drop` 은 같이 걷을 쿼리(OAuth 복귀의 `provider`·`status`). */
export function replaceSettings(section: SettingsSection, drop?: string[]) {
  window.history.replaceState(null, "", hrefWith(section, drop));
}

/** 기록을 안 쌓고 `settings` 만 지운다. */
export function clearSettings() {
  window.history.replaceState(null, "", hrefWith(null));
}

/** 주소에 `settings` 가 있는가. 렌더가 아니라 지금의 주소를 본다. */
export function hasSettingsParam() {
  return new URLSearchParams(window.location.search).has(SETTINGS_PARAM);
}
