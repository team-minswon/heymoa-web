import type { Metadata } from "next";
import {
  EB_Garamond,
  Geist_Mono,
  Hahmlet,
  Inter,
  Noto_Serif_KR,
} from "next/font/google";

import { SiteAnalytics } from "@/components/analytics/site-analytics";
import { FooterGate } from "@/components/FooterGate";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { NavbarGate } from "@/components/NavbarGate";
import { GlobalRecordingIndicator } from "@/components/transcription/global-recording-indicator";
import { Toaster } from "@/components/ui/toast";
import { getCurrentUserForSsr } from "@/lib/auth/server";
import { siteConfig } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400"],
});

/**
 * **한글 세리프.** EB Garamond에는 한글 글리프가 없어서 `font-serif`를 준 제목이 전부 시스템
 * 산세리프로 떨어졌다 — 에디토리얼 서체를 지정해 놓고 화면에는 평범한 고딕이 나왔다.
 * 라틴은 Garamond, 한글은 이 폰트가 받는다(글리프 단위 폴백).
 *
 * `preload: false`는 CJK라서다. 서브셋이 수백 개로 쪼개져 있어 preload를 켜면 쓰지도 않을
 * 조각까지 끌어온다 — 브라우저가 unicode-range로 필요한 조각만 받게 둔다.
 */
const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  weight: ["300", "400"],
  preload: false,
});

/**
 * **랜딩 히어로 전용 디스플레이 세리프.** Hahmlet은 한글·라틴을 한 벌로 가진 모던 명조라
 * 히어로 한 화면 안에서 폰트가 갈리지 않는다. 300을 쓰는 것은 `font-serif`와 같은 이유다 —
 * 세리프 라이트가 이 제품의 디스플레이 시그니처이고 굵게 가지 않는다(`DESIGN.md`).
 *
 * **전역 `--font-serif`는 건드리지 않았다.** 나머지 제목은 그대로 EB Garamond + Noto Serif KR이고,
 * 이 변수는 히어로 `h1`에서만 참조한다.
 *
 * `preload: false`는 위 Noto Serif KR과 같은 이유다 — 한글 서브셋이 수백 조각이라
 * preload가 쓰지도 않을 조각을 끌어온다.
 */
const hahmlet = Hahmlet({
  variable: "--font-hahmlet",
  weight: ["300"],
  preload: false,
});

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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getCurrentUserForSsr();

  return (
    <html
      lang="ko"
      className={`${inter.variable} ${geistMono.variable} ${ebGaramond.variable} ${notoSerifKr.variable} ${hahmlet.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers initialUser={initialUser}>
          <div className="flex min-h-screen flex-col bg-[var(--el-canvas)] text-[var(--el-ink)]">
            {/* 키보드 첫 탭이 nav 링크 전부를 지나지 않게. 포커스 전에는 화면 밖에 있다.
                `focus-visible`이 아니라 `focus`인 것은 이 링크에 닿는 길이 키보드뿐이라서다 —
                브라우저의 focus-visible 휴리스틱에 맡기면 안 뜨는 경우가 생긴다. */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--el-ink)] focus:px-4 focus:py-2.5 focus:text-[14px] focus:font-semibold focus:text-[var(--el-canvas)]"
            >
              본문으로 건너뛰기
            </a>
            <NavbarGate>
              <Navbar />
            </NavbarGate>
            <GlobalRecordingIndicator />

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
        </Providers>
        <SiteAnalytics />
      </body>
    </html>
  );
}
