export type OnboardingStepKey =
  | "acquisitionSource"
  | "userType"
  | "primaryUseCase";

export type OnboardingStep = {
  key: OnboardingStepKey;
  eyebrow: string;
  title: string;
  description: string;
  options: string[];
};

export const ONBOARDING_MAX_LENGTH = 80;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "acquisitionSource",
    eyebrow: "1 / 3",
    title: "Where did you hear about Realillust?",
    description: "Choose the channel that first introduced you to Realillust.",
    options: [
      "Search",
      "Social media",
      "Community",
      "Referral",
      "News or blog",
    ],
  },
  {
    key: "userType",
    eyebrow: "2 / 3",
    title: "Which role best describes you?",
    description:
      "Pick the closest role so the product can start with useful defaults.",
    options: [
      "Developer",
      "Designer",
      "Creator",
      "Business operator",
      "Researcher",
    ],
  },
  {
    key: "primaryUseCase",
    eyebrow: "3 / 3",
    title: "What do you want to do first?",
    description: "Choose the main workflow you expect to explore first.",
    options: [
      "API integration",
      "Image inspection",
      "Content authenticity",
      "Product evaluation",
      "Research or learning",
    ],
  },
];
