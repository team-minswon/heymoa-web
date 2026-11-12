/**
 * 카드 입력 화면(`/billing/setups/{setupId}/card`, APP-1600)에만 거는 Content-Security-Policy. 카드 번호를 우리 화면에서
 * 받으므로 그 문서에서는 우리 출처의 스크립트만 돌고(인라인은 Next 가 붙이는 nonce 만), 요청은 우리 출처·API 로만 나간다
 * (PCI DSS 6.4.3·11.6.1 의 결제 화면 스크립트 통제). 분석 스크립트는 이 면의 루트 레이아웃이 아예 싣지 않는다(`app/(card-entry)`).
 * nonce 는 `proxy.ts` 가 요청마다 만들고, Next 가 요청 헤더의 CSP 에서 읽어 프레임워크 스크립트에 붙인다(Next 16 CSP 안내).
 */
const CARD_ENTRY_PATH = /^\/billing\/setups\/[^/]+\/card\/?$/;

export const isCardEntryPath = (pathname: string) =>
  CARD_ENTRY_PATH.test(pathname);

export function cardEntryCsp({
  nonce,
  apiBaseUrl,
  dev,
}: {
  nonce: string;
  apiBaseUrl: string;
  dev: boolean;
}) {
  let api = "";
  try {
    api = apiBaseUrl ? new URL(apiBaseUrl).origin : "";
  } catch {
    // 잘못된 값이면 우리 출처만 연다
  }
  return [
    "default-src 'self'",
    // dev 의 React 는 eval 로 서버 오류 스택을 되살린다(운영에는 없다).
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}`,
    // 인라인 style 속성(Radix·Tailwind 런타임)이 있어 스타일은 막지 않는다. 스크립트 통제가 목적이다.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${api ? ` ${api}` : ""}${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
