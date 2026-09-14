"use client";

import { usePathname } from "next/navigation";

import { isChromelessRoute } from "@/lib/routes/app-route";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isChromelessRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
