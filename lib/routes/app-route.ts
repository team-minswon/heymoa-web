import { splitLocale } from "@/lib/i18n/locales";
import { isMarketingPathname } from "@/lib/i18n/marketing-routes";

export function isWorkspaceRoute(pathname: string) {
  return pathname === "/w" || pathname.startsWith("/w/");
}

export function isHelpRoute(pathname: string) {
  const { path } = splitLocale(pathname);
  return path === "/help" || path.startsWith("/help/");
}

export const isLandingChromeRoute = isMarketingPathname;

export const isLandingHome = (pathname: string) =>
  splitLocale(pathname).path === "/";

export function isFocusChromeRoute(pathname: string) {
  return (
    pathname === "/invite" ||
    pathname === "/auth/login" ||
    pathname === "/unsubscribe" ||
    pathname.startsWith("/oauth/") ||
    pathname.startsWith("/billing/setups/")
  );
}

export function isChromelessRoute(pathname: string) {
  return (
    pathname === "/auth/callback" ||
    pathname === "/mock-review" ||
    /^\/billing\/(?:checkout|card-change)\/[^/]+\/?$/.test(pathname) ||
    isWorkspaceRoute(pathname)
  );
}
