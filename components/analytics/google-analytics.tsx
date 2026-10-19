"use client";

import Script from "next/script";

import { initGoogleAnalytics } from "@/lib/analytics/track";

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
      onReady={() => initGoogleAnalytics(measurementId)}
    />
  );
}
