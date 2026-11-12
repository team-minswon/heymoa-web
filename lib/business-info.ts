/**
 * 푸터에 싣는 사업자 정보(전자상거래법 표시 사항). 상호가 비어 있으면 푸터가 블록을 그리지 않고, 값이 빈 항목은 건너뛴다.
 * 값은 사업자등록증(2026-11-12 발급) 그대로다. 통신판매업 신고번호는 신고 뒤에 채운다 — 결제 대행사의 구매안전서비스
 * 이용확인증이 있어야 신고할 수 있다. 라벨은 `landing.footer.business`.
 */
export const BUSINESS_INFO = {
  name: "헤이모아",
  owner: "이민형",
  registration: "267-13-02974",
  mailOrder: "",
  address: "부산광역시 연제구 고분로 200, 111동 104호(연산동, 연산엘지아파트)",
  phone: "010-4887-4960",
  email: "lmh01048874960@gmail.com",
  hosting: "Vercel Inc.",
};

export type BusinessInfo = typeof BUSINESS_INFO;
