import { normalizeReturnTo } from "@/lib/auth/paths";

export type InAppBrowser =
  | "instagram"
  | "threads"
  | "kakao"
  | "line"
  | "facebook"
  | "tiktok"
  | "other";
export type HandoffOs = "ios" | "android" | "other";
export type HandoffContext = { app: InAppBrowser; os: HandoffOs };

/** Landing entry carries advertising tags; authentication starts later in the new browser. */
export function buildBrowserLandingUrl(href: string, context: HandoffContext) {
  const current = new URL(href);
  if (!/^https?:$/.test(current.protocol))
    throw new Error("Expected a web URL");
  const target = new URL(current.origin);
  target.pathname = current.pathname;
  for (const [key, value] of current.searchParams) {
    if (
      /^utm_(source|medium|campaign|term|content|id|source_platform)$/.test(
        key
      ) ||
      key === "fbclid"
    )
      target.searchParams.append(key, value);
  }
  target.searchParams.set("handoff_app", context.app);
  target.searchParams.set("handoff_os", context.os);
  return target.href;
}

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  if (/Barcelona|Threads/i.test(ua)) return "threads";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/Line\//i.test(ua)) return "line";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "tiktok";
  return /Android.*; wv\)/i.test(ua) ? "other" : null;
}

export function handoffOs(ua: string): HandoffOs {
  if (/Android/i.test(ua)) return "android";
  return /iPhone|iPad|iPod/i.test(ua) ? "ios" : "other";
}

/** Only classification travels in analytics; never the destination or an OAuth credential. */
export function parseHandoffContext(
  app: string | null,
  os: string | null
): HandoffContext | null {
  if (
    !app ||
    ![
      "instagram",
      "threads",
      "kakao",
      "line",
      "facebook",
      "tiktok",
      "other",
    ].includes(app)
  )
    return null;
  if (!os || !["ios", "android", "other"].includes(os)) return null;
  return { app: app as InAppBrowser, os: os as HandoffOs };
}

/** Anonymous PostHog IDs carried across a handoff (`withAnalyticsHandoff`); never kept in returnTo. */
export const HANDOFF_ANALYTICS_PARAMS = ["ph_did", "ph_sid", "ph_ts"] as const;

export function buildBrowserLoginUrl(
  href: string,
  context: HandoffContext,
  returnTo?: string
) {
  const current = new URL(href);
  if (!/^https?:$/.test(current.protocol))
    throw new Error("Expected a web URL");
  const original =
    returnTo ??
    (current.pathname === "/auth/login"
      ? current.searchParams.get("returnTo")
      : current.pathname + current.search);
  const back = new URL(normalizeReturnTo(original), current.origin);
  // Never move credentials from a callback or an accidentally decorated page to another app.
  for (const key of [
    "code",
    "access_token",
    "refresh_token",
    "id_token",
    "handoff_app",
    "handoff_os",
    ...HANDOFF_ANALYTICS_PARAMS,
  ]) {
    back.searchParams.delete(key);
  }
  if (!back.pathname.startsWith("/oauth/")) back.searchParams.delete("state");
  // Signed mail links keep their original layout, including analytics=false on /unsubscribe.
  const keepOriginalPage =
    back.pathname === "/invite" ||
    back.pathname === "/unsubscribe" ||
    back.pathname.startsWith("/oauth/");
  const destination = keepOriginalPage
    ? back
    : new URL("/auth/login", current.origin);
  if (!keepOriginalPage)
    destination.searchParams.set("returnTo", back.pathname + back.search);
  for (const [key, value] of current.searchParams) {
    if (
      /^utm_(source|medium|campaign|term|content|id|source_platform)$/.test(
        key
      ) ||
      key === "fbclid"
    ) {
      destination.searchParams.set(key, value);
    }
  }
  destination.searchParams.set("handoff_app", context.app);
  destination.searchParams.set("handoff_os", context.os);
  return destination.href;
}

export function externalBrowserUrl(
  target: string,
  context: HandoffContext
): string | null {
  const url = new URL(target);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Expected a web URL");
  const encoded = encodeURIComponent(url.href);
  if (context.app === "kakao")
    return `kakaotalk://web/openExternal?url=${encoded}`;
  if (context.app === "line") {
    url.searchParams.set("openExternalBrowser", "1");
    return url.href;
  }
  if (context.os === "android") {
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};action=android.intent.action.VIEW;package=com.android.chrome;end`;
  }
  // shortcut: Meta's private schemes can change; keep manual instructions and verify on app updates.
  if (context.os === "ios" && context.app === "instagram")
    return `instagram://extbrowser/?url=${encoded}`;
  if (context.os === "ios" && context.app === "threads")
    return `barcelona://extbrowser/?url=${encoded}`;
  return null;
}
