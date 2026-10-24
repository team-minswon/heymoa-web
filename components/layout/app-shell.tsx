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

import { NextIntlClientProvider } from "next-intl";

import { Providers } from "@/app/providers";
import { SiteAnalytics } from "@/components/analytics/site-analytics";
import { FooterGate } from "@/components/FooterGate";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { NavbarGate } from "@/components/NavbarGate";
import { GlobalRecordingIndicator } from "@/components/transcription/global-recording-indicator";
import { DesktopRecordingControls } from "@/components/transcription/desktop-recording-controls";
import { Toaster } from "@/components/ui/toast";
import { AccountDeletedNotice } from "@/components/auth/account-deleted-notice";
import { BrowserHandoff } from "@/components/auth/browser-handoff";
import { messagesFor, type Namespace } from "@/i18n/messages";
import { getCurrentUserForSsr } from "@/lib/auth/server";
import type { Locale } from "@/lib/i18n/locales";
import "@/app/globals.css";

/**
 * 두 루트 레이아웃(마케팅 `app/[lang]`, 제품 `app/(product)`)이 같이 세우는 `<html>` 과 셸.
 * 루트가 둘이라 둘 사이 이동(랜딩 → 대시보드, 로그아웃 → 랜딩)은 전체 페이지 로드다.
 */
export async function AppShell({
  locale,
  clientNamespaces = ["common", "auth"],
  analytics = true,
  children,
}: {
  locale: Locale;
  /** 클라이언트로 보낼 이름공간. 그 루트가 쓰는 것만 보낸다(마케팅 페이지가 대시보드 문구를 받지 않게). */
  clientNamespaces?: readonly Namespace[];
  /**
   * 분석 넷(GA·PostHog·Vercel)을 싣는가. 주소에 토큰이 실리는 메일 수신거부 화면만 끈다(APP-1314) — 페이지뷰가
   * 쿼리째 나간다. 루트 레이아웃이 따로라 다른 면과 오가면 문서가 새로 열리므로, 앞 화면에서 켠 분석이 이어지지 않는다.
   */
  analytics?: boolean;
  children: React.ReactNode;
}) {
  const initialUser = await getCurrentUserForSsr();
  const messages = messagesFor(locale);
  const clientMessages = Object.fromEntries(
    clientNamespaces.map((namespace) => [namespace, messages[namespace]])
  );

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <Providers initialUser={initialUser}>
            <BrowserHandoff />
            <div className="flex min-h-screen flex-col bg-[var(--el-canvas)] text-[var(--el-ink)]">
              {/* 키보드 첫 탭이 nav 링크 전부를 지나지 않게. 키보드로 포커스를 받기 전에는 화면 밖에 있다.
                  `focus-visible`인 것은 마우스·프로그램 포커스(다이얼로그가 닫히며 문서 앞으로 돌아오는 등)에
                  마우스 사용자의 화면 왼쪽 위를 가리지 않게 하려는 것이다. Tab 으로 닿으면 항상 focus-visible 이다. */}
              <a
                href="#main"
                className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-[var(--el-ink)] focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-[14px] focus-visible:font-semibold focus-visible:text-[var(--el-canvas)]"
              >
                {messages.common.skipToContent}
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
            <AccountDeletedNotice />
            {/* Providers 안이어야 PostHog가 로그인한 사람(`useAuth`)을 안다. */}
            {analytics ? <SiteAnalytics /> : null}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
