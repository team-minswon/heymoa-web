/**
 * 결제 대행 서비스 이용약관 본문(APP-1600). 주문서·카드 변경의 「내용 보기」 창이 그대로 그린다. 문구 파일(`messages/`)이 아니라
 * 여기 두는 까닭: 대행사가 준 약관 원문이라 화면 문구처럼 다듬지 않고 통째로 바꾼다.
 *
 * TODO(배포 전): 결제 대행사(나이스페이)와 계약한 뒤 제공받은 약관 원문으로 채운다. 지금은 자리만 있다.
 */
export const PG_TERMS: Record<"ko" | "en", string[]> = {
  ko: ["결제 대행사와 계약한 뒤 제공받은 약관을 넣습니다."],
  en: [
    "The terms provided by the payment provider will be added after the contract is signed.",
  ],
};
