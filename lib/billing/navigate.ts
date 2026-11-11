/** 카드 등록(PG 인증 페이지)으로 떠난다. jsdom 이 이동을 못 해서 시험이 이 모듈을 바꿔 끼운다. */
export function leaveToCardRegistration(url: string) {
  window.location.assign(url);
}
