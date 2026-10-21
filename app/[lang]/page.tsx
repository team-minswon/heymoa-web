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
 * 첫 세그먼트가 언어가 아닌 한 마디 주소(`/nope`)도 이 페이지에 온다. 루트 레이아웃의 `dynamicParams = false` 는
 * 미리 그린(●) 페이지에만 걸리는데, 랜딩은 요청 때 그리는(ƒ) 페이지라 막지 못한다. 그대로 두면 언어 셸 없는 문서에서
 * 랜딩을 그리다 500 이 났다. 여기서 404 로 돌려 `app/[lang]/not-found.tsx` 가 그리게 한다.
 */
export default async function Home() {
  if (!isLocale(await lang())) notFound();
  return <LandingClient />;
}
