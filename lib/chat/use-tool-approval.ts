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
 * 승인 카드의 세 상태. 확정(`resolved`)은 스트림이 하므로 여기 없다 — 그때는 리듀서가
 * `pending`을 지우고 카드가 사라지며 기록이 남는다.
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
 * 다시 눌러도 소용없는 종료 오류와 그 사유. 그 밖의 실패는 재시도할 수 있어야 한다.
 *
 * **`AGENT_CHAT_CAPACITY_EXCEEDED`(503)는 여기 없다.** 실행 자리가 없어 승인을 되돌린
 * 것이라 잠시 뒤 다시 누르면 된다 — 기본 갈래(잠금 해제 + 토스트)가 맞다.
 */
const TERMINAL_REASON: Record<string, string> = {
  // 만료가 없어졌다. 남은 404는 이미 처리됐거나 그 턴이 승인 대기가 아닌 것이다.
  APPROVAL_NOT_FOUND: "이미 처리됐거나 지나간 승인입니다.",
  AGENT_CHAT_NOT_FOUND: "대화를 찾을 수 없어 처리할 수 없습니다.",
  NOT_APPROVAL_OWNER: "이 승인은 요청한 사람만 처리할 수 있습니다.",
};

/** 승인을 안 누른 채 대화가 끝난 자리. **만료가 아니다** — 「중지」가 유일한 탈출구다. */
const ENDED_REASON = "승인을 처리하지 못한 채 대화가 끝났습니다.";

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
 * 승인을 기다리던 스트림이 답 없이 끝났나. **`done`은 여기 없다** — 답이 정상적으로
 * 끝났으면 승인은 이미 확정돼 `pending`이 지워진 뒤다.
 */
function isAbnormalEnd(phase: ChatStreamPhase): boolean {
  return phase === "failed" || phase === "cancelled";
}

/**
 * 승인 상태 기계. 개인·공유 챗봇이 같은 흐름을 쓰므로 여기로 뺐다.
 *
 * **보낸 것이 확정은 아니다.** approve는 낙관적으로 결과를 뒤집지 않고 `submitted`로만
 * 간다 — 확정은 재접속한 스트림의 첫 프레임(`tool_approval_resolved`)이 `pending`을 지우며
 * 반영한다. 무효화는 두 입구가 한 화면으로 수렴한다: 종료 오류(403/404)와, 승인을
 * 기다리다 스트림이 비정상 종료해 `pending`이 소실되는 것. 후자를 위해 직전 승인을
 * 붙잡아 무효화 카드로 남긴다.
 *
 * **보내는 일은 여기서 안 한다.** 202 뒤 스트림에 다시 붙는 것은 컴포넌트의 일이고, 여기로는
 * `resolve`가 주입된다 — 실패면 사유를, 열렸으면 null을 돌려준다.
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
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [invalidation, setInvalidation] = useState<Invalidation | null>(null);
  // 직전에 본 pending. 리듀서가 pending을 지우며 확정(정상)하거나 비정상 종료로 날리는데,
  // 후자면 pending이 이미 null이라 직전 값을 붙잡아 무효화 카드로 남긴다.
  const [trackedPending, setTrackedPending] = useState<Pending>(null);
  // onError는 비동기라 클로저의 pending이 낡는다 — 콜백 시점의 최신 pending을 refs로 본다.
  const pendingRef = useRef<Pending>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // 렌더 중 이전 상태와 비교해 조정한다 — React가 공식 지원하는 패턴(effect가 아니다).
  // 각 set은 조건이 곧 거짓이 되므로 루프 없이 수렴한다.
  if (pending) {
    if (pending !== trackedPending) setTrackedPending(pending);
    if (invalidation && invalidation.approvalId !== pending.approvalId) {
      setInvalidation(null); // 새 턴의 새 승인 — 지난 무효화를 접는다.
    }
  } else if (trackedPending && isAbnormalEnd(streamPhase) && !invalidation) {
    // 승인을 기다리다 스트림이 비정상 종료했다 — 직전 승인을 무효화 카드로 남긴다.
    setInvalidation({
      approvalId: trackedPending.approvalId,
      approval: trackedPending,
      reason: ENDED_REASON,
    });
  } else if (streamPhase === "streaming") {
    // 새 턴이 시작됐다 — 지난 무효화·추적을 접는다.
    if (invalidation) setInvalidation(null);
    if (trackedPending) setTrackedPending(null);
  }

  const approve = useCallback(
    (decision: ApprovalDecision) => {
      const target = pending;
      if (!target) return;
      // 보낸 것일 뿐 — 확정은 재접속한 스트림이 한다. 그 사이 버튼을 잠그지 않으면 중복 결정이
      // 나가므로 **보내기 전에** 잠근다(카드가 `submitted`면 버튼이 disabled다).
      setSubmittedId(target.approvalId);
      void resolve(target.approvalId, decision).then((error) => {
        if (!error) return;
        // 스트림이 먼저 확정했으면(늦게 온 오류) pending이 이미 지워졌다 — 죽은 카드를
        // 되살리거나 헛토스트를 띄우지 않는다.
        if (pendingRef.current?.approvalId !== target.approvalId) return;
        if (error.code in TERMINAL_REASON) {
          // 다시 눌러도 같은 오류다 — 카드를 무효화한다(인라인이 사유를 보인다).
          setInvalidation({
            approvalId: target.approvalId,
            approval: target,
            reason: TERMINAL_REASON[error.code],
          });
          return;
        }
        // 재시도할 수 있는 실패다 — 잠금을 풀고, 인라인이 없으니 여기서만 토스트한다.
        setSubmittedId(null);
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
