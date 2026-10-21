/**
 * 마크다운이 쓰는 라벨 낱말. 언어판마다 본문 언어로 적는다(`content/help/README.md`).
 * 화면에 보이는 이름표가 곧 이 낱말이라 따로 번역하지 않는다.
 */

/** `:::problem` 안의 `**증상:**` `**원인:**` `**해결 방법:**`(영어판 `**Symptom:**` `**Cause:**` `**Fix:**`). */
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

/** `> [!참고]` 같은 알림의 종류(영어판 `Note` `Tip` `Caution` `Can't be undone`). */
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
