import type { ProposalHead } from "@/lib/notes/proposals/contract";

export const CONTEXT_KIND_LABEL: Record<ProposalHead["kind"], string> =
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
  ProposalHead["operation"],
  string
> = {
  CREATE: "새로 포착",
  AMEND: "내용 보강",
  CORRECT: "내용 정정",
  RETRACT: "철회",
  RESOLVE: "질문 해결",
};
