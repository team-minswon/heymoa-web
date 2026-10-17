import type { Metadata } from "next";

/**
 * **글꼴은 패키지(`@fontsource`)로 싣는다** (APP-1115). `next/font/google`은 빌드할 때
 * `fonts.gstatic.com`에서 받아서, 한글 조각 수백 개 중 하나만 끊겨도 빌드가 실패했다.
 * 패키지로 두면 `pnpm install`만으로 Vercel · 로컬 · CI가 같은 글꼴로 빌드한다.
 *
 * - 세리프(EB Garamond · Noto Serif KR)는 싣지 않는다(APP-1161) — 제목도 Inter 와 시스템 고딕이다.
 * - 변수(`--font-*`)는 `globals.css`의 `:root`가 선언한다. next/font가 `<html>` 클래스에 심던 자리다.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";

import { SiteAnalytics } from "@/components/analytics/site-analytics";
import { FooterGate } from "@/components/FooterGate";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { NavbarGate } from "@/components/NavbarGate";
import { GlobalRecordingIndicator } from "@/components/transcription/global-recording-indicator";
import { DesktopRecordingControls } from "@/components/transcription/desktop-recording-controls";
import { Toaster } from "@/components/ui/toast";
import { getCurrentUserForSsr } from "@/lib/auth/server";
import { robotsDirective, siteConfig } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/favicon-32x32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=3", sizes: "16x16", type: "image/png" },
      {
        url: "/android-chrome-192x192.png?v=2",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: robotsDirective,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getCurrentUserForSsr();

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers initialUser={initialUser}>
          <div className="flex min-h-screen flex-col bg-[var(--el-canvas)] text-[var(--el-ink)]">
            {/* 키보드 첫 탭이 nav 링크 전부를 지나지 않게. 키보드로 포커스를 받기 전에는 화면 밖에 있다.
                `focus-visible`인 것은 마우스·프로그램 포커스(다이얼로그가 닫히며 문서 앞으로 돌아오는 등)에
                마우스 사용자의 화면 왼쪽 위를 가리지 않게 하려는 것이다. Tab 으로 닿으면 항상 focus-visible 이다. */}
            <a
              href="#main"
              className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-[var(--el-ink)] focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-[14px] focus-visible:font-semibold focus-visible:text-[var(--el-canvas)]"
            >
              본문으로 건너뛰기
            </a>
            <NavbarGate>
              <Navbar />
            </NavbarGate>
            <GlobalRecordingIndicator />
            <DesktopRecordingControls />

            {/* `tabIndex={-1}`이 있어야 건너뛰기 링크가 포커스를 여기로 옮긴다 — 없으면 해시만
                바뀌고 포커스는 body에 남아 다음 Tab이 다시 nav로 돌아간다. */}
            <main id="main" tabIndex={-1} className="flex-1 flex flex-col">
              {children}
            </main>

            <FooterGate>
              <Footer />
            </FooterGate>
          </div>
          <Toaster />
          {/* Providers 안이어야 PostHog가 로그인한 사람(`useAuth`)을 안다. */}
          <SiteAnalytics />
        </Providers>
      </body>
    </html>
  );
}
