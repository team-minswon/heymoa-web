"use client";

import { usePathname } from "next/navigation";

import { isWorkspaceRoute } from "@/lib/routes/app-route";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide Navbar on the authentication callback page
  if (pathname === "/auth/callback" || isWorkspaceRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
