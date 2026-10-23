import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";

import { LandingClient } from "@/components/heymoa/landing-client";
import { marketingLocale } from "@/lib/i18n/current";
import { isLocale } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata(await marketingLocale(), "/");
}

/**
 * 미리 그린다(●). 요청마다 SSR 하면 가장 많이 맞는 페이지가 Vercel 함수 CPU 를 쓴다(APP-1418). 로그인 상태는
 * 다른 마케팅 페이지처럼 클라이언트가 채운다.
 */
export const dynamic = "force-static";

/**
 * 첫 세그먼트가 언어가 아닌 한 마디 주소(`/nope`)를 404 로 돌려 `app/[lang]/not-found.tsx` 가 그리게 한다. 언어 셸 없는
 * 문서에서 랜딩을 그리면 500 이 났다.
 */
export default async function Home() {
  if (!isLocale(await lang())) notFound();
  return <LandingClient />;
}
