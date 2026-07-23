# APP-113 개인 챗봇 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개인 챗봇 패널을 붙이고, 공유 챗봇·승인 UX가 재사용할 SSE 클라이언트를 만든다.

**Architecture:** 순수 리듀서(`stream-protocol.ts`) 위에 훅(`use-chat-stream.ts`)을 얹고, 그 위에 개인/공유를 모르는 스레드 컴포넌트를 둔다. 개인 챗봇을 아는 것은 `personal-chat.tsx` 하나뿐이다.

**Spec:** `docs/superpowers/specs/2026-07-24-app-113-personal-chat-design.md`

## Global Constraints

- API 호출은 orval 훅만. SSE만 `lib/api/sse.ts`의 `postEventStream()`.
- `message_end`가 오면 토큰 합을 버리고 `content`를 쓴다.
- `tool_call_result.status === "error"`는 종료가 아니다.
- 유휴 타이머는 승인 대기 구간에서 정지한다.
- 패널은 `fixed` 하나. 노트 side 모드에서 **숨기되 스트림은 유지**한다.
- 스코프 전환 UI를 만들지 않는다 (읽기 전용 라벨).
- 오류 표시는 `AGENTS.md` 경계표를 따른다.
- 검증: `pnpm orval && pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`

---

### Task 1: 스트림 프로토콜 리듀서

**Files:**
- Create: `lib/chat/stream-protocol.ts`
- Test: `lib/chat/stream-protocol.test.ts`

**Produces:**

```ts
export type ChatStreamPhase =
  | "idle" | "streaming" | "awaiting_approval"
  | "failed" | "stalled" | "aborted";

export type LiveToolRecord =
  | { kind: "approval"; approvalId: string; tool: string; summary?: string; decision: "APPROVED" | "REJECTED" | null }
  | { kind: "call"; toolCallId: string; tool: string; summary?: string; status: "success" | "error" | null; url?: string | null };

export type ChatStreamState = {
  phase: ChatStreamPhase;
  messageId: string | null;
  /** 지금까지 붙은 토큰. message_end 뒤에는 content로 대체된다. */
  text: string;
  /** 확정된 답변. message_end 전에는 null. */
  content: string | null;
  records: LiveToolRecord[];
  pendingApproval: { approvalId: string; tool: string; summary?: string } | null;
  error: { code: string; message: string } | null;
};

export const initialStreamState: ChatStreamState;
export function reduceStreamEvent(state: ChatStreamState, event: { event: string; data: string }): ChatStreamState;
export function endStream(state: ChatStreamState, reason: "closed" | "stalled" | "aborted"): ChatStreamState;
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

덮어야 할 것 — 각각 별개 `it`:

1. `message_start` → `phase: "streaming"`, `messageId` 저장
2. `token` 두 건 → `text`가 이어붙는다
3. `message_end` → `content`가 payload의 `content`, `text`도 같은 값으로 대체된다. **토큰 합과 `content`가 다른 payload를 넣어 `content`가 이긴다는 걸 못 박는다.**
4. `error` → `phase: "failed"`, `text: ""` (부분 버림), `error.code`
5. `tool_call_start` → `records`에 `kind: "call"`, `status: null`
6. `tool_call_result` `status: "error"` → 그 레코드가 error로 갱신되고 **`phase`는 여전히 `"streaming"`**
7. `tool_call_result` 뒤 `token` → `text`가 계속 붙는다
8. `tool_approval_request` → `phase: "awaiting_approval"`, `pendingApproval` 채워짐, `records`에 `kind: "approval"` `decision: null`
9. `tool_approval_resolved` → `phase: "streaming"`, `pendingApproval: null`, 해당 approval 레코드의 `decision` 갱신
10. 알 수 없는 이벤트 이름 → 상태 그대로 (계약이 늘어도 안 깨진다)
11. 깨진 JSON `data` → 상태 그대로 (throw 금지)
12. `endStream(state, "closed")` — `content`가 없으면 `phase: "stalled"`, `text` 유지
13. `endStream(state, "closed")` — `message_end`를 이미 받았으면 `phase: "idle"` 유지
14. `endStream(state, "aborted")` → `phase: "aborted"`, `text` 유지

- [ ] **Step 2: 테스트가 실패하는 걸 본다**

```bash
pnpm vitest run lib/chat/stream-protocol.test.ts
```

- [ ] **Step 3: 리듀서를 쓴다**

`switch (event.event)`. `JSON.parse`는 `try/catch`로 감싸 실패 시 `state`를 그대로 돌려준다. `tool_call_result`는 `toolCallId`로 기존 레코드를 찾아 갱신하고, 없으면 새로 넣는다(`tool_call_start` 없이 result만 오는 경우).

- [ ] **Step 4: 통과를 본다**
- [ ] **Step 5: 커밋** — `feat: SSE 채팅 스트림 리듀서`

---

### Task 2: `useChatStream` 훅

**Files:**
- Create: `lib/chat/use-chat-stream.ts`
- Test: `lib/chat/use-chat-stream.test.ts`

**Consumes:** Task 1의 리듀서, `lib/api/sse.ts`의 `postEventStream`.

**Produces:**

```ts
export const IDLE_TIMEOUT_MS = 40_000;

export function useChatStream(): {
  state: ChatStreamState;
  /** url·body를 받아 스트림을 연다. 이미 흐르면 무시한다. */
  send: (url: string, body: Record<string, unknown>) => Promise<void>;
  stop: () => void;
  reset: () => void;
};
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`postEventStream`을 `vi.mock`해 이벤트를 원하는 대로 흘린다. `@testing-library/react`의 `renderHook` + `vi.useFakeTimers`.

1. 이벤트를 흘리면 `state.text`가 자란다
2. `message_end`까지 흘리면 `phase: "idle"`, `content` 확정
3. 종료 이벤트 없이 제너레이터가 끝나면 `phase: "stalled"`
4. `stop()` → `phase: "aborted"`, 제너레이터에 abort가 전달된다
5. 유휴 40초 → `phase: "stalled"`
6. **`tool_approval_request` 뒤 유휴 40초를 넘겨도 `phase`가 `"awaiting_approval"`로 남는다** (타이머 정지)
7. `postEventStream`이 throw(비-2xx 봉투) → `phase: "failed"`, `error.message`가 봉투 문구

- [ ] **Step 2: 실패를 본다**

```bash
pnpm vitest run lib/chat/use-chat-stream.test.ts
```

- [ ] **Step 3: 훅을 쓴다**

`useReducer` + `AbortController` ref. `for await (const event of postEventStream(url, body, { signal }))` 루프에서 `dispatch`. 루프가 끝나면 `endStream(..., "closed")`, abort로 끝났으면 `"aborted"`.

유휴 타이머: 이벤트마다 `resetIdleTimer()`를 부르되, `phase === "awaiting_approval"`이면 타이머를 걸지 않는다. `tool_approval_resolved`로 `streaming`이 되면 다시 건다. 언마운트에서 `abort()` + `clearTimeout`.

`postEventStream`이 throw하면 `errorMessageOf(error, "응답을 받지 못했습니다.")`로 `failed`.

- [ ] **Step 4: 통과를 본다**
- [ ] **Step 5: 커밋** — `feat: SSE 채팅 스트림 훅`

---

### Task 3: 스레드 렌더

**Files:**
- Create: `components/chat/chat-thread.tsx`
- Test: `components/chat/chat-thread.test.tsx`

**Consumes:** Task 1의 `ChatStreamState`.

**Produces:**

```tsx
export type ThreadMessage = AgentChatMessagesResponseDataMessagesItem;

export function ChatThread(props: {
  messages: ThreadMessage[];
  stream: ChatStreamState;
  /** 방금 보냈지만 아직 히스토리에 없는 유저 메시지 */
  pendingUserMessage: string | null;
  onRetry: () => void;
  onApprove: (decision: "APPROVED" | "REJECTED") => void;
  isApprovalPending: boolean;
  emptyState?: React.ReactNode;
}): React.ReactElement;
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

1. USER/ASSISTANT 메시지가 각각 렌더된다
2. `toolEvent.decision === "APPROVED"` → 승인 기록(좌측 규칙선). `data-record="approval"`
3. `toolEvent.status === "success"` + `url` → 실행 기록 `Card` + 외부 링크. `data-record="call"`
4. `toolEvent.decision === null && toolEvent.status === null` → **아무것도 렌더하지 않는다**
5. `stream.phase === "streaming"` → `stream.text`가 보이고 커서가 있다
6. `stream.phase === "failed"` → `Alert`(destructive) + 다시 보내기 버튼, **부분 텍스트 말풍선 없음**
7. `stream.phase === "stalled"` → 중립 `Alert` + 부분 텍스트가 `data-partial="true"`로 남음
8. `stream.phase === "awaiting_approval"` → 승인/거절 버튼, 누르면 `onApprove`에 결정이 전달된다
9. `messages: []` + `phase: "idle"` → `emptyState`가 보인다

- [ ] **Step 2: 실패를 본다**
- [ ] **Step 3: 컴포넌트를 쓴다**

TOOL 판별은 스펙대로 **둘 다 명시 검사**한다.

```tsx
if (message.role === "TOOL") {
  const event = message.toolEvent;
  if (event?.decision) return <ApprovalRecord ... />;
  if (event?.status) return <CallRecord ... />;
  return null; // 계약 밖 형태는 그리지 않는다
}
```

카드 폭은 패널 내부 폭(448 − padding 24×2 = 400)을 채운다 — 고정 px를 쓰지 않고 `w-full`로 두어 패널이 좁아져도 따라간다.

- [ ] **Step 4: 통과를 본다**
- [ ] **Step 5: 커밋** — `feat: 채팅 스레드 렌더`

---

### Task 4: 개인 챗봇 패널 + 스코프 배선

**Files:**
- Create: `components/chat/personal-chat.tsx`
- Modify: `components/workspace/workspace-app-shell.tsx` (패널 마운트 + 본문 우측 여백)
- Modify: `components/notes/note-view.tsx` 또는 `note-route-surface.tsx` (노트 스코프 등록 / side 숨김)
- Test: `components/chat/personal-chat.test.tsx`

**Consumes:** Task 2·3.

**Produces:**

```tsx
export function PersonalChatProvider({ workspaceId, children }): React.ReactElement;
/** 노트 화면이 자기 스코프를 등록한다. view가 side면 hidden으로 넘긴다. */
export function usePersonalChatScope(scope: { noteId: string; hidden: boolean } | null): void;
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

generated 훅은 기존 테스트 관례대로 `vi.mock`한다.

1. `active`가 `null` → 빈 상태 문구 + 예시 질문
2. `active`가 세션 → `useGetAgentChatMessages`가 그 `chatId`로 불리고 히스토리가 보인다
3. 활성 세션 없을 때 전송 → `useCreateAgentChat`가 먼저 불리고, 그 `chatId`로 스트림 URL이 만들어진다
4. 활성 세션 있을 때 전송 → `useCreateAgentChat`가 **불리지 않는다**
5. "새로운 대화 시작" → `useCreateAgentChat` 호출 + 스레드가 비워진다
6. 스코프 라벨: 노트 스코프가 등록되면 노트 제목, 아니면 워크스페이스 이름
7. `hidden: true`(side) → 플로팅 버튼도 패널도 렌더되지 않는다
8. `hidden: true`로 바뀌어도 **`stop()`이 불리지 않는다** (스트림 유지)
9. 스트림이 끝나면 `messages` 쿼리가 무효화된다

- [ ] **Step 2: 실패를 본다**
- [ ] **Step 3: 구현한다**

- `PersonalChatProvider` — `open`, `noteScope`, `hidden`을 담는 context. `WorkspaceAppShell` 안쪽에서 감싼다.
- 플로팅 버튼 — `fixed bottom-6 right-6`, `rounded-full`(CTA 규약).
- 패널 — `fixed right-2 top-2 bottom-2 w-[448px]`, 카드 규약(`rounded-2xl border border-[var(--el-hairline)] bg-white`).
- 본문 여백 — 열려 있을 때 `SidebarInset`에 `pr-[456px]`.
- 컴포저 — `Input` + 전송. 스트리밍 중에는 전송이 중지 버튼으로 바뀐다. `awaiting_approval`이면 입력 비활성 + 힌트.
- 스트림 종료 후 `queryClient.invalidateQueries`로 `getGetAgentChatMessagesQueryKey(chatId)`를 무효화한다 — tee된 히스토리를 다시 읽는다.
- 노트: `view === "full"`이면 `usePersonalChatScope({ noteId, hidden: false })`, `side`면 `hidden: true`.

- [ ] **Step 4: 통과를 본다**
- [ ] **Step 5: 커밋** — `feat: 개인 챗봇 패널`

---

### Task 5: Playwright 스모크

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 시나리오를 추가한다**

워크스페이스로 가서 플로팅 버튼을 누르고, 메시지를 보내고, 토큰이 붙은 뒤 스레드에 답변이 남는 걸 확인한다. 브라우저 서비스 워커 경로의 SSE를 덮는 게 목적이다 — vitest는 jsdom이라 이 경로를 지나지 않는다.

- [ ] **Step 2: 돌린다**

```bash
pnpm test:e2e
```

- [ ] **Step 3: 커밋** — `test: 개인 챗봇 스모크`

---

### Task 6: 게이트와 merge

- [ ] **Step 1: 전체 검증**

```bash
pnpm orval && pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

- [ ] **Step 2: codex**

```bash
codex exec review --base dev
```

지적마다 고치거나, 근거를 적고 넘기거나, 별도 이슈로 뺀다. 판단을 `docs/codex-review-app-113.md`에 남긴다.

- [ ] **Step 3: squash merge**

```bash
git checkout dev && git merge --squash feature/app-113-개인-챗봇-ui && git commit && git push origin dev
```

Linear APP-113을 Done으로.
