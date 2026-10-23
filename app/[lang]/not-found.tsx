import { NotFoundView } from "@/components/layout/not-found-view";
import { marketingLocale } from "@/lib/i18n/current";

/**
 * 마케팅 라우트가 미리 그릴 때 부른 `notFound()`(영어판이 없는 이전 판 등). 언어는 주소의 root param 이다.
 * 라우트가 없는 주소(`/en/없는-주소`)는 여기가 아니라 `app/global-not-found.tsx` 가 받는다(APP-1419).
 */
export default async function MarketingNotFound() {
  return <NotFoundView locale={await marketingLocale()} />;
}
