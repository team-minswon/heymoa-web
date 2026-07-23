"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { useResolveToolApproval } from "@/lib/api/generated/agent-chat/agent-chat";
import type {
  ApprovalDecision,
  ChatStreamPhase,
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
  state: ApprovalCardState;
};

/** 다시 눌러도 소용없는 종료 오류와 그 사유. 그 밖의 실패는 재시도할 수 있어야 한다. */
const TERMINAL_REASON: Record<string, string> = {
  APPROVAL_NOT_FOUND: "승인 요청이 만료되어 처리할 수 없습니다.",
  MEETING_NOT_ACTIVE: "회의가 종료되어 승인할 수 없습니다.",
  NOT_APPROVAL_OWNER: "이 승인은 요청한 사람만 처리할 수 있습니다.",
};

const EXPIRED_REASON = "응답을 받지 못해 승인이 만료되었습니다.";

type Pending = { approvalId: string; tool: string; summary: string | null } | null;
type Invalidation = { approvalId: string; approval: NonNullable<Pending>; reason: string };

function isAbnormalEnd(phase: ChatStreamPhase): boolean {
  return phase === "failed" || phase === "stalled" || phase === "aborted";
}

/**
 * 승인 상태 기계. 개인·공유 챗봇이 같은 흐름을 쓰므로 여기로 뺐다.
 *
 * **204는 확정이 아니다.** approve는 낙관적으로 결과를 뒤집지 않고 `submitted`로만 간다 —
 * 확정은 스트림의 `tool_approval_resolved`가 `pending`을 지우며 반영한다. 무효화는 두 입구가
 * 한 화면으로 수렴한다: 종료 오류(403/404/409)와, 승인을 기다리다 스트림이 비정상 종료해
 * `pending`이 소실되는 만료. 후자를 위해 직전 승인을 붙잡아 무효화 카드로 남긴다.
 *
 * 표시 문구는 인라인 카드가 소유하므로 mutation의 전역 토스트는 끈다 — 재시도 가능한 실패만
 * 여기서 명시적으로 토스트한다(두 곳에서 같은 실패가 겹치지 않게).
 */
export function useToolApproval({
  chatId,
  pending,
  streamPhase,
}: {
  chatId: string | null;
  pending: Pending;
  streamPhase: ChatStreamPhase;
}): {
  approve: (decision: ApprovalDecision) => void;
  card: ApprovalCard | null;
} {
  const resolveApproval = useResolveToolApproval({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [invalidation, setInvalidation] = useState<Invalidation | null>(null);
  // 직전에 본 pending. 리듀서가 pending을 지우며 확정(정상)하거나 비정상 종료로 날리는데,
  // 후자면 pending이 이미 null이라 직전 값을 붙잡아 만료 카드로 남긴다.
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
    // 승인을 기다리다 스트림이 비정상 종료했다 — 직전 승인을 만료 카드로 남긴다.
    setInvalidation({
      approvalId: trackedPending.approvalId,
      approval: trackedPending,
      reason: EXPIRED_REASON,
    });
  } else if (streamPhase === "streaming") {
    // 새 턴이 시작됐다 — 지난 무효화·추적을 접는다.
    if (invalidation) setInvalidation(null);
    if (trackedPending) setTrackedPending(null);
  }

  const approve = useCallback(
    (decision: ApprovalDecision) => {
      const target = pending;
      if (!target || !chatId) return;
      // 접수(204)일 뿐 — 확정은 스트림이 한다. 그 사이 버튼이 다시 눌리면 중복 결정이 나간다.
      setSubmittedId(target.approvalId);
      resolveApproval.mutate(
        { chatId, approvalId: target.approvalId, data: { decision } },
        {
          onError: (error: unknown) => {
            // 스트림이 먼저 확정했으면(늦게 온 오류) pending이 이미 지워졌다 — 죽은 카드를
            // 되살리거나 헛토스트를 띄우지 않는다.
            if (pendingRef.current?.approvalId !== target.approvalId) return;
            const code = errorCodeOf(error);
            if (code && code in TERMINAL_REASON) {
              // 다시 눌러도 같은 오류다 — 카드를 무효화한다(인라인이 사유를 보인다).
              setInvalidation({
                approvalId: target.approvalId,
                approval: target,
                reason: TERMINAL_REASON[code],
              });
              return;
            }
            // 재시도할 수 있는 실패다 — 잠금을 풀고, 인라인이 없으니 여기서만 토스트한다.
            setSubmittedId(null);
            toast.error(errorMessageOf(error, "승인을 처리하지 못했습니다."));
          },
        }
      );
    },
    [chatId, pending, resolveApproval]
  );

  let card: ApprovalCard | null = null;
  if (invalidation && (!pending || pending.approvalId === invalidation.approvalId)) {
    card = {
      tool: invalidation.approval.tool,
      summary: invalidation.approval.summary,
      state: { kind: "invalidated", reason: invalidation.reason },
    };
  } else if (pending) {
    card = {
      tool: pending.tool,
      summary: pending.summary,
      state:
        submittedId === pending.approvalId ? { kind: "submitted" } : { kind: "open" },
    };
  }

  return { approve, card };
}
