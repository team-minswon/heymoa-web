"use client";

import { usePathname } from "next/navigation";

import { TopBar } from "@/components/heymoa/landing/top-bar";
import { isChromelessRoute } from "@/lib/routes/app-route";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isChromelessRoute(pathname)) {
    return null;
  }

  // 랜딩(`/`)은 마케팅 Navbar 대신 자기 상단 바를 세운다. 이 자리(`<main>` 밖, 건너뛰기 링크 뒤)여야
  // 「본문으로 건너뛰기」가 이 바도 건너뛴다. 푸터는 그대로 쓴다.
  if (pathname === "/") {
    return <TopBar />;
  }

  return <>{children}</>;
}
