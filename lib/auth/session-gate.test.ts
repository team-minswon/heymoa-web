import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/events";
import {
  isSessionExpired,
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

describe("session gate", () => {
  beforeEach(() => {
    resetSessionGate();
  });

  it("시작할 때는 닫혀 있다", () => {
    expect(isSessionExpired()).toBe(false);
  });

  it("열면 만료 상태가 되고 이벤트를 한 번 낸다", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, listener);

    openSessionGate();

    expect(isSessionExpired()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_STATE_CHANGED_EVENT, listener);
  });

  it("여러 번 열어도 이벤트는 한 번만 난다", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, listener);

    openSessionGate();
    openSessionGate();
    openSessionGate();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_STATE_CHANGED_EVENT, listener);
  });

  it("SessionExpiredError는 이름으로 구분된다", () => {
    expect(new SessionExpiredError().name).toBe("SessionExpiredError");
  });

  // 서버에서 모듈 상태를 쓰면 Next 프로세스가 모든 요청과 공유한다. 비로그인 사용자의
  // SSR prefetch가 게이트를 열면 다른 사용자의 SSR까지 막힌다.
  describe("서버에서는 열리지도 보이지도 않는다", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("서버에서 열어도 만료로 보이지 않는다", () => {
      vi.stubGlobal("window", undefined);

      openSessionGate();

      expect(isSessionExpired()).toBe(false);
    });

    it("브라우저에서 열린 상태여도 서버에서는 닫힌 것으로 본다", () => {
      openSessionGate();
      expect(isSessionExpired()).toBe(true);

      vi.stubGlobal("window", undefined);
      expect(isSessionExpired()).toBe(false);
    });
  });
});
