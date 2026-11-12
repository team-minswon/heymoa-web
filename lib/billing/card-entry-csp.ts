/**
 * 카드를 받는 두 면 — 첫 구독 결제 페이지(`/billing/checkout/{id}`)와 카드 변경 iframe(`/billing/card-change/{id}`), APP-1600 — 에만
 * 거는 Content-Security-Policy. 카드 번호를 우리 화면에서
 * 받으므로 그 문서에서는 우리 출처의 스크립트만 돌고(인라인은 Next 가 붙이는 nonce 만), 요청은 우리 출처·API 로만 나간다
 * (PCI DSS 6.4.3·11.6.1 의 결제 화면 스크립트 통제). 분석 스크립트는 이 면의 루트 레이아웃이 아예 싣지 않는다(`app/(card-entry)`).
 * nonce 는 `proxy.ts` 가 요청마다 만들고, Next 가 요청 헤더의 CSP 에서 읽어 프레임워크 스크립트에 붙인다(Next 16 CSP 안내).
 */
const CHECKOUT_PATH = /^\/billing\/checkout\/[^/]+\/?$/;
const CARD_CHANGE_PATH = /^\/billing\/card-change\/[^/]+\/?$/;

/** CSP 를 거는 경로면 그 문서를 띄울 수 있는 곳(`frame-ancestors`), 아니면 null. 카드 변경 문서만 우리 모달이 iframe 으로 싣는다. */
export function cardEntryFrameAncestors(pathname: string) {
  if (CHECKOUT_PATH.test(pathname)) return "'none'";
  if (CARD_CHANGE_PATH.test(pathname)) return "'self'";
  return null;
}

/** 카드 칸이 있는 문서인가(목의 요청 기록을 끄는 판정에도 쓴다). */
export const isCardEntryPath = (pathname: string) =>
  cardEntryFrameAncestors(pathname) !== null;

export function cardEntryCsp({
  nonce,
  apiBaseUrl,
  dev,
  frameAncestors,
}: {
  nonce: string;
  apiBaseUrl: string;
  dev: boolean;
  frameAncestors: string;
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
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}
