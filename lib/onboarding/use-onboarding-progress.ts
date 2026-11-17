import { useEffect } from "react";

import { onTrack } from "@/lib/analytics/track";
import { STEP_OF_EVENT, markStepDone } from "@/lib/onboarding/checklist";

export function useOnboardingProgress(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    return onTrack((event) => {
      const step = STEP_OF_EVENT[event];
      if (step) markStepDone(userId, step);
    });
  }, [userId]);
}
