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
  const { data: resBody } = await apiFetch<{
    data: AppResponse<OnboardingCompletion>;
    status: number;
    headers: Headers;
  }>("/v1/onboarding/profile", {
    method: "POST",
    data: answers,
  });

  if (!resBody || !resBody.success || !resBody.data?.onboardingCompleted) {
    throw new Error(resBody?.error?.message ?? "온보딩 저장에 실패했습니다.");
  }

  return resBody.data;
}
