"use client";

import { usePathname } from "next/navigation";

import { TopBar } from "@/components/heymoa/landing/top-bar";
import { FocusTopBar } from "@/components/layout/focus-chrome";
import {
  isChromelessRoute,
  isFocusChromeRoute,
  isLandingChromeRoute,
} from "@/lib/routes/app-route";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isChromelessRoute(pathname)) {
    return null;
  }

  // 랜딩 · 약관 · 개인정보 · 데스크톱 다운로드는 마케팅 Navbar 대신 랜딩 상단 바를 세운다(경로는 `isLandingChromeRoute` 한 곳).
  // 이 자리(`<main>` 밖, 건너뛰기 링크 뒤)여야 「본문으로 건너뛰기」가 이 바도 건너뛴다.
  if (isLandingChromeRoute(pathname)) {
    return <TopBar />;
  }

  if (isFocusChromeRoute(pathname)) {
    return <FocusTopBar />;
  }

  return <>{children}</>;
}
