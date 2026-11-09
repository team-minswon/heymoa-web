"use client";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import type { DesktopFoundationBridge } from "@heymoa/desktop-contracts";
import { isLocale } from "@/lib/i18n/locales";

/** 앱 고유 화면도 현재 웹 화면의 언어를 따른다. 구버전 앱은 이 메서드가 없다. */
export function DesktopLanguageSync() {
  const screen = useLocale();
  useEffect(() => {
    if (!isLocale(screen)) return;
    const bridge = (window as unknown as { heymoaDesktop?: DesktopFoundationBridge }).heymoaDesktop;
    void bridge?.reportLanguage?.(screen).catch(() => undefined);
  }, [screen]);
  return null;
}
