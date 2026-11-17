import { NotFoundView } from "@/components/layout/not-found-view";
import { productLocale } from "@/lib/i18n/current";

export default async function ProductNotFound() {
  return <NotFoundView locale={await productLocale()} />;
}
