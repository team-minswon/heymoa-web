"use client";

import { usePathname } from "next/navigation";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide Navbar on the authentication callback page
  if (pathname === "/auth/callback") return null;

  return <>{children}</>;
}
