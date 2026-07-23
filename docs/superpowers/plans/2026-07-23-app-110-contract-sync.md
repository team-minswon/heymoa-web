# APP-110 계약 반영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** heymoa-server가 구현을 끝낸 34경로를 web이 호출할 수 있게 만들고, 상태 전이와 SSE 스트리밍이 실제로 도는 MSW 목을 붙인다.

**Architecture:** 계약 파일을 docs repo에서 복사해 orval로 훅·목을 생성하고, `lib/mocks/db.ts`의 기존 상태 저장소를 확장해 초대·알림·멤버·회의·분석·연동 전이를 돌린다. 채팅 SSE는 이벤트 시퀀스를 만드는 순수 함수와 그것을 스트림으로 흘리는 MSW 핸들러로 나눈다. Playwright 스모크가 브라우저 서비스 워커 경로를 덮는다.

**Tech Stack:** Next.js 16, TanStack Query, orval 8, MSW 2, faker 10, vitest 4 (jsdom), Playwright(신규)

**Spec:** `docs/superpowers/specs/2026-07-23-app-110-contract-sync-design.md`

## Global Constraints

- `openapi3.yml`은 **34경로**. `/internal/**` 3경로와 그 경로만 쓰던 `Internal*` 스키마를 제외한다.
- SSE 두 경로(`sendAgentChatMessage`, `sendNoteSharedChatMessage`)는 생성 훅을 쓰지 않고 `lib/api/sse.ts`의 `postEventStream()` 위에 만든다.
- MSW 핸들러는 **명시적 override 응답**만 쓴다. faker 기본값 금지 — 무작위 `success: false`가 인증을 깬다. 성공 응답은 `{ success: true, data, error: null }`.
- API 직접 `fetch` 금지. 예외는 `lib/api/fetcher.ts`와 `lib/api/sse.ts` 둘뿐.
- hydration 규칙: 목의 id·시각은 `nextId()`·`nextTimestamp()`를 쓴다. `Date.now()`·`Math.random()` 금지.
- Next.js 16: 미들웨어는 `proxy.ts`. **`middleware.ts`를 만들지 않는다** (404 루프).
- 리뷰 게이트는 로컬 `codex exec review --base dev` 하나. PR 원격 리뷰는 안 받는다. 판단은 `docs/codex-review-app-110.md`에 남긴다.
- 계약 미러와 orval 생성물에 대한 codex 지적은 반영하지 않는다 — 기록만 하고 서버 이슈로 올린다.
- 전체 검증: `pnpm orval && pnpm test:run && pnpm lint && pnpm build && pnpm test:e2e`
- 완료 시 PR 없이 `dev`로 squash-merge하고 Linear를 Done으로 옮긴다.

## File Structure

| 파일 | 책임 |
|---|---|
| `openapi3.yml` / `asyncapi.yml` | 계약 미러 |
| `lib/api/generated/**` | orval 산출물. 직접 수정 금지 |
| `docs/generated-api-map.md` | 태그 → 실제 생성 경로·훅 이름 |
| `lib/mocks/db.ts` | 목 상태 저장소 |
| `lib/mocks/rest-handlers.ts` | REST 핸들러 등록 |
| `lib/mocks/chat-stream.ts` | SSE 이벤트 시퀀스 (순수 함수) |
| `lib/mocks/sse-handler.ts` | SSE MSW 핸들러 |
| `e2e/smoke.spec.ts` · `playwright.config.ts` | 브라우저 워커 경로 검증 |

---

### Task 1: 계약 파일 반영 — ✅ 완료 (`bc93628`)

34경로 복사, `/internal` 3경로·`internalToken` 스킴 제거, 계약 테스트 확장.

진행 중 발견: `endReason` enum이 APP-120으로 자란 걸 web 테스트가 몰라 깨졌다. 새 값에 주석을 달아 맞췄다.

### Task 2: orval 재생성 — ✅ 완료 (`95263ba`)

새 태그 8개 생성, `docs/generated-api-map.md` 기록, `/internal` 훅 0건 테스트 고정, AGENTS.md 훅 규칙 정확화.

진행 중 발견 둘. **SSE 응답 스키마가 `type: object`라 빌드가 깨졌다** — heymoa-server 정규화기를 고쳐 `type: string`으로 바로잡았다(`d69e672`). **죽은 `Internal*` 스키마**가 아무도 안 쓰는 모델을 만들고 있어 함께 뺐다.

### Task 3: 목 — 초대·알림·멤버 — ✅ 완료 (`dc1f658`)

수락 시 멤버 +1, 거절·취소는 그대로, 중복·기존 멤버 차단, 알림 읽음으로 `unreadCount` 감소, 초대 확정 시 알림 status 동기화. 핸들러가 404/409를 가른다.

---

### Task 4: 목 — 회의·분석·연동

**Files:**
- Modify: `lib/mocks/db.ts`, `lib/mocks/db.test.ts`, `lib/mocks/rest-handlers.ts`

**Interfaces:**
- Consumes: Task 3이 만든 `db.ts` 구조 (`omit()`, `nextId()`, `nextTimestamp()`, `fail()`)
- Produces: `mockDb.endMeeting(noteId)`, `pauseMeeting`, `resumeMeeting`, `requestAnalysis`, `advanceAnalysis`, `getLatestAnalysis`, `listIntegrations`, `connectIntegration`, `disconnectIntegration`. 노트의 `meetingStatus`가 Task 5의 잠금 검사 근거가 된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/mocks/db.test.ts`에 추가한다. `firstNoteId()`는 파일 상단 헬퍼로 둔다.

```typescript
function firstNoteId() {
  const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
  const projectId = mockDb.listProjects(workspaceId)[0].projectId;
  return mockDb.listNotes(projectId)[0].noteId;
}

describe("meeting and analysis", () => {
  beforeEach(() => mockDb.reset());

  it("ending a meeting queues an analysis that later completes", () => {
    const noteId = firstNoteId();

    mockDb.endMeeting(noteId);
    expect(mockDb.getLatestAnalysis(noteId).status).toBe("PENDING");

    mockDb.advanceAnalysis(noteId);

    const done = mockDb.getLatestAnalysis(noteId);
    expect(done.status).toBe("SUCCEEDED");
    expect(done.overview.length).toBeGreaterThan(0);
    expect(done.actionItems.length).toBeGreaterThan(0);
    expect(done.insights.length).toBeGreaterThan(0);
  });

  it("refuses to pause a meeting that already ended", () => {
    const noteId = firstNoteId();
    mockDb.endMeeting(noteId);

    expect(() => mockDb.pauseMeeting(noteId)).toThrow("MEETING_NOT_IN_PROGRESS");
  });

  it("moves a meeting through pause and resume", () => {
    const noteId = firstNoteId();

    expect(mockDb.pauseMeeting(noteId).meetingStatus).toBe("PAUSED");
    expect(mockDb.resumeMeeting(noteId).meetingStatus).toBe("IN_PROGRESS");
    expect(() => mockDb.resumeMeeting(noteId)).toThrow("MEETING_NOT_PAUSED");
  });
});

describe("workspace integrations", () => {
  beforeEach(() => mockDb.reset());

  // 계약은 미연동 provider도 목록에 담는다 (connected: false). 화면이 "연결하기"
  // 버튼을 그리려면 아직 안 붙은 도구도 알아야 하기 때문이다.
  it("lists every supported provider, connected or not", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;

    expect(mockDb.listIntegrations(workspaceId).map((i) => i.provider)).toEqual([
      "LINEAR",
      "GITHUB",
    ]);
    expect(
      mockDb.listIntegrations(workspaceId).every((i) => i.connected === false)
    ).toBe(true);
  });

  it("connecting records who connected it and when", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;

    mockDb.connectIntegration(workspaceId, "LINEAR");

    const linear = mockDb
      .listIntegrations(workspaceId)
      .find((item) => item.provider === "LINEAR");
    expect(linear?.connected).toBe(true);
    // connectedBy는 객체가 아니라 표시 이름 문자열이다 (계약).
    expect(linear?.connectedBy).toBe("테스트 유저");
    expect(linear?.connectedAt).toBeTruthy();
  });

  it("disconnecting clears the connection but keeps the row", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    mockDb.connectIntegration(workspaceId, "LINEAR");

    mockDb.disconnectIntegration(workspaceId, "LINEAR");

    const linear = mockDb
      .listIntegrations(workspaceId)
      .find((item) => item.provider === "LINEAR");
    expect(linear?.connected).toBe(false);
    expect(linear?.connectedBy).toBeNull();
    expect(linear?.connectedAt).toBeNull();
  });
});
```

**SLACK은 목록에 없다.** MVP 범위 밖이라 계약 enum이 `LINEAR`·`GITHUB` 둘만 갖는다(APP-104 결정).

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run lib/mocks/db.test.ts
```

기대: `mockDb.endMeeting is not a function`.

- [ ] **Step 3: 상태와 동작을 구현한다**

응답 타입은 생성 모델을 그대로 쓴다 — `AnalysisResultResponseData`, `MeetingStatusResponseData`, `ToolConnectionsResponseData`. 정확한 필드는 `lib/api/generated/models/`에서 확인한다.

`StoreState`에 `analyses`, `integrations`를 더한다.

```typescript
type MockAnalysis = {
  analysisId: string;
  noteId: string;
  status: string;
  overview: string;
  actionItems: string;
  insights: string;
  createdAt: string;
};

type MockIntegration = {
  workspaceId: string;
  provider: string;
  connectedBy: { userId: string; name: string };
  connectedAt: string;
};
```

동작:

```typescript
endMeeting(noteId: string) {
  const note = findNote(noteId);
  if (note.meetingStatus === "ENDED") fail("MEETING_ALREADY_ENDED");
  note.meetingStatus = "ENDED";
  return this.requestAnalysis(noteId);
},

pauseMeeting(noteId: string) {
  const note = findNote(noteId);
  if (note.meetingStatus !== "IN_PROGRESS") fail("MEETING_NOT_IN_PROGRESS");
  note.meetingStatus = "PAUSED";
  return copy({ noteId, meetingStatus: note.meetingStatus });
},

resumeMeeting(noteId: string) {
  const note = findNote(noteId);
  if (note.meetingStatus !== "PAUSED") fail("MEETING_NOT_PAUSED");
  note.meetingStatus = "IN_PROGRESS";
  return copy({ noteId, meetingStatus: note.meetingStatus });
},

requestAnalysis(noteId: string) {
  findNote(noteId);
  const analysis: MockAnalysis = {
    analysisId: nextId(),
    noteId,
    status: "PENDING",
    overview: "",
    actionItems: "",
    insights: "",
    createdAt: nextTimestamp(),
  };
  state.analyses.push(analysis);
  return copy(analysis);
},

/** 폴링 데모용 — 대기 중인 분석을 완료로 넘긴다. 테스트와 E2E가 호출한다. */
advanceAnalysis(noteId: string) {
  const analysis = latestAnalysis(noteId);
  if (!analysis || analysis.status !== "PENDING") return null;
  analysis.status = "SUCCEEDED";
  analysis.overview = "## 회의 개요\n\n출시 일정과 담당을 정했습니다.";
  analysis.actionItems =
    "- 배포 체크리스트 작성 (김민수)\n- QA 일정 공유 (한지원)";
  analysis.insights = "- 일정 리스크는 QA 인력에 몰려 있습니다.";
  return copy(analysis);
},

getLatestAnalysis(noteId: string) {
  const analysis = latestAnalysis(noteId);
  if (!analysis) fail("ANALYSIS_NOT_FOUND");
  return copy(analysis);
},

listIntegrations(workspaceId: string) {
  assertWorkspace(workspaceId);
  return copy(
    state.integrations.filter((item) => item.workspaceId === workspaceId)
  );
},

connectIntegration(workspaceId: string, provider: string) {
  assertWorkspace(workspaceId);
  const exists = state.integrations.some(
    (item) => item.workspaceId === workspaceId && item.provider === provider
  );
  if (exists) fail("INTEGRATION_ALREADY_CONNECTED");
  const connection: MockIntegration = {
    workspaceId,
    provider,
    connectedBy: { userId: state.user.userId, name: state.user.name },
    connectedAt: nextTimestamp(),
  };
  state.integrations.push(connection);
  return copy(connection);
},

disconnectIntegration(workspaceId: string, provider: string) {
  const index = state.integrations.findIndex(
    (item) => item.workspaceId === workspaceId && item.provider === provider
  );
  if (index === -1) fail("INTEGRATION_NOT_FOUND");
  state.integrations.splice(index, 1);
},
```

`latestAnalysis(noteId)`는 기존 헬퍼 옆에 둔다.

```typescript
function latestAnalysis(noteId: string) {
  return [...state.analyses]
    .reverse()
    .find((analysis) => analysis.noteId === noteId);
}
```

`createSeedState()`에서 `analyses: []`, `integrations: []`로 시드한다 — 연동 연결과 회의 종료를 데모에서 직접 밟게 한다.

- [ ] **Step 4: 통과 확인**

```bash
pnpm vitest run lib/mocks/db.test.ts
```

- [ ] **Step 5: REST 핸들러 등록**

`meeting-pause`, `meeting-resume`, `meeting-end`(202), `analyses`(202), `analyses/latest`, 연동 4개를 `rest-handlers.ts`에 추가한다.

상태 코드를 가르는 형태는 이렇다.

```typescript
http.post("*/v1/notes/:noteId/meeting-pause", ({ params }) => {
  try {
    const data = mockDb.pauseMeeting(id(params.noteId));
    return HttpResponse.json({ success: true, data, error: null }, { status: 200 });
  } catch (error) {
    const code = (error as Error).message;
    return HttpResponse.json(
      { success: false, data: null, error: { code, message: code, details: null } },
      { status: code === "NOTE_NOT_FOUND" ? 404 : 409 }
    );
  }
}),
```

`meeting-resume`, `meeting-end`, `analyses`, `analyses/latest`, 연동 4개도 같은 뼈대에 호출하는 `mockDb` 함수와 성공 상태 코드만 바꿔 쓴다 — `meeting-end`와 `analyses`는 202, 나머지는 200이다. `ANALYSIS_NOT_FOUND`·`INTEGRATION_NOT_FOUND`는 404다.

**OAuth 우회** — `startWorkspaceIntegration`은 외부로 리다이렉트하는 계약이지만 목에서는 우리 도메인의 목 전용 승인 화면으로 보낸다.

```typescript
http.get(
  "*/v1/workspaces/:workspaceId/integrations/:provider/authorize",
  ({ params }) =>
    HttpResponse.json(
      {
        success: true,
        data: {
          authorizeUrl: `/mock-oauth?workspaceId=${id(params.workspaceId)}&provider=${id(params.provider)}`,
        },
        error: null,
      },
      { status: 200 }
    )
),
```

`/mock-oauth` 화면 자체는 APP-145가 디자인하고 APP-115가 구현한다.

- [ ] **Step 6: 검증과 커밋**

```bash
pnpm test:run && pnpm lint && pnpm build
git add lib/mocks
git commit -m "feat(mocks): 회의 상태·분석·워크스페이스 연동 목"
```

---

### Task 5: 목 — 채팅 SSE 스트림

**Files:**
- Create: `lib/mocks/chat-stream.ts`, `lib/mocks/chat-stream.test.ts`, `lib/mocks/sse-handler.ts`
- Modify: `lib/mocks/handlers.ts`, `lib/mocks/db.ts`

**Interfaces:**
- Consumes: Task 4가 노트에 유지하는 `meetingStatus`
- Produces: `buildChatEvents(input): MockSseEvent[]`, `chatSseHandlers`, `mockDb.acquireSharedChatLock(noteId)`, `mockDb.releaseSharedChatLock(noteId)`

- [ ] **Step 1: 이벤트 시퀀스 테스트를 먼저 쓴다**

`lib/mocks/chat-stream.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildChatEvents } from "@/lib/mocks/chat-stream";

const names = (events: { event: string }[]) => events.map((e) => e.event);

describe("buildChatEvents", () => {
  it("streams a plain answer from start to end", () => {
    const events = buildChatEvents({ chatId: "chat-1", message: "요약해줘" });

    expect(names(events)[0]).toBe("message_start");
    expect(names(events).at(-1)).toBe("message_end");
    expect(names(events).filter((n) => n === "token").length).toBeGreaterThan(0);
  });

  it("asks for approval before a write tool and resolves after it", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "Linear 이슈 만들어줘",
    });

    expect(names(events)).toEqual([
      "message_start",
      "token",
      "tool_approval_request",
      "tool_approval_resolved",
      "tool_call_result",
      "token",
      "message_end",
    ]);

    const request = JSON.parse(
      events.find((e) => e.event === "tool_approval_request")!.data
    );
    expect(request.approvalId).toMatch(/^[0-9A-HJKMNP-TV-Z]{13}$/);

    const resolved = JSON.parse(
      events.find((e) => e.event === "tool_approval_resolved")!.data
    );
    expect(resolved.approvalId).toBe(request.approvalId);
  });

  it("pairs tool_call_result with the id that opened the call", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "Linear 이슈 만들어줘",
    });

    const request = JSON.parse(
      events.find((e) => e.event === "tool_approval_request")!.data
    );
    const result = JSON.parse(
      events.find((e) => e.event === "tool_call_result")!.data
    );
    expect(result.toolCallId).toBe(request.toolCallId);
  });

  it("ends with an error event and no message_end when the provider fails", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "장애를 재현해줘",
    });

    expect(names(events).at(-1)).toBe("error");
    expect(names(events)).not.toContain("message_end");
  });

  it("drops the stream without a terminal event when asked", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "연결을 끊어줘",
    });

    expect(names(events)).not.toContain("message_end");
    expect(names(events)).not.toContain("error");
  });
});
```

마지막 둘이 계약의 실패 경로다. `"장애를 재현해줘"`는 `error` 종료, `"연결을 끊어줘"`는 **종료 이벤트 없이 끊기는 세 번째 경로**를 만든다.

- [ ] **Step 2: 실패 확인**

```bash
pnpm vitest run lib/mocks/chat-stream.test.ts
```

기대: 모듈을 찾지 못해 실패.

- [ ] **Step 3: `chat-stream.ts` 구현**

```typescript
export type MockSseEvent = { event: string; data: string };

type BuildInput = {
  chatId: string;
  message: string;
  requestedBy?: string;
};

const TSID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * 13자 TSID를 결정적으로 만든다. 계약이 요구하는 형식이고(아니면 승인 API가 404),
 * 무작위면 테스트가 흔들린다.
 */
function tsid(seed: string) {
  let hash = 7;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 13 }, (_, index) => {
    hash = (hash * 1103515245 + 12345 + index) >>> 0;
    return TSID_ALPHABET[hash % TSID_ALPHABET.length];
  }).join("");
}

function frame(event: string, payload: unknown): MockSseEvent {
  return { event, data: JSON.stringify(payload) };
}

function tokens(text: string): MockSseEvent[] {
  return text.split(" ").map((word) => frame("token", { delta: `${word} ` }));
}

export function buildChatEvents(input: BuildInput): MockSseEvent[] {
  const messageId = tsid(`${input.chatId}:message`);
  const start = frame("message_start", {
    chatId: input.chatId,
    messageId,
  });

  if (input.message.includes("연결을 끊어줘")) {
    return [start, ...tokens("응답을 만들던 중")];
  }

  if (input.message.includes("장애를 재현해줘")) {
    return [
      start,
      ...tokens("응답을 만들던 중"),
      frame("error", {
        code: "LLM_PROVIDER_ERROR",
        message: "응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      }),
    ];
  }

  if (!input.message.includes("이슈")) {
    const content = "회의에서 정한 내용을 정리했습니다.";
    return [
      start,
      ...tokens(content),
      frame("message_end", { messageId, content }),
    ];
  }

  const approvalId = tsid(`${input.chatId}:approval`);
  const toolCallId = tsid(`${input.chatId}:call`);
  const content = "Linear 이슈 APP-12를 만들었습니다.";

  return [
    start,
    ...tokens("Linear에").slice(0, 1),
    frame("tool_approval_request", {
      approvalId,
      toolCallId,
      tool: "linear.create_issue",
      summary: "Linear 이슈 'APP 버그 수정' 생성",
    }),
    frame("tool_approval_resolved", { approvalId, decision: "APPROVED" }),
    frame("tool_call_result", {
      toolCallId,
      status: "success",
      summary: "APP-12 생성됨",
      url: "https://linear.app/heymoa/issue/APP-12",
    }),
    ...tokens(content).slice(0, 1),
    frame("message_end", { messageId, content }),
  ];
}
```

- [ ] **Step 4: 통과 확인**

```bash
pnpm vitest run lib/mocks/chat-stream.test.ts
```

기대: PASS. 승인 앞뒤 `token`이 각각 1개라야 두 번째 테스트의 배열이 맞는다.

- [ ] **Step 5: SSE MSW 핸들러**

`lib/mocks/sse-handler.ts`:

```typescript
import { HttpResponse, http } from "msw";

import { buildChatEvents } from "@/lib/mocks/chat-stream";
import { mockDb } from "@/lib/mocks/db";

const TOKEN_DELAY_MS = 40;
const KEEPALIVE_COMMENT = ": keepalive\n\n";

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

function streamOf(events: { event: string; data: string }[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      // 승인 대기 구간을 흉내내려 comment를 한 번 흘린다 — web은 이벤트가 아닌 것을 무시해야 한다.
      controller.enqueue(encoder.encode(KEEPALIVE_COMMENT));
      for (const event of events) {
        await new Promise((resolve) => setTimeout(resolve, TOKEN_DELAY_MS));
        controller.enqueue(
          encoder.encode(`event: ${event.event}\ndata: ${event.data}\n\n`)
        );
      }
      controller.close();
    },
  });
}

function sseResponse(events: { event: string; data: string }[]) {
  return new HttpResponse(streamOf(events), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const chatSseHandlers = [
  http.post("*/v1/agent-chats/:chatId/messages", async ({ request, params }) => {
    const body = (await request.json()) as { message: string };
    return sseResponse(
      buildChatEvents({ chatId: id(params.chatId), message: body.message })
    );
  }),

  http.post("*/v1/notes/:noteId/chat/messages", async ({ request, params }) => {
    const body = (await request.json()) as { message: string };
    const noteId = id(params.noteId);
    try {
      mockDb.acquireSharedChatLock(noteId);
    } catch (error) {
      const code = (error as Error).message;
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code, message: code, details: null },
        },
        { status: code === "NOTE_NOT_FOUND" ? 404 : 409 }
      );
    }
    const events = buildChatEvents({ chatId: noteId, message: body.message });
    mockDb.releaseSharedChatLock(noteId);
    return sseResponse(events);
  }),

  http.post("*/v1/agent-chats/:chatId/approvals/:approvalId", () =>
    HttpResponse.json({ success: true, data: null, error: null }, { status: 200 })
  ),
];
```

`db.ts`에 잠금 두 개를 더한다. `StoreState`에 `sharedChatLocks: Set<string>`을 추가하고 `createSeedState()`에서 빈 `Set`으로 시드한다.

```typescript
acquireSharedChatLock(noteId: string) {
  const note = findNote(noteId);
  if (note.meetingStatus !== "IN_PROGRESS") fail("MEETING_NOT_ACTIVE");
  if (state.sharedChatLocks.has(noteId)) fail("CHAT_LOCKED");
  state.sharedChatLocks.add(noteId);
},

releaseSharedChatLock(noteId: string) {
  state.sharedChatLocks.delete(noteId);
},
```

- [ ] **Step 6: 레지스트리에 등록**

`lib/mocks/handlers.ts`의 배열에 `...chatSseHandlers`를 `...restHandlers` 뒤, `transcriptionWebSocketHandler` 앞에 넣는다.

- [ ] **Step 7: 검증과 커밋**

```bash
pnpm test:run && pnpm lint && pnpm build
git add lib/mocks
git commit -m "feat(mocks): 채팅 SSE 스트림 목 — 승인 흐름과 실패 경로 포함"
```

- [ ] **Step 8: codex 리뷰 (1차 게이트)**

목 세 태스크가 이 이슈에서 로직이 가장 많은 곳이라 여기서 받는다.

```bash
codex exec review --base dev
```

지적마다 **고친다 / 근거를 적고 넘어간다 / 별도 이슈로 뺀다** 중 하나를 고르고 `docs/codex-review-app-110.md`에 남긴다.

```markdown
# codex 리뷰 기록 — APP-110

## 1차 — 목 3종

| 지적 | 판단 | 근거 |
|---|---|---|
```

계약 미러와 `lib/api/generated/**`에 대한 지적은 반영하지 않고 기록만 한다.

```bash
git add docs/codex-review-app-110.md
git commit -m "docs: codex 1차 리뷰 기록 (목 3종)"
```

---

### Task 6: Playwright 스모크

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: Task 3~5의 목
- Produces: `pnpm test:e2e`

- [ ] **Step 1: 설치**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: 설정**

`playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_API_MOCKING: "enabled" },
    timeout: 120_000,
  },
});
```

`package.json`의 `scripts`에 `"test:e2e": "playwright test"`를 넣는다.
`.gitignore`에 `/test-results`와 `/playwright-report`를 넣는다.

- [ ] **Step 3: 스모크 테스트**

`e2e/smoke.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

test("boots with the MSW service worker and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");

  const workerReady = await page.evaluate(
    () => navigator.serviceWorker.controller !== null
  );
  expect(workerReady).toBe(true);
  expect(errors).toEqual([]);
});

test("renders the workspace surface from mock data", async ({ page }) => {
  await page.goto("/w");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByText("테스트 유저")).toBeVisible();
});

test("serves a new endpoint through the service worker", async ({ page }) => {
  await page.goto("/");

  const payload = await page.evaluate(async () => {
    const response = await fetch("/v1/notifications", { credentials: "include" });
    return { status: response.status, body: await response.json() };
  });

  expect(payload.status).toBe(200);
  expect(payload.body.success).toBe(true);
  expect(payload.body.data.unreadCount).toBeGreaterThanOrEqual(0);
});
```

세 번째가 핵심이다 — 목이 jsdom이 아니라 **서비스 워커 경로에서도** 도는지의 증거다.

- [ ] **Step 4: 실행**

```bash
pnpm test:e2e
```

기대: 3 passed. 경로나 텍스트가 실제 화면과 다르면 셀렉터를 실제 렌더 결과에 맞춰 고친다 — 화면을 고치지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add playwright.config.ts e2e package.json pnpm-lock.yaml .gitignore
git commit -m "test(e2e): Playwright 스모크 — MSW 서비스 워커 경로 검증"
```

- [ ] **Step 6: codex 리뷰 (2차 게이트)**

```bash
codex exec review --base dev
```

`docs/codex-review-app-110.md`에 `## 2차 — Playwright 도입` 절을 추가한다.

---

### Task 7: 마무리 — 최종 리뷰와 merge

- [ ] **Step 1: 전체 검증**

```bash
pnpm orval && pnpm test:run && pnpm lint && pnpm build && pnpm test:e2e
```

- [ ] **Step 2: codex 최종 게이트**

```bash
codex exec review --base dev
```

`docs/codex-review-app-110.md`에 `## 3차 — 브랜치 전체` 절을 추가한다. 남은 지적이 전부 판단·기록되면 넘어간다.

- [ ] **Step 3: squash merge**

PR을 만들지 않는다.

```bash
git checkout dev
git merge --squash feature/app-110-계약-반영-openapi3yml-갱신-orval-msw-상태-목
git commit
git push origin dev
```

- [ ] **Step 4: Linear를 Done으로**

APP-110을 Done으로 옮긴다. 그 다음 이슈(APP-144)는 brainstorming부터 새로 시작한다.
