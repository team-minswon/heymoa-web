import type { ContextCandidateHead } from "@/lib/notes/context-candidates/contract";
import type { ContextActivityOutcome } from "@/lib/notes/context-candidates/reducer";

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
