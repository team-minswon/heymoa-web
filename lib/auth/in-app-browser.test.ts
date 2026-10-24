import { describe, expect, it } from "vitest";
import {
  buildBrowserLandingUrl,
  buildBrowserLoginUrl,
  detectInAppBrowser,
  externalBrowserUrl,
  handoffOs,
  parseHandoffContext,
} from "./in-app-browser";

describe("in-app Google login handoff", () => {
  it("moves landing visitors to the same language without credentials or hash", () => {
    const target = new URL(
      buildBrowserLandingUrl(
        "https://heymoa.app/en?utm_source=threads&fbclid=click&code=secret#access_token",
        { app: "threads", os: "ios" }
      )
    );
    expect(target.pathname).toBe("/en");
    expect(target.searchParams.get("utm_source")).toBe("threads");
    expect(target.searchParams.get("fbclid")).toBe("click");
    expect(target.href).not.toContain("secret");
    expect(target.hash).toBe("");
    expect(
      new URL(
        buildBrowserLandingUrl("https://heymoa.app//evil.example/", {
          app: "threads",
          os: "ios",
        })
      ).origin
    ).toBe("https://heymoa.app");
  });
  it.each([
    ["iPhone Instagram 400", "instagram", "ios"],
    ["iPhone Barcelona 400 Instagram", "threads", "ios"],
    ["Android KAKAOTALK", "kakao", "android"],
    ["iPhone Line/15", "line", "ios"],
    ["iPhone FBAN/FBIOS;FBAV/1", "facebook", "ios"],
    ["Android TikTok", "tiktok", "android"],
    ["Mozilla/5.0 (Linux; Android 16; Pixel; wv)", "other", "android"],
    ["iPhone Version/18.0 Mobile Safari/604.1", null, "ios"],
    ["Android Chrome/140.0 Mobile Safari/537.36", null, "android"],
    ["Macintosh Safari/605.1.15", null, "other"],
  ])("classifies %s without confusing Safari with an app", (ua, app, os) => {
    expect(detectInAppBrowser(ua)).toBe(app);
    expect(handoffOs(ua)).toBe(os);
  });

  it("keeps campaign tags even on marketing paths that cannot be a returnTo", () => {
    const url = new URL(
      buildBrowserLoginUrl(
        "https://heymoa.app/en/help?utm_source=instagram&utm_campaign=a%26b&fbclid=click#secret",
        { app: "instagram", os: "ios" }
      )
    );
    expect(url.origin + url.pathname).toBe("https://heymoa.app/auth/login");
    expect(url.searchParams.get("returnTo")).toBe("/");
    expect(url.searchParams.get("utm_source")).toBe("instagram");
    expect(url.searchParams.get("utm_campaign")).toBe("a&b");
    expect(url.searchParams.get("fbclid")).toBe("click");
    expect(url.hash).toBe("");
  });

  it("retains a note destination while dropping OAuth credentials", () => {
    const target = new URL(
      buildBrowserLoginUrl(
        "https://heymoa.app/w/01K0000000000/notes/new?projectId=01K0000000001&code=secret&state=secret&access_token=secret",
        { app: "threads", os: "ios" }
      )
    );
    expect(target.searchParams.get("returnTo")).toBe(
      "/w/01K0000000000/notes/new?projectId=01K0000000001"
    );
    expect(target.href).not.toContain("secret");
  });

  it("keeps invitation and pending agent request parameters required to continue", () => {
    const context = { app: "instagram", os: "ios" } as const;
    const invitation = new URL(
      buildBrowserLoginUrl(
        "https://heymoa.app/",
        context,
        "/invite?token=invitation"
      )
    );
    expect(invitation.pathname).toBe("/invite");
    expect(invitation.searchParams.get("token")).toBe("invitation");
    const agent = new URL(
      buildBrowserLoginUrl(
        "https://heymoa.app/",
        context,
        "/oauth/authorize?state=agent-state&code_challenge=pkce"
      )
    );
    expect(agent.pathname).toBe("/oauth/authorize");
    expect(agent.searchParams.get("state")).toBe("agent-state");
    const mail = new URL(
      buildBrowserLoginUrl(
        "https://heymoa.app/",
        context,
        "/unsubscribe?t=signed-mail-token"
      )
    );
    expect(mail.pathname).toBe("/unsubscribe");
    expect(mail.searchParams.get("t")).toBe("signed-mail-token");
    expect(mail.searchParams.has("returnTo")).toBe(false);
    expect(
      new URL(
        buildBrowserLoginUrl(
          "https://heymoa.app/auth/login?returnTo=%2Fsettings",
          context
        )
      ).searchParams.get("returnTo")
    ).toBe("/settings");
  });

  it("starts from our login page, never an OAuth callback or external return URL", () => {
    const context = { app: "instagram", os: "ios" } as const;
    for (const path of [
      "https://evil.example/",
      "//evil.example/",
      "/auth/callback?code=secret",
    ]) {
      const target = new URL(
        buildBrowserLoginUrl("https://heymoa.app/", context, path)
      );
      expect(target.origin).toBe("https://heymoa.app");
      expect(target.searchParams.get("returnTo")).toBe("/");
    }
    expect(() => externalBrowserUrl("javascript:alert(1)", context)).toThrow();
  });

  it("uses the app-specific iOS schemes and the documented Android intent", () => {
    const url = "https://heymoa.app/auth/login?utm_campaign=a%26b";
    expect(externalBrowserUrl(url, { app: "instagram", os: "ios" })).toBe(
      `instagram://extbrowser/?url=${encodeURIComponent(url)}`
    );
    expect(externalBrowserUrl(url, { app: "threads", os: "ios" })).toBe(
      `barcelona://extbrowser/?url=${encodeURIComponent(url)}`
    );
    expect(externalBrowserUrl(url, { app: "kakao", os: "ios" })).toBe(
      `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
    );
    expect(externalBrowserUrl(url, { app: "instagram", os: "android" })).toBe(
      "intent://heymoa.app/auth/login?utm_campaign=a%26b#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;end"
    );
    expect(externalBrowserUrl(url, { app: "line", os: "ios" })).toContain(
      "openExternalBrowser=1"
    );
    expect(externalBrowserUrl(url, { app: "facebook", os: "ios" })).toBeNull();
  });

  it("rejects unrecognized attribution markers", () => {
    expect(parseHandoffContext("instagram", "ios")).toEqual({
      app: "instagram",
      os: "ios",
    });
    expect(parseHandoffContext("user@example.com", "ios")).toBeNull();
    expect(parseHandoffContext("instagram", "arbitrary")).toBeNull();
  });
});
