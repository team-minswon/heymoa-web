"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";

import type {
  ApprovalDecision,
  ChatStreamPhase,
  ChatStreamState,
  ToolArgs,
} from "@/lib/chat/stream-protocol";

/**
 * 승인 카드의 세 상태. 확정은 스트림이 한다 — 리듀서가 `pending` 을 지우고 카드가 사라진다.
 */
export type ApprovalCardState =
  | { kind: "open" }
  | { kind: "submitted" }
  | { kind: "invalidated"; reason: string };

/** 스레드가 그릴 승인 카드. pending이 사라진 뒤에도 무효화 카드를 남기려고 훅이 소유한다. */
export type ApprovalCard = {
  tool: string;
  summary: string | null;
  /** 이 승인이 실행할 인자. 카드가 「무엇을 승인하나」를 보여주는 자리다. */
  args: ToolArgs;
  state: ApprovalCardState;
};

/**
 * 다시 눌러도 소용없는 종료 오류와 그 사유. `AGENT_CHAT_CAPACITY_EXCEEDED`(503)는 잠시 뒤
 * 다시 누르면 되므로 여기 없다.
 */
const TERMINAL_REASON: Record<string, string> = {
  // 승인 만료는 없다. 404 는 이미 처리됐거나 그 턴이 승인 대기가 아닌 것이다.
  APPROVAL_NOT_FOUND: "이미 처리됐거나 지나간 승인입니다.",
  AGENT_CHAT_NOT_FOUND: "대화를 찾을 수 없어 처리할 수 없습니다.",
  NOT_APPROVAL_OWNER: "이 승인은 요청한 사람만 처리할 수 있습니다.",
};

/** 승인을 안 누른 채 대화가 끝난 자리. 만료가 아니다. */
const ENDED_REASON = "중단됨 — 승인을 처리하지 못한 채 대화가 끝났습니다.";

/**
 * 승인을 보낸 뒤 끝난 자리. server 는 202 전에 결정을 굳히고 재개를 넘기므로 쓰기가 나갔을 수
 * 있다. 「중단됨」으로 그리면 나간 쓰기를 안 된 것으로 보인다.
 */
const UNKNOWN_REASON =
  "확인 필요 — 승인은 전달됐지만 실행 결과를 받지 못한 채 대화가 끝났습니다.";

type Pending = {
  approvalId: string;
  tool: string;
  summary: string | null;
  args: ToolArgs;
} | null;
type Invalidation = {
  approvalId: string;
  approval: NonNullable<Pending>;
  reason: string;
};

/**
 * 승인을 기다리던 스트림이 답 없이 끝났나. 정상 `done` 이면 승인은 이미 확정돼 `pending` 이
 * 지워진 뒤다.
 */
function isAbnormalEnd(phase: ChatStreamPhase): boolean {
  return phase === "failed" || phase === "cancelled";
}

/**
 * 승인 상태 기계. approve 는 결과를 낙관적으로 뒤집지 않고 `submitted` 로만 간다 — 확정은
 * 재접속한 스트림의 `tool_approval_resolved` 가 `pending` 을 지우며 반영한다.
 *
 * 무효화 입구는 둘이다: 종료 오류(403/404)와, 승인 대기 중 스트림이 비정상 종료해 `pending`
 * 이 사라지는 것. 후자를 위해 직전 승인을 붙잡아 둔다.
 *
 * 보내기는 주입된 `resolve` 가 한다. 실패면 사유를, 성공이면 null 을 돌려준다.
 */
export function useToolApproval({
  pending,
  streamPhase,
  resolve,
}: {
  pending: Pending;
  streamPhase: ChatStreamPhase;
  resolve: (
    approvalId: string,
    decision: ApprovalDecision
  ) => Promise<ChatStreamState["error"]>;
}): {
  approve: (decision: ApprovalDecision) => void;
  card: ApprovalCard | null;
} {
  const [submitted, setSubmitted] = useState<{
    approvalId: string;
    decision: ApprovalDecision;
  } | null>(null);
  const submittedId = submitted?.approvalId ?? null;
  const [invalidation, setInvalidation] = useState<Invalidation | null>(null);
  // 비정상 종료면 `pending` 이 이미 null 이라 직전 값을 붙잡아 무효화 카드로 남긴다.
  const [trackedPending, setTrackedPending] = useState<Pending>(null);
  // 비동기 콜백에서는 클로저의 pending 이 낡으므로 ref 로 최신 값을 본다.
  const pendingRef = useRef<Pending>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // 렌더 중에 이전 상태와 비교해 조정한다. 각 set 은 조건을 곧 거짓으로 만들어 루프 없이 수렴한다.
  if (pending) {
    if (pending !== trackedPending) setTrackedPending(pending);
    if (invalidation && invalidation.approvalId !== pending.approvalId) {
      setInvalidation(null); // 새 승인이 왔다.
    }
  } else if (trackedPending && isAbnormalEnd(streamPhase) && !invalidation) {
    // 승인을 기다리다 스트림이 비정상 종료했다.
    setInvalidation({
      approvalId: trackedPending.approvalId,
      approval: trackedPending,
      reason:
        submitted?.approvalId === trackedPending.approvalId &&
        submitted.decision === "APPROVED"
          ? UNKNOWN_REASON
          : ENDED_REASON,
    });
  } else if (streamPhase === "streaming") {
    // 새 턴이 시작됐다.
    if (invalidation) setInvalidation(null);
    if (trackedPending) setTrackedPending(null);
  }

  const approve = useCallback(
    (decision: ApprovalDecision) => {
      const target = pending;
      if (!target) return;
      // 보내기 전에 잠근다. 확정은 재접속한 스트림이 하고, 그 사이 잠그지 않으면 결정이 중복된다.
      setSubmitted({ approvalId: target.approvalId, decision });
      void resolve(target.approvalId, decision).then((error) => {
        if (!error) return;
        // 스트림이 먼저 확정했으면 늦게 온 오류다. 죽은 카드를 되살리거나 헛토스트를 띄우지 않는다.
        if (pendingRef.current?.approvalId !== target.approvalId) return;
        if (error.code in TERMINAL_REASON) {
          // 다시 눌러도 같은 오류라 카드를 무효화한다.
          setInvalidation({
            approvalId: target.approvalId,
            approval: target,
            reason: TERMINAL_REASON[error.code],
          });
          return;
        }
        // 재시도할 수 있는 실패다. 잠금을 풀고, 그릴 인라인 자리가 없어 토스트한다.
        setSubmitted(null);
        toast.error(error.message || "승인을 처리하지 못했습니다.");
      });
    },
    [pending, resolve]
  );

  let card: ApprovalCard | null = null;
  if (
    invalidation &&
    (!pending || pending.approvalId === invalidation.approvalId)
  ) {
    card = {
      tool: invalidation.approval.tool,
      summary: invalidation.approval.summary,
      args: invalidation.approval.args,
      state: { kind: "invalidated", reason: invalidation.reason },
    };
  } else if (pending) {
    card = {
      tool: pending.tool,
      summary: pending.summary,
      args: pending.args,
      state:
        submittedId === pending.approvalId
          ? { kind: "submitted" }
          : { kind: "open" },
    };
  }

  return { approve, card };
}
