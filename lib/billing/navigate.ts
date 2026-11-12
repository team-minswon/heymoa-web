/**
 * 등록 결과 화면으로 간다. **문서를 새로 연다**(하드 내비게이션) — 입력 칸의 카드 정보가 메모리에서도 사라진다(APP-1600).
 * 카드 입력은 이동이 아니라 모달(`components/billing/card-entry-dialog.tsx`)이다. jsdom 이 이동을 못 해서 시험이 이 모듈을 바꿔 끼운다.
 */
export function goToSetupResult(setupId: string) {
  window.location.assign(`/billing/setups/${setupId}`);
}

/** 카드를 받을 상태가 아닌 등록으로 카드 입력 화면에 들어왔을 때. 뒤로 가기로 다시 오지 않게 기록을 바꾼다. */
export function replaceWithSetupResult(setupId: string) {
  window.location.replace(`/billing/setups/${setupId}`);
}
