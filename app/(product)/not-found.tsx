import { NotFoundView } from "@/components/layout/not-found-view";

/** 제품 라우트가 `notFound()` 를 부를 때. 제품 면은 아직 한국어다(언어 결정은 PRO-65-I07). */
export default function ProductNotFound() {
  return <NotFoundView locale="ko" />;
}
