"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { isWorkspaceRoute } from "@/lib/routes/app-route";

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Navbar 와 같은 기준 — 자기 셸을 가진 면에는 전역 Footer 도 얹지 않는다.
  const ownsShell = ["/auth/callback", "/login", "/welcome"].includes(pathname);
  if (ownsShell || pathname.startsWith("/invite/") || isWorkspaceRoute(pathname)) {
    return null;
  }

  const isStatic = pathname === "/privacy" || pathname === "/terms";

  return React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(
        child as React.ReactElement<{ simplified?: boolean }>,
        {
          simplified: isStatic,
        }
      );
    }
    return child;
  });
}
