import { useEffect } from "react";

import { onTrack } from "@/lib/analytics/track";
import { STEP_OF_EVENT, markStepDone } from "@/lib/onboarding/checklist";

/**
 * 서버로 알 수 없는 「시작하기」 단계(요약 검토 완료·초대)를 이벤트로 기기에 적는다.
 *
 * **체크리스트 UI가 아니라 늘 떠 있는 워크스페이스 셸이 부른다.** 모바일에서는 사이드바가 시트라 닫히면
 * 체크리스트가 언마운트되고, 그 사이 검토를 완료하거나 초대해도 구독이 없어 기록을 놓쳤다(codex 리뷰).
 */
export function useOnboardingProgress(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    return onTrack((event) => {
      const step = STEP_OF_EVENT[event];
      if (step) markStepDone(userId, step);
    });
  }, [userId]);
}
