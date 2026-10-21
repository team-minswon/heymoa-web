import { NotFoundView } from "@/components/layout/not-found-view";
import { marketingLocale } from "@/lib/i18n/current";

/** 마케팅 라우트의 `notFound()`(없는 가이드 주제, `/en/없는-주소`). 언어는 주소의 root param 이다. */
export default async function MarketingNotFound() {
  return <NotFoundView locale={await marketingLocale()} />;
}
