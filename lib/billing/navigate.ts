/**
 * 카드 제출 뒤 등록 결과 화면으로 간다. 문서를 새로 열어 입력 칸의 카드 정보가 메모리에서도 사라진다.
 * jsdom 이 이동을 못 해서 시험이 이 모듈을 바꿔 끼운다.
 */
export function goToSetupResult(setupId: string) {
  window.location.assign(`/billing/setups/${setupId}`);
}
