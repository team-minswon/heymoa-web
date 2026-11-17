"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { LandingFooter } from "@/components/heymoa/landing/footer";
import { FocusFooter } from "@/components/layout/focus-chrome";
import {
  isChromelessRoute,
  isFocusChromeRoute,
  isLandingChromeRoute,
} from "@/lib/routes/app-route";

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isChromelessRoute(pathname)) {
    return null;
  }

  if (isLandingChromeRoute(pathname)) {
    return <LandingFooter />;
  }

  if (isFocusChromeRoute(pathname)) {
    return <FocusFooter />;
  }

  return <>{children}</>;
}
