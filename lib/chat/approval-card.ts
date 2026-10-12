/**
 * 승인 카드의 구조와 상태. ai 가 실제로 보낼 요청에서 만들어 `tool_approval_request.card` 로
 * 싣는다. 모든 값은 사람이 읽는 이름이다 — web 은 id 를 이름으로 바꾸지 않는다.
 *
 * 파싱은 계약 계층(`stream-protocol` 의 `parseApprovalCard`)이 한다.
 */

import type { ApprovalDecision, Block } from "@/lib/chat/blocks";

/**
 * 카드가 놓인 자리의 상태. 결정 전(`open`·`submitted`)은 버튼을 세우고, 결정 뒤에는 같은 카드에서
 * 테두리와 배지만 바꾼다. 상태 이름은 배지가 말하므로 사유에 다시 적지 않는다.
 */
export type ApprovalCardStatus =
  | { kind: "open" }
  | { kind: "submitted" }
  | { kind: "running" }
  | { kind: "done"; url: string | null }
  | { kind: "rejected" }
  | { kind: "failed" }
  /** 답하지 못한 채 끝났거나 이미 처리된 승인. */
  | { kind: "invalid"; reason: string }
  /** 승인은 갔는데 결과를 못 받았다. 쓰기가 나갔을 수 있어 무효와 가른다. */
  | { kind: "check"; reason: string };

/** 승인을 안 누른 채 대화가 끝난 자리. 만료가 아니다. */
export const ENDED_REASON = "승인을 처리하지 못한 채 대화가 끝났습니다.";

/**
 * 승인을 보낸 뒤 끝난 자리. server 는 202 전에 결정을 굳히고 재개를 넘기므로 쓰기가 나갔을 수
 * 있다. 무효로 그리면 나간 쓰기를 안 된 것으로 보인다.
 */
export const UNKNOWN_REASON =
  "승인은 전달됐지만 실행 결과를 받지 못한 채 대화가 끝났습니다.";

/**
 * 결정된 승인의 상태. 실행 상태는 짝인 도구 블록이 말한다 — 결과 없이 끝난 턴은
 * `settleEndedTurn` 이 `stopped`·`unknown` 으로 닫아 둔다.
 */
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
      return { kind: "check", reason: UNKNOWN_REASON };
    default:
      return { kind: "running" };
  }
}

export type ApprovalCardField = {
  label: string;
  /** 일반 행. `before`·`after` 가 있으면 무시한다. */
  value: string | null;
  /** 둘 중 하나라도 있으면 「전 → 후」 변경 행이다. 없는 쪽은 「없음」으로 읽는다. */
  before: string | null;
  after: string | null;
  /** 명단 바꾸기. 하나라도 있으면 사람 칩으로 그린다. */
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
  /** 무엇에 하는지 한 줄. 여기 나온 대상은 fields 에서 반복하지 않는다. */
  target: string | null;
  /** 되돌릴 수 없는 동작의 주의 한 줄. */
  warning: string | null;
  fields: ApprovalCardField[];
  /** 일괄 쓰기의 항목. 모든 항목에 같은 변경이면 그 변경은 바깥 `fields` 에 온다. */
  items: ApprovalCardItem[];
  /** 메일·이슈 설명처럼 긴 평문. 줄바꿈을 지킨다. */
  body: { label: string; text: string } | null;
};
