"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useMutation } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
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

const stepColors: Record<
  OnboardingStepKey,
  { bg: string; border: string; text: string }
> = {
  acquisitionSource: {
    bg: "bg-[var(--clay-brand-peach)]",
    border: "border-[var(--clay-primary)]",
    text: "text-[var(--clay-primary)]",
  },
  userType: {
    bg: "bg-[var(--clay-brand-lavender)]",
    border: "border-[var(--clay-primary)]",
    text: "text-[var(--clay-primary)]",
  },
  primaryUseCase: {
    bg: "bg-[var(--clay-brand-pink)]",
    border: "border-[var(--clay-primary)]",
    text: "text-white",
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0 } },
};

const eyebrowVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0,
    },
  },
};

const wordVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    filter: "blur(8px)",
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      delay: i * 0.08,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
  exit: {
    opacity: 0,
    transition: {
      duration: 0,
    },
  },
};

const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0,
    },
  },
};

export function OnboardingWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [otherValues, setOtherValues] = useState(initialOtherValues);
  const [error, setError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const mutation = useMutation({
    mutationFn: submitOnboardingProfile,
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
    onError: (submitError: Error) => {
      setError(submitError.message || "온보딩 저장에 실패했습니다.");
    },
  });

  const step = ONBOARDING_STEPS[stepIndex];
  const currentValue = answers[step.key];
  const otherValue = otherValues[step.key];
  const otherTooLong = otherValue.length > ONBOARDING_MAX_LENGTH;
  const canGoNext =
    currentValue.trim().length > 0 && !otherTooLong && !mutation.isPending;
  const progress = ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const selectedOption = useMemo(
    () => step.options.find((option) => option === currentValue) ?? null,
    [currentValue, step.options]
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--cg-cream)] text-[var(--cg-ink)] flex items-center justify-center">
        <div className="animate-pulse text-sm font-semibold text-[var(--clay-muted)]">
          온보딩 준비 중...
        </div>
      </div>
    );
  }

  function selectOption(value: string) {
    setError(null);
    setOtherValues((prev) => ({ ...prev, [step.key]: "" }));
    setAnswers((prev) => ({ ...prev, [step.key]: value }));
  }

  function updateOther(value: string) {
    setError(null);
    setOtherValues((prev) => ({ ...prev, [step.key]: value }));
    setAnswers((prev) => ({
      ...prev,
      [step.key]: value.length <= ONBOARDING_MAX_LENGTH ? value : "",
    }));
  }

  function goBack() {
    if (stepIndex === 0) return;
    setDirection(-1);
    setStepIndex((value) => value - 1);
  }

  function goNext() {
    if (!canGoNext) return;

    if (stepIndex < ONBOARDING_STEPS.length - 1) {
      setDirection(1);
      setStepIndex((value) => value + 1);
      return;
    }

    mutation.mutate({
      acquisitionSource: answers.acquisitionSource.trim(),
      userType: answers.userType.trim(),
      primaryUseCase: answers.primaryUseCase.trim(),
    });
  }

  return (
    <div className="min-h-screen bg-[var(--cg-cream)] text-[var(--cg-ink)]">
      <div className="h-1 w-full bg-black/10">
        <motion.div
          className="h-full bg-[var(--clay-primary)]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4px)] max-w-3xl flex-col px-5">
        <div className="flex flex-1 items-center py-12">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.section
              key={step.key}
              custom={direction}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              {/* Eyebrow */}
              <motion.p
                variants={eyebrowVariants}
                className="mb-3 text-xs font-bold tracking-[0.16em] text-[var(--clay-muted)] uppercase"
              >
                {step.eyebrow}
              </motion.p>

              {/* Title Word-by-Word Animation */}
              <h1 className="text-3xl leading-tight font-bold tracking-[0] sm:text-5xl">
                {step.title.split(" ").map((word, i) => (
                  <motion.span
                    key={`${step.key}-title-${i}`}
                    custom={i}
                    variants={wordVariants}
                    className="inline-block mr-[0.25em]"
                  >
                    {word}
                  </motion.span>
                ))}
              </h1>

              {/* Description Word-by-Word Animation */}
              <p className="mt-4 text-base leading-7 text-[var(--clay-muted)]">
                {step.description.split(" ").map((word, i) => (
                  <motion.span
                    key={`${step.key}-desc-${i}`}
                    custom={i}
                    variants={wordVariants}
                    className="inline-block mr-[0.25em]"
                  >
                    {word}
                  </motion.span>
                ))}
              </p>

              {/* Options Grid rising up */}
              <motion.div
                variants={cardVariants}
                className="mt-9 grid gap-3 sm:grid-cols-2"
              >
                {step.options.map((option) => {
                  const selected = selectedOption === option;

                  return (
                    <motion.button
                      key={option}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectOption(option)}
                      className={cn(
                        "relative flex min-h-14 items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition",
                        selected
                          ? `${stepColors[step.key].bg} ${stepColors[step.key].border} ${stepColors[step.key].text} shadow-lg shadow-black/5`
                          : "border-[var(--clay-hairline)] bg-white/60 hover:bg-white text-[var(--clay-primary)]"
                      )}
                    >
                      <span>{option}</span>
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* Other Input Container rising up */}
              <motion.div variants={cardVariants} className="mt-4">
                <label className="mb-2 block text-sm font-semibold">기타</label>
                <input
                  value={otherValue}
                  onChange={(event) => updateOther(event.target.value)}
                  maxLength={ONBOARDING_MAX_LENGTH + 20}
                  placeholder="직접 입력해 주세요"
                  className={cn(
                    "h-13 w-full rounded-xl border bg-white px-4 text-sm outline-none transition",
                    otherTooLong
                      ? "border-red-500"
                      : "border-[var(--clay-hairline)] focus:border-[var(--clay-primary)]"
                  )}
                />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <p
                    className={
                      otherTooLong
                        ? "text-red-600"
                        : "text-[var(--clay-muted)]"
                    }
                  >
                    {otherTooLong
                      ? "80자 이내로 입력해 주세요."
                      : "선택지에 없다면 직접 입력할 수 있어요."}
                  </p>
                  <p
                    className={
                      otherTooLong
                        ? "text-red-600"
                        : "text-[var(--clay-muted)]"
                    }
                  >
                    {otherValue.length}/{ONBOARDING_MAX_LENGTH}
                  </p>
                </div>
              </motion.div>
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="sticky bottom-0 border-t border-[var(--clay-hairline)] bg-[var(--cg-cream)]/90 py-4 backdrop-blur-xl">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0 || mutation.isPending}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--clay-muted)] transition hover:bg-black/5 disabled:pointer-events-none disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="inline-flex h-10 w-24 items-center justify-center rounded-full bg-[var(--clay-primary)] text-sm font-bold text-white shadow-md shadow-black/10 transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              {stepIndex === ONBOARDING_STEPS.length - 1
                ? mutation.isPending
                  ? "저장 중"
                  : "완료"
                : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
