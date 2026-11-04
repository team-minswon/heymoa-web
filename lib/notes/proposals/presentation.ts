import type { ProposalHead } from "@/lib/notes/proposals/contract";

/** 한국어 유형 이름. 회의록·검토·데스크톱이 쓴다 — 노트 타임라인은 `notes.kinds` 를 쓴다. */
export const CONTEXT_KIND_LABEL: Record<ProposalHead["kind"], string> = {
  AGENDA: "안건",
  DECISION: "결정",
  ACTION_ITEM: "할 일",
  ISSUE: "이슈",
  QUESTION: "질문",
  STATUS_REPORT: "보고",
  INSIGHT: "인사이트",
};
