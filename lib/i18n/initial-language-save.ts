/**
 * 로그인 뒤 계정 초기값 저장(`LanguageSync`)이 진행 중인지. 설정의 언어 탭이 자기 저장 전에 기다린다(APP-1285).
 *
 * 두 저장은 같은 `PATCH /v1/users/me` 라 서버에 닿는 순서가 보장되지 않는다. 초기값이 늦게 닿으면 방금 고른 언어를
 * 옛 화면 언어로 되돌린다. 문서마다 한 번만 쓰이는 값이라 모듈 상태로 둔다 — 언어를 바꾸면 문서를 새로 연다.
 */
let pending: Promise<unknown> | null = null;

export function trackInitialLanguageSave<T>(save: Promise<T>): Promise<T> {
  const tracked: Promise<unknown> = save.then(
    () => undefined,
    () => undefined
  );
  pending = tracked;
  void tracked.then(() => {
    if (pending === tracked) pending = null;
  });
  return save;
}

/** 진행 중인 초기값 저장이 끝날 때까지 기다린다. 실패해도 기다림은 끝난다. */
export function initialLanguageSaveSettled(): Promise<void> {
  return (pending ?? Promise.resolve()).then(
    () => undefined,
    () => undefined
  );
}
