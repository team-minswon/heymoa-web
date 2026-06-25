"use client";

import { usePathname } from "next/navigation";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide Navbar on the authentication callback page
  if (
    pathname === "/auth/callback" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/dashboard")
  ) {
    return null;
  }

  return <>{children}</>;
}
