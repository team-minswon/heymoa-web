import { notifyAuthStateChanged } from "@/lib/auth/events";

let expired = false;

/** 브라우저에서만 삽니다. 서버의 모듈 상태는 Next 프로세스의 모든 요청이 공유해 다른 사용자의 SSR 까지 막습니다. */
function isBrowser() {
  return typeof window !== "undefined";
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired.");
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpired() {
  return isBrowser() && expired;
}

export function openSessionGate() {
  if (!isBrowser() || expired) {
    return;
  }

  expired = true;
  notifyAuthStateChanged({ reason: "unauthenticated" });
}

export function openSessionGateQuietly() {
  if (!isBrowser()) {
    return;
  }

  expired = true;
}

export function resetSessionGate() {
  expired = false;
}
