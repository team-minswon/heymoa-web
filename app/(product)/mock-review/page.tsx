import { redirect } from "next/navigation";

import { ReviewShowcase } from "@/components/mocks/review-showcase";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

/**
 * 목 전용 미리보기. 회의 뒤 검토 화면의 상태마다, 그리고 전체 할 일 화면을 데스크톱 · 모바일 폭으로
 * 나란히 띄워 직접 눌러 본다. 목이 꺼진 환경에 존재하면 안 되는 화면이라 홈으로 돌려보낸다.
 */
export default function MockReviewPage() {
  if (!shouldEnableMocking()) redirect("/");

  return <ReviewShowcase />;
}
