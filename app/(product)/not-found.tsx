import { NotFoundView } from "@/components/layout/not-found-view";
import { productLocale } from "@/lib/i18n/current";

/** 제품 라우트가 `notFound()` 를 부를 때. 언어는 제품 루트와 같다(계정 → 쿠키 → 브라우저 언어, APP-1285). */
export default async function ProductNotFound() {
  return <NotFoundView locale={await productLocale()} />;
}
