import {
  CircleCheck,
  CircleQuestionMark,
  FileText,
  Flag,
  Lightbulb,
  SquareCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { ContextCandidateHead } from "@/lib/notes/context-candidates/contract";
import type { ContextActivityOutcome } from "@/lib/notes/context-candidates/reducer";

/**
 * 「결론」 묶음.
 *
 * **필터와 카드 강조가 같은 집합을 본다.** 둘을 따로 적어 두었더니 갈라졌다 — 필터는
 * `결론 = 결정 + 할 일`인데 면은 결정에만 찼고, 화면이 한 묶음이라 부르는 것과 강조하는
 * 것이 달라 어느 쪽이 기준인지 알 수 없었다. 늘리거나 줄일 때 여기 한 줄만 고친다.
 */
export const CONTEXT_OUTCOME_KINDS: ReadonlySet<ContextCandidateHead["kind"]> =
  new Set(["DECISION", "ACTION_ITEM"]);

/**
 * 유형 아이콘. design.pen 신판 「실시간 정리 리디자인」(`O8CpER`)이 유형마다 하나씩 정한다.
 *
 * **묶음 머리와 카드 배지가 같은 아이콘을 쓴다** — 목록을 훑다가 카드 하나만 봐도 어느
 * 묶음의 것인지 알아야 한다. 아이콘 이름을 여기 한 줄로 모아 두 곳이 갈리지 않게 한다.
 */
export const CONTEXT_KIND_ICON: Record<
  ContextCandidateHead["kind"],
  LucideIcon
> = {
  AGENDA: Flag,
  DECISION: CircleCheck,
  ACTION_ITEM: SquareCheck,
  ISSUE: TriangleAlert,
  QUESTION: CircleQuestionMark,
  STATUS_REPORT: FileText,
  INSIGHT: Lightbulb,
};

export const CONTEXT_KIND_LABEL: Record<ContextCandidateHead["kind"], string> =
  {
    AGENDA: "안건",
    DECISION: "결정",
    ACTION_ITEM: "할 일",
    ISSUE: "이슈",
    QUESTION: "질문",
    STATUS_REPORT: "보고",
    INSIGHT: "인사이트",
  };

export const CONTEXT_OPERATION_LABEL: Record<
  ContextCandidateHead["operation"],
  string
> = {
  CREATE: "새로 포착",
  AMEND: "내용 보강",
  CORRECT: "내용 정정",
  RETRACT: "철회",
  RESOLVE: "질문 해결",
};

export const CONTEXT_OUTCOME_LABEL: Record<ContextActivityOutcome, string> = {
  APPLIED: "반영 완료",
  ABSORBED: "중복 흡수",
  RESYNC_REQUIRED: "정본 확인",
  RECOVERED: "동기화 완료",
};
