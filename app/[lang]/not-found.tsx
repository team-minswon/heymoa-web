import { NotFoundView } from "@/components/layout/not-found-view";
import { marketingLocale } from "@/lib/i18n/current";

export default async function MarketingNotFound() {
  return <NotFoundView locale={await marketingLocale()} />;
}
