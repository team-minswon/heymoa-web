"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitOnboardingProfile } from "@/lib/onboarding/api";
import {
  ONBOARDING_MAX_LENGTH,
  ONBOARDING_STEPS,
  type OnboardingStepKey,
} from "@/lib/onboarding/options";
import type { OnboardingAnswers } from "@/lib/onboarding/types";

const initialAnswers: OnboardingAnswers = {
  acquisitionSource: "",
  userType: "",
  primaryUseCase: "",
};

const initialOtherValues: Record<OnboardingStepKey, string> = {
  acquisitionSource: "",
  userType: "",
  primaryUseCase: "",
};

export function OnboardingWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [otherValues, setOtherValues] = useState(initialOtherValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const currentValue = answers[step.key];
  const otherValue = otherValues[step.key];
  const otherTooLong = otherValue.length > ONBOARDING_MAX_LENGTH;
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
  const canContinue =
    currentValue.trim().length > 0 && !otherTooLong && !pending;
  const progress = Math.round(
    ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100
  );

  const selectedOption = useMemo(
    () => step.options.find((option) => option === currentValue) ?? null,
    [currentValue, step.options]
  );

  function selectOption(value: string) {
    setError(null);
    setOtherValues((current) => ({ ...current, [step.key]: "" }));
    setAnswers((current) => ({ ...current, [step.key]: value }));
  }

  function updateOther(value: string) {
    setError(null);
    setOtherValues((current) => ({ ...current, [step.key]: value }));
    setAnswers((current) => ({
      ...current,
      [step.key]: value.length <= ONBOARDING_MAX_LENGTH ? value : "",
    }));
  }

  async function finish() {
    setPending(true);
    setError(null);

    try {
      await submitOnboardingProfile({
        acquisitionSource: answers.acquisitionSource.trim(),
        userType: answers.userType.trim(),
        primaryUseCase: answers.primaryUseCase.trim(),
      });
      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save onboarding profile."
      );
    } finally {
      setPending(false);
    }
  }

  function goNext() {
    if (!canContinue) {
      return;
    }

    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    void finish();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-12">
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-foreground"
          style={{ width: `${progress}%` }}
        />
      </div>

      <section className="flex flex-1 flex-col justify-center py-12">
        <p className="font-mono text-sm text-muted-foreground">
          {step.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-semibold">{step.title}</h1>
        <p className="mt-4 text-muted-foreground">{step.description}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {step.options.map((option) => {
            const selected = selectedOption === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => selectOption(option)}
                className={
                  selected
                    ? "border border-foreground bg-foreground p-4 text-left text-sm font-medium text-background"
                    : "border border-border bg-background p-4 text-left text-sm font-medium"
                }
              >
                {option}
              </button>
            );
          })}
        </div>

        <label
          className="mt-6 block text-sm font-medium"
          htmlFor="other-answer"
        >
          Other
        </label>
        <input
          id="other-answer"
          value={otherValue}
          onChange={(event) => updateOther(event.target.value)}
          maxLength={ONBOARDING_MAX_LENGTH + 20}
          className="mt-2 h-12 w-full border border-border bg-background px-3 text-sm outline-none"
          placeholder="Type another answer"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            {otherTooLong
              ? "Use 80 characters or fewer."
              : "Use this if none of the options match."}
          </span>
          <span>
            {otherValue.length}/{ONBOARDING_MAX_LENGTH}
          </span>
        </div>
      </section>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="flex items-center justify-between border-t border-border py-4">
        <button
          type="button"
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          disabled={stepIndex === 0 || pending}
          className="px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canContinue}
          className="border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {isLastStep ? (pending ? "Saving..." : "Complete") : "Next"}
        </button>
      </div>
    </main>
  );
}
