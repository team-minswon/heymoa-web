/**
 * 푸터에 싣는 사업자 정보(전자상거래법 표시 사항). 사업자 등록 전이라 모두 비어 있고, 상호가 비어 있으면 푸터가 블록을 그리지 않는다.
 * 값이 정해지면 여기만 채운다. 라벨은 `landing.footer.business`.
 */
export const BUSINESS_INFO = {
  name: "",
  owner: "",
  registration: "",
  mailOrder: "",
  address: "",
  phone: "",
  email: "",
  hosting: "",
};

export type BusinessInfo = typeof BUSINESS_INFO;
