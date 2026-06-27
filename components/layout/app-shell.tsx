"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

type AppShellProps = {
  children: ReactNode;
};

const immersivePathPrefixes = ["/dashboard", "/onboarding"];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isImmersivePath = immersivePathPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isImmersivePath) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="flex flex-1 flex-col">{children}</div>
      <Footer />
    </>
  );
}
