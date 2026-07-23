import { HttpResponse, http } from "msw";

import {
  buildApprovalPlan,
  buildChatEvents,
  type MockSseEvent,
} from "@/lib/mocks/chat-stream";
import { mockDb } from "@/lib/mocks/db";

/** 토큰 사이 간격. 스트리밍이 눈에 보이되 테스트가 지루해지지 않는 값. */
const TOKEN_DELAY_MS = 40;

/**
 * 승인 대기처럼 이벤트 없이 스트림을 열어 두는 구간을 흉내낸다. 이벤트가 아니므로
 * web은 무시해야 하고, 무시하지 못하면 파서가 깨진다 — 그걸 목이 드러내 준다.
 */
const KEEPALIVE_COMMENT = ": keepalive\n\n";

/**
 * 승인 대기 상한. 계약은 300초다. 사람이 카드를 읽고 누를 시간이 있어야 하므로 데모에서는
 * 넉넉히 두고, 테스트만 짧게 덮어쓴다 — 짧은 값을 기본으로 두면 데모에서 누르기도 전에
 * 자동 거절되고 그 뒤 클릭은 APPROVAL_NOT_FOUND가 된다.
 * 만료되면 REJECTED로 처리되고 스트림은 정상 종료된다 (계약과 같은 결말).
 */
const DEFAULT_APPROVAL_TIMEOUT_MS = 120_000;

let approvalTimeoutMs = DEFAULT_APPROVAL_TIMEOUT_MS;

/** 테스트 전용 — 만료 경로를 기다리지 않고 확인하기 위한 것이다. */
export function setApprovalTimeoutForTests(ms: number) {
  approvalTimeoutMs = ms;
}

type PendingApproval = {
  resolve: (decision: "APPROVED" | "REJECTED") => void;
};

/** 열린 스트림이 기다리는 승인들. 승인 API가 여기로 결정을 전달한다. */
const pendingApprovals = new Map<string, PendingApproval>();

/** 채팅별 턴 수. 같은 채팅의 다음 응답이 앞 응답의 id를 재사용하지 않게 한다. */
const turns = new Map<string, number>();

function nextTurn(chatId: string) {
  const turn = (turns.get(chatId) ?? 0) + 1;
  turns.set(chatId, turn);
  return turn;
}

function waitForDecision(approvalId: string) {
  return new Promise<"APPROVED" | "REJECTED">((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(approvalId);
      resolve("REJECTED");
    }, approvalTimeoutMs);

    pendingApprovals.set(approvalId, {
      resolve: (decision) => {
        clearTimeout(timer);
        pendingApprovals.delete(approvalId);
        resolve(decision);
      },
    });
  });
}

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

type EventSource = MockSseEvent[] | (() => AsyncGenerator<MockSseEvent>);

function streamOf(source: EventSource, onClose?: (sent: MockSseEvent[]) => void) {
  const encoder = new TextEncoder();
  const sent: MockSseEvent[] = [];
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(KEEPALIVE_COMMENT));
      try {
        const events = Array.isArray(source) ? source : source();
        for await (const event of events) {
          await new Promise((resolve) => setTimeout(resolve, TOKEN_DELAY_MS));
          sent.push(event);
          controller.enqueue(
            encoder.encode(`event: ${event.event}\ndata: ${event.data}\n\n`)
          );
        }
      } finally {
        // 잠금은 스트림이 사는 동안 유지된다. 여기서 풀지 않고 응답 직전에 풀면
        // 첫 응답이 아직 흐르는 사이 다음 요청이 통과해 계약(CHAT_LOCKED)을 어긴다.
        onClose?.(sent);
      }
      // 종료 이벤트 없이 닫히는 경우가 있다 — 계약이 말하는 세 번째 종료 경로다.
      controller.close();
    },
  });
}

function sseResponse(
  source: EventSource,
  onClose?: (sent: MockSseEvent[]) => void
) {
  return new HttpResponse(streamOf(source, onClose), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function failure(code: string, status: number) {
  return HttpResponse.json(
    { success: false, data: null, error: { code, message: code, details: null } },
    { status }
  );
}

/**
 * server가 스트림을 중계하며 하는 tee를 목도 흉내낸다. 유저 메시지·완성된 응답·도구 실행
 * 기록이 히스토리에 남아야 새로고침 복원과 관전자 폴링이 산다.
 */
function teePersonal(chatId: string, message: string, events: MockSseEvent[]) {
  mockDb.appendAgentChatMessage(chatId, {
    role: "USER",
    content: message,
    toolEvent: null,
  });
  for (const event of events) {
    if (event.event === "tool_approval_resolved") {
      const payload = JSON.parse(event.data);
      mockDb.appendAgentChatMessage(chatId, {
        role: "TOOL",
        content:
          payload.decision === "APPROVED"
            ? "테스트 유저님이 승인"
            : "테스트 유저님이 거절",
        toolEvent: {
          tool: "linear.create_issue",
          decision: payload.decision,
          status: null,
          url: null,
        },
      });
    }
    if (event.event === "tool_call_result") {
      const payload = JSON.parse(event.data);
      mockDb.appendAgentChatMessage(chatId, {
        role: "TOOL",
        content: payload.summary ?? "도구 실행",
        toolEvent: {
          tool: "linear.create_issue",
          decision: null,
          status: payload.status,
          url: payload.url ?? null,
        },
      });
    }
    if (event.event === "message_end") {
      mockDb.appendAgentChatMessage(chatId, {
        role: "ASSISTANT",
        content: JSON.parse(event.data).content,
        toolEvent: null,
      });
    }
  }
}

function teeShared(noteId: string, message: string, events: MockSseEvent[]) {
  mockDb.appendSharedChatMessage(noteId, {
    role: "USER",
    content: message,
    authorName: "테스트 유저",
    toolEvent: null,
  });
  for (const event of events) {
    if (event.event === "tool_approval_resolved") {
      const payload = JSON.parse(event.data);
      mockDb.appendSharedChatMessage(noteId, {
        role: "TOOL",
        content:
          payload.decision === "APPROVED"
            ? "테스트 유저님이 승인"
            : "테스트 유저님이 거절",
        authorName: null,
        toolEvent: {
          tool: "linear.create_issue",
          decision: payload.decision,
          status: null,
          url: null,
        },
      });
    }
    if (event.event === "tool_call_result") {
      const payload = JSON.parse(event.data);
      mockDb.appendSharedChatMessage(noteId, {
        role: "TOOL",
        content: payload.summary ?? "도구 실행",
        authorName: null,
        toolEvent: {
          tool: "linear.create_issue",
          decision: null,
          status: payload.status,
          url: payload.url ?? null,
        },
      });
    }
    if (event.event === "message_end") {
      mockDb.appendSharedChatMessage(noteId, {
        role: "ASSISTANT",
        content: JSON.parse(event.data).content,
        authorName: null,
        toolEvent: null,
      });
    }
  }
}

/**
 * 승인이 필요한 메시지면 request까지 흘린 뒤 **실제로 멈춰서** 승인 API를 기다린다.
 * 목이 스스로 승인해 버리면 web은 승인 카드도 거절 경로도 밟을 수 없다.
 */
function eventSourceFor(
  chatId: string,
  message: string,
  onWaiting?: (pending: { approvalId: string; tool: string; summary: string } | null) => void
): EventSource {
  const turn = nextTurn(chatId);
  const plan = buildApprovalPlan({ chatId, message, turn });
  if (!plan) return buildChatEvents({ chatId, message, turn });

  return async function* () {
    yield* plan.before;
    onWaiting?.({
      approvalId: plan.approvalId,
      tool: "linear.create_issue",
      summary: "Linear 이슈 'APP 버그 수정' 생성",
    });
    const decision = await waitForDecision(plan.approvalId);
    onWaiting?.(null);
    yield* plan.after(decision);
  };
}

export const chatSseHandlers = [
  http.post("*/v1/agent-chats/:chatId/messages", async ({ request, params }) => {
    const body = (await request.json()) as { message: string };
    const chatId = id(params.chatId);

    // 없는/남의 채팅이면 스트림을 반쯤 열지 않고 깔끔한 404를 준다 (계약).
    try {
      mockDb.getAgentChatMessages(chatId);
    } catch {
      return failure("AGENT_CHAT_NOT_FOUND", 404);
    }

    return sseResponse(eventSourceFor(chatId, body.message), (sent) =>
      teePersonal(chatId, body.message, sent)
    );
  }),

  http.post("*/v1/notes/:noteId/chat/messages", async ({ request, params }) => {
    const body = (await request.json()) as { message: string };
    const noteId = id(params.noteId);

    // 빈 메시지는 잠금을 잡기 전에 막는다 — 잡고 나서 실패하면 잠금이 남는다.
    if (!body.message?.trim()) return failure("BAD_REQUEST", 400);

    // 게이트는 스트림을 열기 전에 통과시킨다 — 계약상 실패는 SSE가 아니라 JSON으로 온다.
    try {
      mockDb.acquireSharedChatLock(noteId);
    } catch (error) {
      const code = (error as Error).message;
      return failure(code, code === "NOTE_NOT_FOUND" ? 404 : 409);
    }

    return sseResponse(
      eventSourceFor(noteId, body.message, (pending) =>
        mockDb.setSharedChatPendingApproval(noteId, pending)
      ),
      (sent) => {
        teeShared(noteId, body.message, sent);
        mockDb.releaseSharedChatLock(noteId);
      }
    );
  }),

  // 승인은 스트림 밖 별도 요청이다. 열려서 기다리는 스트림에 결정을 전달한다.
  http.post(
    "*/v1/agent-chats/:chatId/approvals/:approvalId",
    async ({ request, params }) => {
      const approvalId = id(params.approvalId);
      const pending = pendingApprovals.get(approvalId);
      // 대기 중인 승인이 없으면(만료·오타·이미 처리) 계약대로 404다.
      if (!pending) return failure("APPROVAL_NOT_FOUND", 404);

      const body = (await request.json()) as { decision?: string };
      if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
        // 계약은 두 값 밖을 400으로 막는다. 기본값을 APPROVED로 두면 오타가 쓰기 도구를 실행한다.
        return failure("BAD_REQUEST", 400);
      }
      pending.resolve(body.decision);
      // 계약은 bodyless 204다. 200 JSON을 주면 생성 클라이언트가 서버와 다르게 굴러간다.
      return new HttpResponse(null, { status: 204 });
    }
  ),
];
