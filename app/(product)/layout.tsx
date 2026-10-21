import { AppShell } from "@/components/layout/app-shell";
import { siteMetadata } from "@/lib/site";

export const metadata = siteMetadata;

/**
 * 제품 면의 루트 레이아웃(`/w/**`, `/settings/**`, `/invite`, `/oauth/**`, `/auth/callback`, 목 화면).
 * 주소에 언어 접두사가 없다. 제품 면 언어 결정(계정 → 쿠키 → ko)은 PRO-66-I07 이고, 지금은 한국어다.
 */
export default function ProductRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell locale="ko">{children}</AppShell>;
}
