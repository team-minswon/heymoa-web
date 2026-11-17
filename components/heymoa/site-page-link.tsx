"use client";

import type { ComponentProps } from "react";
import Link from "next/link";

import { blockedByRecording, openSitePage } from "@/lib/desktop/open-site-page";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";

export function SitePageLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "target" | "rel"> & { href: string }) {
  const inApp = useDesktopApp() === true;
  return (
    <Link
      href={href}
      {...(inApp ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !inApp) return;
        const bridge = (window as unknown as { heymoaDesktop?: import("@heymoa/desktop-contracts").DesktopFoundationBridge }).heymoaDesktop;
        if (bridge?.openSitePage) {
          event.preventDefault();
          openSitePage(href, () => {});
        } else if (blockedByRecording(href)) event.preventDefault();
      }}
      {...props}
    />
  );
}
