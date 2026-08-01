"use client";

import { usePathname } from "next/navigation";

import { isWorkspaceRoute } from "@/lib/routes/app-route";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 자기 셸을 가진 면에는 전역 Navbar 를 얹지 않는다. 특히 /welcome 은 워크스페이스가
  // 없는 사람이 오는 자리인데 「대시보드로 이동」이 떠 있으면 갈 곳이 있다고 말하는 셈이다.
  const ownsShell = ["/auth/callback", "/login", "/welcome"].includes(pathname);
  if (ownsShell || pathname.startsWith("/invite/") || isWorkspaceRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
