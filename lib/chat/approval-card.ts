import type { ApprovalDecision, Block } from "@/lib/chat/blocks";

export type ApprovalCardStatus =
  | { kind: "open" }
  | { kind: "submitted" }
  | { kind: "running" }
  | { kind: "done"; url: string | null }
  | { kind: "rejected" }
  | { kind: "failed" }
  | { kind: "invalid"; reason: string }
  | { kind: "check"; reason?: string };

export function resolvedStatus(
  decision: ApprovalDecision | null,
  tool: Extract<Block, { kind: "tool" }> | null
): ApprovalCardStatus {
  if (decision === "REJECTED") return { kind: "rejected" };
  switch (tool?.status ?? null) {
    case "success":
      return { kind: "done", url: tool?.url ?? null };
    case "error":
      return { kind: "failed" };
    case "stopped":
    case "unknown":
      return { kind: "check" };
    default:
      return { kind: "running" };
  }
}

export type ApprovalCardField = {
  label: string;
  value: string | null;
  before: string | null;
  after: string | null;
  added: string[];
  removed: string[];
  kept: string[];
};

export type ApprovalCardItem = {
  title: string;
  target: string | null;
  fields: ApprovalCardField[];
};

export type ApprovalCardData = {
  title: string;
  target: string | null;
  warning: string | null;
  fields: ApprovalCardField[];
  items: ApprovalCardItem[];
  body: { label: string | null; text: string } | null;
};
