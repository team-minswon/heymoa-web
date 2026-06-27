import { submitOnboardingProfileApi } from "@/lib/api/endpoints";
import type {
  OnboardingAnswers,
  OnboardingCompletion,
} from "@/lib/onboarding/types";

export async function submitOnboardingProfile(answers: OnboardingAnswers) {
  const completion: OnboardingCompletion =
    await submitOnboardingProfileApi(answers);

  if (!completion.onboardingCompleted) {
    throw new Error("Failed to save onboarding profile.");
  }

  return completion;
}
