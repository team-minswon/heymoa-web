"use client";

import { usePathname } from "next/navigation";

import { TopBar } from "@/components/heymoa/landing/top-bar";
import { HelpTopBar } from "@/components/help/help-top-bar";
import { FocusTopBar } from "@/components/layout/focus-chrome";
import {
  isChromelessRoute,
  isFocusChromeRoute,
  isHelpRoute,
  isLandingChromeRoute,
} from "@/lib/routes/app-route";

export function NavbarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isChromelessRoute(pathname)) {
    return null;
  }

  if (isHelpRoute(pathname)) {
    return <HelpTopBar />;
  }

  if (isLandingChromeRoute(pathname)) {
    return <TopBar />;
  }

  if (isFocusChromeRoute(pathname)) {
    return <FocusTopBar />;
  }

  return <>{children}</>;
}
