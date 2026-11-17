import { redirect } from "next/navigation";

import { ReviewShowcase } from "@/components/mocks/review-showcase";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

export default function MockReviewPage() {
  if (!shouldEnableMocking()) redirect("/");

  return <ReviewShowcase />;
}
