/** Next 16 은 `history.pushState/replaceState` 를 라우터와 통합해 `useSearchParams` 를 갱신하고 RSC 왕복은 안 나갑니다. */
export const SETTINGS_SECTIONS = [
  "account",
  "myPayments",
  "language",
  "workspace",
  "members",
  "guests",
  "terms",
  "integrations",
  "workspaceAgents",
  "billing",
  "payment",
  "agents",
  "notifications",
  "appUpdates",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_PARAM = "settings";

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "workspace";

export function parseSettingsSection(
  value: string | null
): SettingsSection | null {
  return SETTINGS_SECTIONS.find((section) => section === value) ?? null;
}

export function hrefWithParam(
  key: string,
  value: string | null,
  drop: string[] = []
) {
  const { pathname, search, hash } = window.location;
  const params = new URLSearchParams(search);
  for (const name of drop) params.delete(name);
  if (value) params.set(key, value);
  else params.delete(key);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

const hrefWith = (section: SettingsSection | null, drop?: string[]) =>
  hrefWithParam(SETTINGS_PARAM, section, drop);

export function pushSettings(section: SettingsSection) {
  window.history.pushState(null, "", hrefWith(section));
}

export function replaceSettings(section: SettingsSection, drop?: string[]) {
  window.history.replaceState(null, "", hrefWith(section, drop));
}

export function clearSettings() {
  window.history.replaceState(null, "", hrefWith(null));
}

export function hasSettingsParam() {
  return new URLSearchParams(window.location.search).has(SETTINGS_PARAM);
}
