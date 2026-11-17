export const PROBLEM_LABELS: Readonly<
  Record<string, "symptom" | "cause" | "fix">
> = {
  증상: "symptom",
  원인: "cause",
  "해결 방법": "fix",
  Symptom: "symptom",
  Cause: "cause",
  Fix: "fix",
};

export const CALLOUT_TONES: Readonly<
  Record<string, "note" | "tip" | "caution" | "irreversible">
> = {
  참고: "note",
  팁: "tip",
  주의: "caution",
  "되돌릴 수 없어요": "irreversible",
  Note: "note",
  Tip: "tip",
  Caution: "caution",
  "Can't be undone": "irreversible",
};
