import { buildApiUrl } from "@/lib/auth/paths";
import type { AppResponse } from "@/lib/auth/types";
import type {
  OnboardingAnswers,
  OnboardingCompletion,
} from "@/lib/onboarding/types";

export async function submitOnboardingProfile(answers: OnboardingAnswers) {
  const response = await fetch(buildApiUrl("/v1/onboarding/profile"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(answers),
  });

  const body = (await response.json()) as AppResponse<OnboardingCompletion>;

  if (!response.ok || !body.success || !body.data?.onboardingCompleted) {
    throw new Error(
      body.error?.message ?? "Failed to save onboarding profile."
    );
  }

  return body.data;
}
