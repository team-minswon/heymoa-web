/**
 * 결제 흐름의 문서 이동(APP-1600). 둘 다 **문서를 새로 연다**(하드 내비게이션). 첫 구독 결제 페이지는 분석 스크립트가 없는
 * 루트 레이아웃이라 앞 문서에 실린 스크립트를 데려가지 않아야 하고, 결과 화면으로 갈 때는 입력 칸의 카드 정보가 메모리에서도
 * 사라진다. 카드 변경은 이동이 아니라 모달(`components/billing/card-change-dialog.tsx`)이다. jsdom 이 이동을 못 해서 시험이
 * 이 모듈을 바꿔 끼운다.
 */
export function goToCheckout(workspaceId: string) {
  window.location.assign(`/billing/checkout/${workspaceId}`);
}

export function goToSetupResult(setupId: string) {
  window.location.assign(`/billing/setups/${setupId}`);
}
