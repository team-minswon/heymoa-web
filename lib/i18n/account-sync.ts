import type { Locale } from "./locales";

export type LanguageSyncAction = {
  /** 브라우저 `heymoa-lang` 쿠키에 쓸 값. 이미 같으면 없다. */
  cookie?: Locale;
  /** 계정(`PATCH /v1/users/me`)에 저장할 값. 계정에 값이 있으면 없다. */
  account?: Locale;
};

/**
 * 로그인한 제품 화면이 처음 뜬 뒤 계정과 쿠키를 한 번 맞춘다(APP-1285).
 *
 * - 계정 값이 있으면 그것이 정본이다. 쿠키만 계정 값으로 맞춰 로그아웃 뒤 랜딩도 같은 언어로 뜬다. 다른 기기에서
 *   고른 값을 로그인 전 선택으로 덮어쓰지 않는다.
 * - 계정이 비어 있으면 지금 화면 언어(쿠키, 없으면 브라우저 언어로 정한 초기 기본값)를 계정에 한 번 넣는다.
 *   server 가 회의·채팅을 시작할 때 계정 값으로 AI 언어를 고정하므로, 화면만 영어이고 계정이 비면 첫 회의 요약이
 *   한국어로 만들어진다.
 */
export function decideLanguageSync({
  account,
  cookie,
  screen,
}: {
  account: Locale | null;
  cookie: Locale | null;
  screen: Locale;
}): LanguageSyncAction {
  if (account) {
    return cookie === account ? {} : { cookie: account };
  }
  return cookie === screen ? { account: screen } : { account: screen, cookie: screen };
}
