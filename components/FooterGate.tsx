"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { LandingFooter } from "@/components/heymoa/landing/footer";
import { FocusFooter } from "@/components/layout/focus-chrome";
import {
  isChromelessRoute,
  isFocusChromeRoute,
  isLandingChromeRoute,
} from "@/lib/routes/app-route";

/**
 * 푸터를 어디에 세울지만 판다. 랜딩 · 약관 · 개인정보 · 데스크톱 다운로드(`isLandingChromeRoute`)는 랜딩
 * 푸터(`landing/footer.tsx`)를 세운다 — APP-931 로 랜딩이 흰 바탕 · 연보라 면으로 바뀌자 옛 마케팅 `Footer` 의
 * 크림 · 갈색 파도가 다른 페이지처럼 읽혔고, 약관 · 개인정보 · 다운로드도 APP-934 에서 같은 면으로 옮겼다.
 * 나머지는 범용 `Footer` 를 세운다.
 */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isChromelessRoute(pathname)) {
    return null;
  }

  if (isLandingChromeRoute(pathname)) {
    // 「지어낸 예시」 고지는 데모가 있는 랜딩에서만.
    return <LandingFooter example={pathname === "/"} />;
  }

  if (isFocusChromeRoute(pathname)) {
    return <FocusFooter />;
  }

  return <>{children}</>;
}
