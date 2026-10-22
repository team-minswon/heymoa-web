import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordConsentNow,
  rememberLoginConsent,
  settleLoginConsent,
} from "@/lib/auth/login-consent";

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  recordConsents: vi.fn(),
}));
vi.mock("@/lib/api/generated/users/users", () => api);

const KEY = "heymoa:login-consent";

function account(consentRequired: boolean, version = "2026-10-22") {
  return {
    status: 200,
    data: {
      success: true,
      error: null,
      data: {
        userId: "user",
        consentRequired,
        consents: [
          {
            documentType: "PRIVACY",
            currentVersion: version,
            agreed: !consentRequired,
          },
          {
            documentType: "TERMS",
            currentVersion: version,
            agreed: !consentRequired,
          },
        ],
      },
    },
  };
}

describe("로그인 동의", () => {
  beforeEach(() => {
    api.getCurrentUser.mockReset();
    api.recordConsents.mockReset().mockResolvedValue({ status: 204 });
    window.sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("이미 지금 버전에 동의했으면 아무것도 기록하지 않는다", async () => {
    api.getCurrentUser.mockResolvedValue(account(false));
    rememberLoginConsent();

    await expect(settleLoginConsent()).resolves.toBe("done");

    expect(api.recordConsents).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("로그인 창에서 체크했으면 서버가 정한 지금 버전 그대로 둘 다 기록한다", async () => {
    api.getCurrentUser.mockResolvedValue(account(true, "2027-01-02"));
    rememberLoginConsent();

    await expect(settleLoginConsent()).resolves.toBe("done");

    expect(api.recordConsents).toHaveBeenCalledWith({
      consents: [
        { documentType: "PRIVACY", version: "2027-01-02" },
        { documentType: "TERMS", version: "2027-01-02" },
      ],
    });
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("체크한 표시가 없으면 기록하지 않고 체크박스를 받으라고 한다", async () => {
    api.getCurrentUser.mockResolvedValue(account(true));

    await expect(settleLoginConsent()).resolves.toBe("ask");

    expect(api.recordConsents).not.toHaveBeenCalled();
  });

  it("30분이 지난 표시는 체크한 증거가 아니다", async () => {
    vi.useFakeTimers();
    api.getCurrentUser.mockResolvedValue(account(true));

    vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
    rememberLoginConsent();
    vi.setSystemTime(new Date("2026-10-21T10:29:59Z"));
    await expect(settleLoginConsent()).resolves.toBe("done");

    vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
    rememberLoginConsent();
    vi.setSystemTime(new Date("2026-10-21T10:30:01Z"));
    await expect(settleLoginConsent()).resolves.toBe("ask");
  });

  it("기록이 실패하면 던지고 표시를 남겨 다시 시도할 수 있다", async () => {
    api.getCurrentUser.mockResolvedValue(account(true));
    api.recordConsents.mockRejectedValueOnce(new Error("503"));
    rememberLoginConsent();

    await expect(settleLoginConsent()).rejects.toThrow("503");
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull();

    await expect(settleLoginConsent()).resolves.toBe("done");
    expect(api.recordConsents).toHaveBeenCalledTimes(2);
  });

  it("내 정보를 못 읽으면 동의 여부를 알 수 없으니 던진다", async () => {
    api.getCurrentUser.mockResolvedValue({
      status: 200,
      data: { success: false, data: null, error: { code: "X", message: "x" } },
    });

    await expect(settleLoginConsent()).rejects.toThrow();
    expect(api.recordConsents).not.toHaveBeenCalled();
  });

  it("저장소를 못 쓰는 브라우저에서는 표시가 없는 것으로 보고 체크박스를 받는다", async () => {
    api.getCurrentUser.mockResolvedValue(account(true));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => rememberLoginConsent()).not.toThrow();
    await expect(settleLoginConsent()).resolves.toBe("ask");
  });

  describe("recordConsentNow — 사용자가 이 화면에서 직접 체크한 뒤", () => {
    it("필요하면 지금 버전으로 기록한다", async () => {
      api.getCurrentUser.mockResolvedValue(account(true));

      await recordConsentNow();

      expect(api.recordConsents).toHaveBeenCalledTimes(1);
    });

    it("그 사이 다른 탭이 이미 기록했으면 다시 기록하지 않는다", async () => {
      api.getCurrentUser.mockResolvedValue(account(false));

      await recordConsentNow();

      expect(api.recordConsents).not.toHaveBeenCalled();
    });

    it("서버가 옛 버전이라고 거절하면 던진다", async () => {
      api.getCurrentUser.mockResolvedValue(account(true));
      api.recordConsents.mockRejectedValue({
        success: false,
        data: null,
        error: {
          code: "CONSENT_VERSION_OUTDATED",
          message: "다시 확인해 주세요.",
        },
      });

      await expect(recordConsentNow()).rejects.toMatchObject({
        error: { code: "CONSENT_VERSION_OUTDATED" },
      });
    });
  });
});
