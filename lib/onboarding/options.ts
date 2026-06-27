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
    title: "어디서 알게 되었나요?",
    description: "Realillust를 처음 접한 경로를 하나 선택해 주세요.",
    options: ["검색", "SNS", "커뮤니티", "지인 추천", "뉴스/블로그"],
  },
  {
    key: "userType",
    eyebrow: "2 / 3",
    title: "어떤 사용자에 가까우신가요?",
    description: "가장 가까운 역할을 하나 선택해 주세요.",
    options: [
      "개발자",
      "디자이너",
      "콘텐츠 제작자",
      "기업/기관 담당자",
      "학생/연구자",
    ],
  },
  {
    key: "primaryUseCase",
    eyebrow: "3 / 3",
    title: "어떤 목적으로 사용하려고 하나요?",
    description: "가장 중요한 사용 목적을 하나 선택해 주세요.",
    options: [
      "API 연동",
      "이미지 검수 자동화",
      "콘텐츠 진위 확인",
      "서비스 도입 검토",
      "연구/학습",
    ],
  },
];
