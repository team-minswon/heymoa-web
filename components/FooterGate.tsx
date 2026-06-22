"use client";

import { usePathname } from "next/navigation";
import React from "react";

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide Footer on the authentication callback page
  if (pathname === "/auth/callback") return null;

  const isStatic = pathname === "/privacy" || pathname === "/terms";

  return React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<{ simplified?: boolean }>, {
        simplified: isStatic,
      });
    }
    return child;
  });
}
