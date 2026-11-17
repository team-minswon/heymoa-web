/** 카드를 받는 두 면에만 거는 CSP 입니다(PCI DSS 6.4.3·11.6.1). nonce 는 `proxy.ts` 가 만들고, Next 가 요청 헤더의 CSP 에서 읽어 프레임워크 스크립트에 붙입니다. */
const CHECKOUT_PATH = /^\/billing\/checkout\/[^/]+\/?$/;
const CARD_CHANGE_PATH = /^\/billing\/card-change\/[^/]+\/?$/;

export function cardEntryFrameAncestors(pathname: string) {
  if (CHECKOUT_PATH.test(pathname)) return "'none'";
  if (CARD_CHANGE_PATH.test(pathname)) return "'self'";
  return null;
}

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
  } catch {}
  return [
    "default-src 'self'",
    // dev 의 React 는 eval 로 서버 오류 스택을 되살립니다(운영에는 없습니다).
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}`,
    // 인라인 style 속성(Radix·Tailwind 런타임)이 있어 스타일은 막지 않습니다.
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
