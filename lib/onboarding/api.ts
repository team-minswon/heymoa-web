import { apiFetch } from "@/lib/api/fetcher";
import type {
  OnboardingAnswers,
  OnboardingCompletion,
} from "@/lib/onboarding/types";

type AppResponse<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

export async function submitOnboardingProfile(answers: OnboardingAnswers) {
  const response = await apiFetch<AppResponse<OnboardingCompletion>>(
    "/v1/onboarding/profile",
    {
      method: "POST",
      data: answers,
    }
  );

  if (!response.success || !response.data?.onboardingCompleted) {
    throw new Error(response.error?.message ?? "온보딩 저장에 실패했습니다.");
  }

  return response.data;
}
