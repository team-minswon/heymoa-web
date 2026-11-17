import { HttpResponse, http } from "msw";

import {
  type ApprovalPlan,
  buildApprovalPlan,
  buildChatEvents,
  type MockSseEvent,
  tsid,
} from "@/lib/mocks/chat-stream";
import {
  hasScenario,
  leadSilenceMs,
  stallSilenceMs,
} from "@/lib/mocks/chat-scenarios";
import { joinSummary } from "@/lib/chat/blocks";
import type { ScopeRef } from "@/lib/mocks/db";
import { mockDb } from "@/lib/mocks/db";
import { meetingFlow } from "@/lib/mocks/meeting-flow";
import { emitChatsChanged, onMockUserEvent } from "@/lib/mocks/user-events";
import type { AgentChatMessagesResponseDataActiveTurnPendingApprovalCard as ApprovalCard } from "@/lib/api/generated/models";

const EVENT_DELAY_MS: Record<string, number> = {
  message_start: 220,
  thinking_delta: 700,
  tool_call_start: 350,
  tool_call_result: 1_600,
  tool_approval_request: 500,
  tool_approval_resolved: 400,
  scope_miss: 300,
  message_end: 350,
  error: 400,
};

const TOKEN_DELAY_MS = 55;

const HEARTBEAT_MS = 10_000;

const STREAM_TTL_MS = 10 * 60_000;

const CHAT_LIST_EVENTS = new Set([
  "message_start",
  "tool_approval_request",
  "tool_approval_resolved",
]);

const TERMINAL_EVENTS = new Set([
  "message_end",
  "turn_failed",
  "turn_cancelled",
]);

let streamSpeed = 1;

export function setStreamSpeedForTests(value: number) {
  streamSpeed = value > 0 ? value : 1;
}

function speed() {
  if (streamSpeed !== 1) return streamSpeed;
  if (typeof localStorage === "undefined") return 1;
  const value = Number(localStorage.getItem("mockChatSpeed"));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function delayOf(event: string, message: string) {
  if (hasScenario(message, "resync")) return 0;
  const lead =
    event === "message_start" || event === "tool_approval_resolved"
      ? leadSilenceMs(message)
      : 0;
  return (
    ((EVENT_DELAY_MS[event] ?? TOKEN_DELAY_MS) + lead) / speed() +
    stallSilenceMs(message, event)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PendingApproval = {
  stream: MockTurnStream;
  message: string;
  plan: ApprovalPlan;
};

const pendingApprovals = new Map<string, PendingApproval>();

type Frame = {
  id: string;
  event: string;
  payload: unknown;
};

type TurnStatus =
  | "IN_PROGRESS"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type Turn = {
  turnId: string;
  status: TurnStatus;
  failureCode: string | null;
  retryable: boolean | null;
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
    args: Record<string, unknown> | null;
    card: ApprovalCard | null;
  } | null;
  approvalEntryId: string | null;
  partial: string;
  startedSummaries: Map<string, string | null>;
  startedArgs: Map<string, Record<string, unknown>>;
  approvalTool: string | null;
};

type LiveTurnStatus = Extract<TurnStatus, "IN_PROGRESS" | "WAITING_APPROVAL">;

function isLiveStatus(status: TurnStatus): status is LiveTurnStatus {
  return status === "IN_PROGRESS" || status === "WAITING_APPROVAL";
}

function isLive(turn: Turn | null): turn is Turn {
  return turn !== null && isLiveStatus(turn.status);
}

type MockTurnStream = {
  chatId: string;
  turn: Turn;
  frames: Frame[];
  subscribers: Set<(frame: Frame) => void>;
  closers: Set<() => void>;
  finishedAt: number | null;
  ttlMs: number;
  cutFirstAfter: number | null;
};

const turns = new Map<string, MockTurnStream>();

const chats = new Map<string, { last: MockTurnStream | null; count: number }>();

export function resetChatStreamsForTests() {
  turns.clear();
  chats.clear();
  pendingApprovals.clear();
}

export function agentChatTurnState(chatId: string) {
  const turn = chats.get(chatId)?.last?.turn ?? null;
  return {
    cursor: isLive(turn) ? turn.approvalEntryId : null,
    activeTurn: isLive(turn)
      ? {
          turnId: turn.turnId,
          status: turn.status,
          pendingApproval: turn.pendingApproval,
        }
      : null,
    lastTurn: turn
      ? {
          turnId: turn.turnId,
          status: turn.status,
          failureCode: turn.failureCode,
          retryable: turn.retryable,
        }
      : null,
  };
}

export function runningTurnOf(
  chatId: string
): { turnId: string; status: LiveTurnStatus } | null {
  const turn = chats.get(chatId)?.last?.turn ?? null;
  if (turn === null || !isLiveStatus(turn.status)) return null;
  return { turnId: turn.turnId, status: turn.status };
}

function chatOf(chatId: string) {
  const found = chats.get(chatId);
  if (found) return found;
  const created = { last: null, count: 0 };
  chats.set(chatId, created);
  return created;
}

function openTurn(
  chatId: string,
  turn: Partial<Turn> & { turnId: string },
  options: { ttlMs?: number; cutFirstAfter?: number | null } = {}
): MockTurnStream {
  const stream: MockTurnStream = {
    chatId,
    turn: {
      status: "IN_PROGRESS",
      failureCode: null,
      retryable: null,
      pendingApproval: null,
      approvalEntryId: null,
      partial: "",
      startedSummaries: new Map(),
      startedArgs: new Map(),
      approvalTool: null,
      ...turn,
    },
    frames: [],
    subscribers: new Set(),
    closers: new Set(),
    finishedAt: null,
    ttlMs: options.ttlMs ?? STREAM_TTL_MS,
    cutFirstAfter: options.cutFirstAfter ?? null,
  };
  turns.set(turn.turnId, stream);
  chatOf(chatId).last = stream;
  return stream;
}

export function seedAgentChatTurnForTests(chatId: string, turn: Partial<Turn>) {
  openTurn(chatId, { turnId: tsid(`turn-${chatId}-seed`), ...turn });
}

let lastEntryMs = 0;
let lastEntrySeq = 0;

function nextEntryId() {
  const now = Date.now();
  if (now === lastEntryMs) lastEntrySeq += 1;
  else {
    lastEntryMs = now;
    lastEntrySeq = 0;
  }
  return `${now}-${lastEntrySeq}`;
}

function publish(stream: MockTurnStream, event: string, payload: unknown) {
  const frame: Frame = { id: nextEntryId(), event, payload };
  stream.frames.push(frame);
  accumulate(stream, frame);
  for (const notify of [...stream.subscribers]) notify(frame);
  if (CHAT_LIST_EVENTS.has(event)) emitChatsChanged();
  if (TERMINAL_EVENTS.has(event)) {
    settleTurn(stream, TERMINAL_STATUS[event], payloadOf(frame).code);
    if (event === "message_end") scheduleAiTitle(stream.chatId);
    return;
  }
  if (event === "tool_approval_request") {
    stream.turn.approvalEntryId = frame.id;
    for (const close of [...stream.closers]) close();
  }
}

function restCard(payload: unknown): ApprovalCard | null {
  const card = (payload as { card?: SseCard }).card;
  if (!card) return null;
  const field = (each: SseField) => ({
    label: each.label,
    value: each.value ?? null,
    before: each.before ?? null,
    after: each.after ?? null,
    added: each.added ?? null,
    removed: each.removed ?? null,
    kept: each.kept ?? null,
  });
  return {
    title: card.title,
    target: card.target ?? null,
    warning: card.warning ?? null,
    fields: (card.fields ?? []).map(field),
    items:
      card.items?.map((item) => ({
        title: item.title,
        target: item.target ?? null,
        fields: (item.fields ?? []).map(field),
      })) ?? null,
    body: card.body ?? null,
  };
}

type SseField = {
  label: string;
  value?: string;
  before?: string;
  after?: string;
  added?: string[];
  removed?: string[];
  kept?: string[];
};
type SseCard = {
  title: string;
  target?: string;
  warning?: string;
  fields?: SseField[];
  items?: { title: string; target?: string; fields?: SseField[] }[];
  body?: { label: string; text: string };
};

const TERMINAL_STATUS: Record<string, TurnStatus> = {
  message_end: "COMPLETED",
  turn_failed: "FAILED",
  turn_cancelled: "CANCELLED",
};

function payloadOf(frame: Frame) {
  return (frame.payload ?? {}) as Record<string, string | boolean | undefined>;
}

function accumulate(stream: MockTurnStream, frame: Frame) {
  const { chatId, turn } = stream;
  const payload = frame.payload as Record<string, string | null | undefined>;

  if (frame.event === "token") {
    turn.partial += String(payload.delta ?? "");
    return;
  }

  if (frame.event === "tool_call_start") {
    turn.startedSummaries.set(
      String(payload.toolCallId),
      payload.summary ?? null
    );
    const args = (frame.payload as { args?: unknown }).args;
    if (args && typeof args === "object") {
      turn.startedArgs.set(
        String(payload.toolCallId),
        args as Record<string, unknown>
      );
    }
    return;
  }

  if (frame.event === "thinking_delta") {
    const text = String(payload.text ?? "");
    if (text.trim()) {
      mockDb.appendAgentChatMessage(chatId, {
        role: "THINKING",
        turnId: turn.turnId,
        scope: [],
        content: text,
        toolEvent: null,
      });
    }
    return;
  }
  if (frame.event === "tool_approval_request") {
    turn.status = "WAITING_APPROVAL";
    turn.approvalTool = String(payload.tool);
    turn.pendingApproval = {
      approvalId: String(payload.approvalId),
      tool: String(payload.tool),
      summary: payload.summary ?? null,
      args: turn.startedArgs.get(String(payload.toolCallId)) ?? null,
      card: restCard(frame.payload),
    };
    return;
  }
  if (frame.event === "tool_approval_resolved") {
    const card = turn.pendingApproval?.card ?? null;
    turn.pendingApproval = null;
    mockDb.appendAgentChatMessage(chatId, {
      role: "TOOL",
      turnId: turn.turnId,
      scope: [],
      content:
        payload.decision === "APPROVED"
          ? "테스트 유저님이 승인"
          : "테스트 유저님이 거절",
      toolEvent: {
        tool: turn.approvalTool ?? "linear.create_issue",
        decision: payload.decision as "APPROVED" | "REJECTED",
        status: null,
        url: null,
        card,
      },
    });
    return;
  }
  if (frame.event === "tool_call_result") {
    mockDb.appendAgentChatMessage(chatId, {
      role: "TOOL",
      turnId: turn.turnId,
      scope: [],
      content:
        joinSummary(
          turn.startedSummaries.get(String(payload.toolCallId)) ?? null,
          payload.summary ?? null
        ) ?? "도구 실행",
      toolEvent: {
        tool: payload.tool ?? turn.approvalTool ?? "linear.create_issue",
        decision: null,
        status: payload.status as "success" | "error",
        url: payload.url ?? null,
        card: null,
      },
    });
    return;
  }
  if (frame.event === "message_end") {
    const end = frame.payload as {
      content: string;
      refs?: { kind?: string; id: string; title: string }[];
    };
    mockDb.appendAgentChatMessage(chatId, {
      role: "ASSISTANT",
      turnId: turn.turnId,
      content: end.content,
      scope: (end.refs ?? []).map((ref) => ({
        kind: (ref.kind ?? "note").toUpperCase() as ScopeRef["kind"],
        id: ref.id,
        title: ref.title,
        unavailable: false,
      })),
      toolEvent: null,
    });
    return;
  }
  if (frame.event === "turn_cancelled" && turn.partial.trim()) {
    mockDb.appendAgentChatMessage(chatId, {
      role: "ASSISTANT",
      turnId: turn.turnId,
      content: turn.partial.trimEnd(),
      scope: [],
      toolEvent: null,
    });
  }
}

const AI_TITLE_DELAY_MS = 3_000;

function scheduleAiTitle(chatId: string) {
  setTimeout(() => {
    if (mockDb.retitleAgentChatByAi(chatId)) emitChatsChanged();
  }, AI_TITLE_DELAY_MS / speed());
}

const NON_RETRYABLE_FAILURES = new Set(["UPSTREAM_REJECTED", "INTERNAL_ERROR"]);

function settleTurn(
  stream: MockTurnStream,
  status: TurnStatus,
  failureCode?: unknown
) {
  const { turn } = stream;
  if (isLive(turn)) {
    turn.status = status;
    turn.pendingApproval = null;
    if (status === "FAILED") {
      const code =
        typeof failureCode === "string" ? failureCode : "INTERNAL_ERROR";
      turn.failureCode = code;
      turn.retryable = !NON_RETRYABLE_FAILURES.has(code);
    }
  }
  stream.finishedAt = Date.now();
  for (const close of [...stream.closers]) close();
  emitChatsChanged();
}

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

function failure(code: string, status: number) {
  return HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code, message: code, details: null },
    },
    { status }
  );
}

function accepted(turnId: string) {
  return HttpResponse.json(
    { success: true, data: { turnId }, error: null },
    { status: 202 }
  );
}

function noteScope(noteId: string): ScopeRef {
  const note = mockDb.findNoteBrief(noteId);
  return {
    kind: "NOTE",
    id: noteId,
    title: note?.title ?? null,
    unavailable: !note,
  };
}

function projectScope(projectId: string): ScopeRef {
  const project = mockDb.findProjectBrief(projectId);
  return {
    kind: "PROJECT",
    id: projectId,
    title: project?.name ?? null,
    unavailable: !project,
  };
}

function buildInput(
  chatId: string,
  message: string,
  turn: number,
  scope: ScopeRef[],
  turnId: string
) {
  const named = scope.flatMap((each) =>
    each.title && !each.unavailable
      ? [
          {
            kind: each.kind.toLowerCase() as "note" | "project",
            id: each.id,
            title: each.title,
          },
        ]
      : []
  );
  return {
    chatId,
    message,
    turn,
    scope: named,
    turnId,
  };
}

async function drain(
  stream: MockTurnStream,
  message: string,
  events: MockSseEvent[]
) {
  for (const event of events) {
    if (turns.get(stream.turn.turnId) !== stream) return false;
    if (stream.turn.status !== "IN_PROGRESS") return false;
    await wait(delayOf(event.event, message));
    publish(stream, event.event, JSON.parse(event.data));
    if (event.event === "error") {
      publish(stream, "turn_failed", {
        turnId: stream.turn.turnId,
        code: "UPSTREAM_ERROR",
        retryable: true,
      });
    }
  }
  return true;
}

async function runTurn(
  stream: MockTurnStream,
  message: string,
  turnNumber: number,
  scope: ScopeRef[]
) {
  const input = buildInput(
    stream.chatId,
    message,
    turnNumber,
    scope,
    stream.turn.turnId
  );
  const plan = buildApprovalPlan(input);
  if (!plan) {
    if (await drain(stream, message, buildChatEvents(input)))
      settleZombie(stream);
    return;
  }

  pendingApprovals.set(plan.approvalId, { stream, message, plan });
  await drain(stream, message, plan.before);
}

async function runResume(
  stream: MockTurnStream,
  message: string,
  plan: ApprovalPlan,
  decision: "APPROVED" | "REJECTED"
) {
  if (await drain(stream, message, plan.after(decision))) settleZombie(stream);
}

function settleZombie(stream: MockTurnStream) {
  settleTurn(stream, "FAILED", "STREAM_INTERRUPTED");
}

const encoder = new TextEncoder();

function render(frame: Frame) {
  return `id: ${frame.id}\nevent: ${frame.event}\ndata: ${JSON.stringify(frame.payload)}\n\n`;
}

function subscribe(stream: MockTurnStream, after: string | null) {
  let notify: ((frame: Frame) => void) | null = null;
  let close: (() => void) | null = null;
  let beat: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream({
    start(controller) {
      const stop = () => {
        if (beat) clearInterval(beat);
        if (notify) stream.subscribers.delete(notify);
        if (close) stream.closers.delete(close);
        try {
          controller.close();
        } catch {}
      };
      const cutAfter = after === null ? stream.cutFirstAfter : null;
      let served = 0;
      const write = (frame: Frame) => {
        try {
          controller.enqueue(encoder.encode(render(frame)));
        } catch {}
        served += 1;
        if (cutAfter !== null && served >= cutAfter) stop();
      };

      const start =
        after === null
          ? 0
          : stream.frames.findIndex((frame) => frame.id === after) + 1;
      for (const frame of stream.frames.slice(start)) {
        write(frame);
        if (cutAfter !== null && served >= cutAfter) return;
      }

      if (stream.turn.status !== "IN_PROGRESS") {
        stop();
        return;
      }

      notify = write;
      close = stop;
      stream.subscribers.add(notify);
      stream.closers.add(close);
      beat = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        HEARTBEAT_MS / speed()
      );
    },
    cancel() {
      if (beat) clearInterval(beat);
      if (notify) stream.subscribers.delete(notify);
      if (close) stream.closers.delete(close);
    },
  });
}

function sseResponse(body: ReadableStream) {
  return new HttpResponse(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function userEventStream() {
  let beat: ReturnType<typeof setInterval> | null = null;
  let hint: ReturnType<typeof setInterval> | null = null;
  let analysis: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  const frame = (event: string, data: unknown) =>
    encoder.encode(`event:${event}\ndata:${JSON.stringify(data)}\n\n`);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        frame("ready", {
          v: 1,
          connectionId: "MOCKCONN00001",
          serverTime: new Date().toISOString(),
          maxAgeSec: 1500,
        })
      );
      beat = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        15_000
      );
      hint = setInterval(
        () => controller.enqueue(frame("notifications.changed", {})),
        60_000
      );
      unsubscribe = onMockUserEvent((event, data) => {
        try {
          controller.enqueue(frame(event, data));
        } catch {}
      });
      analysis = setInterval(() => {
        for (const noteId of meetingFlow.dueAnalysisNoteIds())
          controller.enqueue(
            frame("note.changed", {
              workspaceId: "",
              noteId,
              aspects: ["analysis"],
            })
          );
      }, 2_000);
    },
    cancel() {
      if (beat) clearInterval(beat);
      if (hint) clearInterval(hint);
      if (analysis) clearInterval(analysis);
      unsubscribe?.();
    },
  });
}

export const chatSseHandlers = [
  http.get("*/v1/events", () => sseResponse(userEventStream())),
  http.post(
    "*/v1/agent-chats/:chatId/messages",
    async ({ request, params }) => {
      const body = (await request.json()) as {
        message: string;
        noteIds?: string[];
        projectIds?: string[];
      };
      const chatId = id(params.chatId);

      if (!body.message?.trim()) return failure("BAD_REQUEST", 400);

      try {
        mockDb.getAgentChatMessages(chatId);
      } catch {
        return failure("AGENT_CHAT_NOT_FOUND", 404);
      }

      const scope: ScopeRef[] = [
        ...(body.noteIds ?? []).map((noteId) => noteScope(noteId)),
        ...(body.projectIds ?? []).map((projectId) => projectScope(projectId)),
      ];

      const chat = chatOf(chatId);

      if (hasScenario(body.message, "conflict")) {
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "AGENT_CHAT_TURN_IN_PROGRESS",
              message: "이미 진행 중인 턴이 있습니다.",
              details: [
                { field: "turnId", message: tsid(`turn-${chatId}-other`) },
              ],
            },
          },
          { status: 409 }
        );
      }

      if (chat.last && isLive(chat.last.turn)) {
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "AGENT_CHAT_TURN_IN_PROGRESS",
              message: "이미 진행 중인 턴이 있습니다.",
              details: [{ field: "turnId", message: chat.last.turn.turnId }],
            },
          },
          { status: 409 }
        );
      }

      chat.count += 1;
      const stream = openTurn(
        chatId,
        { turnId: tsid(`turn-${chatId}-${chat.count}`) },
        hasScenario(body.message, "resync")
          ? { ttlMs: 0, cutFirstAfter: 2 }
          : {}
      );
      mockDb.appendAgentChatMessage(chatId, {
        role: "USER",
        turnId: stream.turn.turnId,
        content: body.message,
        scope,
        toolEvent: null,
      });

      if (!hasScenario(body.message, "zombie")) {
        void runTurn(stream, body.message, chat.count, scope);
      }

      return accepted(stream.turn.turnId);
    }
  ),

  http.get(
    "*/v1/agent-chats/:chatId/turns/:turnId/events",
    ({ request, params }) => {
      const chatId = id(params.chatId);
      try {
        mockDb.getAgentChatMessages(chatId);
      } catch {
        return failure("AGENT_CHAT_NOT_FOUND", 404);
      }
      const stream = turns.get(id(params.turnId));
      if (!stream || stream.chatId !== chatId) {
        return failure("AGENT_CHAT_TURN_NOT_FOUND", 404);
      }
      if (
        stream.finishedAt !== null &&
        Date.now() - stream.finishedAt >= stream.ttlMs
      ) {
        return failure("AGENT_CHAT_STREAM_GONE", 410);
      }
      return sseResponse(
        subscribe(stream, new URL(request.url).searchParams.get("after"))
      );
    }
  ),

  http.post("*/v1/agent-chats/:chatId/turns/:turnId/cancel", ({ params }) => {
    const chatId = id(params.chatId);
    try {
      mockDb.getAgentChatMessages(chatId);
    } catch {
      return failure("AGENT_CHAT_NOT_FOUND", 404);
    }
    const stream = turns.get(id(params.turnId));
    if (!stream || stream.chatId !== chatId) {
      return failure("AGENT_CHAT_TURN_NOT_FOUND", 404);
    }
    if (isLive(stream.turn)) {
      publish(stream, "turn_cancelled", { turnId: stream.turn.turnId });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    "*/v1/agent-chats/:chatId/approvals/:approvalId/resolve",
    async ({ request, params }) => {
      const chatId = id(params.chatId);
      const approvalId = id(params.approvalId);
      const pending = pendingApprovals.get(approvalId);
      if (!pending || pending.stream.chatId !== chatId) {
        return failure("APPROVAL_NOT_FOUND", 404);
      }
      const { stream } = pending;
      if (stream.turn.status !== "WAITING_APPROVAL") {
        return failure("APPROVAL_NOT_FOUND", 404);
      }

      const body = (await request.json()) as { decision?: string };
      if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
        return failure("BAD_REQUEST", 400);
      }

      pendingApprovals.delete(approvalId);
      stream.turn.status = "IN_PROGRESS";

      void runResume(stream, pending.message, pending.plan, body.decision);

      return accepted(stream.turn.turnId);
    }
  ),
];
