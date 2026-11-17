/**
 * **글꼴은 패키지(`@fontsource`)로 싣는다**. `next/font/google`은 빌드할 때
 * `fonts.gstatic.com`에서 받아서, 한글 조각 수백 개 중 하나만 끊겨도 빌드가 실패했다.
 * 패키지로 두면 `pnpm install`만으로 Vercel · 로컬 · CI가 같은 글꼴로 빌드한다.
 *
 * - 변수(`--font-*`)는 `globals.css`의 `:root`가 선언한다. next/font가 `<html>` 클래스에 심던 자리다.
 */
import "@fontsource-variable/inter/opsz.css";
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
import { DesktopLanguageSync } from "@/components/auth/desktop-language-sync";
import { BrowserHandoff } from "@/components/auth/browser-handoff";
import {
  messagesFor,
  PRODUCT_NAMESPACES,
  type Namespace,
} from "@/i18n/messages";
import { getCurrentUserForSsr } from "@/lib/auth/server";
import type { Locale } from "@/lib/i18n/locales";
import "@/app/globals.css";

export async function AppShell({
  locale,
  clientNamespaces = PRODUCT_NAMESPACES,
  analytics = true,
  children,
}: {
  locale: Locale;
  clientNamespaces?: readonly Namespace[];
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
            <DesktopLanguageSync />
            <div className="flex min-h-screen flex-col bg-[var(--el-canvas)] text-[var(--el-ink)]">
              <NavbarGate>
                <Navbar />
              </NavbarGate>
              <GlobalRecordingIndicator />
              <DesktopRecordingControls />

              <main id="main" tabIndex={-1} className="flex-1 flex flex-col">
                {children}
              </main>

              <FooterGate>
                <Footer />
              </FooterGate>
            </div>
            <Toaster />
            <AccountDeletedNotice />
            {analytics ? <SiteAnalytics /> : null}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
