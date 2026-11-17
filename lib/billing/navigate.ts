/** 문서를 새로 엽니다(하드 내비게이션). jsdom 이 이동을 못 해서 시험이 이 모듈을 바꿔 끼웁니다. */
export function goToCheckout(workspaceId: string) {
  window.location.assign(`/billing/checkout/${workspaceId}`);
}

export function goToSetupResult(setupId: string) {
  window.location.assign(`/billing/setups/${setupId}`);
}
