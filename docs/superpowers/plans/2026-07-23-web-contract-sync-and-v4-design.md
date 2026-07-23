# 계약 반영과 v4 디자인 기반 Implementation Plan

> **이 문서는 로드맵이다.** 2026-07-23부터 이슈마다 자기 spec·plan을 갖는다 —
> 이 문서 하나가 이슈 셋을 덮고 있어서, 이슈를 열어도 자기 설계가 없고 큰 문서의
> 몇 단계를 가리킬 뿐이었다. 여기 남는 것은 **이슈를 가로지르는 결정과 순서**다.
>
> - APP-110 계약 반영 → `2026-07-23-app-110-contract-sync-design.md` / `plans/2026-07-23-app-110-contract-sync.md`
> - APP-144 API 맥락 맵 → 착수 시 brainstorming으로 작성
> - APP-145 v4 계약 정합성 감사 → 착수 시 brainstorming으로 작성

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** heymoa-server가 구현을 끝낸 API 전부를 web이 호출할 수 있게 만들고, 그 호출 가능한 훅을 근거로 mvp.pen v4를 화면 구현이 바로 가능한 상태까지 채운다.

**Architecture:** 계약 파일을 docs repo에서 복사해 orval로 훅·목을 생성하고, MSW 목에 상태 전이와 SSE 스트리밍을 넣어 Vercel `dev` 데모가 실제 제품처럼 돌게 한다. 그 생성물을 표로 정리해 여섯 디자인 에이전트의 공통 입력으로 삼고, 각자 mvp.pen v4의 한 행씩 맡아 계약이 만드는 화면·상태의 구멍을 메운다.

**Tech Stack:** Next.js 16 (App Router), TanStack Query, orval 8, MSW 2, faker 10, vitest 4 (jsdom), Playwright(신규), pencil MCP (`mvp.pen`)

**Spec:** `docs/superpowers/specs/2026-07-23-web-contract-sync-and-v4-design.md`

## Global Constraints

- `openapi3.yml`은 **34경로**다. `/internal/**` 3경로(`callbacks/analyses/{analysisId}`, `notes/{noteId}/context`, `workspaces/{workspaceId}/notes`)를 제외한다 — heymoa-ai가 부르는 경로다.
- SSE 두 경로(`sendAgentChatMessage`, `sendNoteSharedChatMessage`)는 **생성 훅을 쓰지 않는다.** `lib/api/sse.ts`의 `postEventStream()` 위에 손으로 만든다.
- MSW 핸들러는 **명시적 override 응답**만 쓴다. faker 기본값 금지(무작위 `success: false`가 인증을 깬다). 성공 응답은 `{ success: true, data, error: null }`.
- API 직접 `fetch` 금지. 예외는 `lib/api/fetcher.ts`와 `lib/api/sse.ts` 둘뿐이다.
- **`mvp.pen`은 git 밖이다.** 5단계(Task 9) 시작 전 백업 필수. 디자인 결정은 `docs/design-decisions.md`에 남긴다.
- v4 새 프레임: `x = 그 행 마지막 프레임의 x + 1840`, `y`는 행 고정, 크기 **1440×900**.
- 디자인 재구성은 **자기 행 안에서, 기존 v4 토큰·컴포넌트 범위 내로**. 공용 `reusable` 노드 수정 금지.
- ground truth: 구현된 화면(노트·워크스페이스·설정)은 MSW로 띄워 실측. 신규 화면은 계약 + 그 실측값에서 파생. 추측으로 치수를 만들지 않는다.
- Next.js 16: 미들웨어는 `proxy.ts`다. **`middleware.ts`를 만들지 않는다** (404 루프).
- 전체 검증: `pnpm orval && pnpm test:run && pnpm lint && pnpm build && pnpm test:e2e` (`test:e2e`는 Task 7에서 생긴다)
- **리뷰 게이트는 로컬 `codex exec review --base dev` 하나다.** PR 원격 Codex 리뷰는 요청·반영하지 않는다. Task 6 뒤, Task 7 뒤, 그리고 merge 직전에 돌린다. 지적은 고치거나·근거를 적고 넘기거나·별도 이슈로 빼고, 어느 쪽이든 `docs/codex-review-2026-07-23.md`에 한 줄씩 남긴다.
- 계약 미러(`openapi3.yml`·`asyncapi.yml`)와 orval 생성물(`lib/api/generated/**`)에 대한 codex 지적은 **반영하지 않는다** — 손으로 고치면 다음 갱신에서 되돌아간다. 기록만 하고 서버 이슈로 올린다.
- 브랜치 하나에서 전부 진행하고 PR 없이 `dev`로 squash-merge한다.

## File Structure

| 파일 | 책임 |
|---|---|
| `openapi3.yml` (수정) | REST 계약 미러, 34경로 |
| `asyncapi.yml` (수정) | 전사 STOMP + 채팅 SSE 계약 미러 |
| `lib/api/generated/**` (재생성) | orval 산출물. 직접 수정 금지 |
| `docs/generated-api-map.md` (신규) | orval이 실제로 만든 태그→파일 경로 기록 |
| `lib/mocks/db.ts` (수정) | 목 상태 저장소. 초대·알림·멤버·회의·분석·연동 확장 |
| `lib/mocks/rest-handlers.ts` (수정) | REST 핸들러 등록 |
| `lib/mocks/chat-stream.ts` (신규) | SSE 이벤트 시퀀스 생성 (순수 함수) |
| `lib/mocks/sse-handler.ts` (신규) | SSE MSW 핸들러. `chat-stream.ts`를 스트림으로 흘린다 |
| `lib/mocks/handlers.ts` (수정) | 핸들러 레지스트리 |
| `e2e/smoke.spec.ts` (신규) | Playwright 스모크 |
| `playwright.config.ts` (신규) | Playwright 설정 |
| `docs/api-surface.md` (신규) | 경로↔훅↔화면↔상태↔프레임 표 + shadcn 매핑 |
| `docs/design-decisions.md` (신규) | v4 디자인 결정 기록 (git 안) |

---

### Task 1: Linear 이슈 재배치

코드 변경 없음. 낡은 이슈 위에 세운 계획은 같이 낡으므로 먼저 한다.

**Files:**
- Create: `docs/linear-rearrangement-2026-07-23.md`

**Interfaces:**
- Produces: 신규 이슈 2개의 식별자(예 `APP-144`, `APP-145`). Task 8·9가 이 번호를 참조한다. `docs/linear-rearrangement-2026-07-23.md`에 기록한다.

- [ ] **Step 1: APP-110 본문 재작성**

Linear MCP `save_issue`로 APP-110을 수정한다.

- 제목: `계약 반영 — openapi3.yml 갱신 + orval + MSW 상태 목`
- 본문: 이 플랜의 Task 2~7에 해당하는 내용. "오버레이" 표현과 `heymoa-server.v2-draft.openapi.yml` 참조를 모두 제거한다.
- 첨부 정리: 죽은 링크 2개(`heymoa-server.v2-draft.openapi.yml`, `heymoa-server.openapi.yml`)를 제거하고 `contracts/openapi3-server.yml`, `contracts/asyncapi-web-server.yml`로 교체한다.

- [ ] **Step 2: 신규 이슈 2개 생성**

`save_issue`로 APP-102 하위, 라벨 `heymoa-web`, 담당 김민수:

1. 제목 `API 맥락 맵 + shadcn 매핑표` — 본문은 이 플랜 Task 8
2. 제목 `mvp.pen v4 계약 정합성 감사 (에이전트 6개 병렬)` — 본문은 이 플랜 Task 9. APP-109(Done)를 선행 산출물로 참조한다

- [ ] **Step 3: APP-111~117 참조 감사와 의존 재설정**

일곱 개 각각에서:
- 인용된 계약 파일명을 새 이름으로 고친다 (`agent-chat.web-server.asyncapi.yml` → `asyncapi-web-server.yml`, `heymoa-server.openapi.yml` → `openapi3-server.yml`, `heymoa-ai.openapi.yml` → `openapi3-ai.yml`)
- Step 2에서 만든 v4 감사 이슈에 **blocked by**로 연결한다
- 우선순위를 Medium 이하로 내려 신규 이슈들 뒤에 오게 한다

요구사항 본문은 고치지 않는다. 요구가 실제로 바뀐 것을 발견하면 그 이슈에 코멘트만 남기고 넘어간다.

- [ ] **Step 4: 변경 기록 작성**

`docs/linear-rearrangement-2026-07-23.md`에 표로 남긴다.

```markdown
# Linear 재배치 기록 (2026-07-23)

| 이슈 | 무엇을 | 왜 |
|---|---|---|
| APP-110 | 본문·제목 재작성, 첨부 2개 교체 | 오버레이 소스가 삭제되고 서버가 전부 구현해 전제가 사라짐 |
| (신규) | API 맥락 맵 이슈 생성 | 4단계를 담을 이슈가 없었음 |
| (신규) | v4 감사 이슈 생성 | APP-109가 Done이라 5단계를 얹을 곳이 없었음 |
| APP-111~117 | 계약 파일명 갱신, v4 감사 이슈에 blocked by, 우선순위 하향 | 낡은 참조 + 선행 작업 반영 |

## 신규 이슈 식별자
- API 맥락 맵: APP-___
- v4 감사: APP-___
```

빈칸은 실제 생성된 번호로 채운다.

- [ ] **Step 5: 검증**

Linear에서 APP-110을 다시 조회해 본문에 `v2-draft`, `feature/app-63`, `오버레이` 문자열이 0건인지 확인한다. APP-111~117 각각이 v4 감사 이슈에 blocked by로 걸렸는지 확인한다.

- [ ] **Step 6: 브랜치를 확정된 번호로 다시 명명한다**

```bash
git branch -m "feature/app-110-계약-반영-v4-디자인-기반"
git branch --show-current
```

APP-110의 제목이 바뀌었으므로 브랜치 이름도 새 제목에 맞춘다. 이미 그 이름이면 넘어간다.

- [ ] **Step 7: 커밋**

```bash
git add docs/linear-rearrangement-2026-07-23.md
git commit -m "docs: Linear 이슈 재배치 기록"
```

---

### Task 2: 계약 파일 반영

**Files:**
- Modify: `openapi3.yml` (전체 교체)
- Modify: `asyncapi.yml` (전체 교체)
- Modify: `lib/api/openapi-contract.test.ts`
- Modify: `lib/api/contract-consistency.test.ts`

**Interfaces:**
- Produces: 34경로 `openapi3.yml`. Task 3의 orval 입력이다.

- [ ] **Step 1: 실패하는 계약 테스트를 먼저 쓴다**

`lib/api/openapi-contract.test.ts` 끝에 추가:

```typescript
describe("contract sync 2026-07-23", () => {
  it("mirrors 34 public paths and excludes internal ones", () => {
    const paths = Object.keys(api().paths);
    expect(paths).toHaveLength(34);
    expect(paths.filter((path) => path.startsWith("/internal"))).toEqual([]);
  });

  it("exposes the invitation, notification and member operations", () => {
    expect(
      api().paths["/v1/workspaces/{workspaceId}/invitations"]?.post?.operationId
    ).toBe("createWorkspaceInvitation");
    expect(
      api().paths["/v1/invitations/{invitationId}/accept"]?.post?.operationId
    ).toBe("acceptWorkspaceInvitation");
    expect(api().paths["/v1/notifications"]?.get?.operationId).toBe(
      "getNotifications"
    );
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members"]?.get?.operationId
    ).toBe("getWorkspaceMembers");
  });

  it("exposes the chat, approval, meeting and analysis operations", () => {
    expect(
      api().paths["/v1/agent-chats/{chatId}/messages"]?.post?.operationId
    ).toBe("sendAgentChatMessage");
    expect(
      api().paths["/v1/notes/{noteId}/chat/messages"]?.post?.operationId
    ).toBe("sendNoteSharedChatMessage");
    expect(
      api().paths["/v1/agent-chats/{chatId}/approvals/{approvalId}"]?.post
        ?.operationId
    ).toBe("resolveToolApproval");
    expect(api().paths["/v1/notes/{noteId}/meeting-end"]?.post?.operationId).toBe(
      "endMeeting"
    );
    expect(
      api().paths["/v1/notes/{noteId}/analyses/latest"]?.get?.operationId
    ).toBe("getLatestAnalysis");
  });
});
```

`lib/api/contract-consistency.test.ts` 끝에 추가:

```typescript
describe("chat SSE contract", () => {
  it("carries the agent chat channels and the eight stream events", () => {
    expect(Object.keys(asyncapi.channels)).toEqual(
      expect.arrayContaining(["agentChatStream", "noteSharedChatStream"])
    );
    expect(Object.keys(asyncapi.components.messages)).toEqual(
      expect.arrayContaining([
        "MessageStart",
        "Token",
        "ToolCallStart",
        "ToolApprovalRequest",
        "ToolApprovalResolved",
        "ToolCallResult",
        "MessageEnd",
        "Error",
      ])
    );
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run lib/api/openapi-contract.test.ts lib/api/contract-consistency.test.ts
```

기대: 첫 테스트가 `expected 13 to be 34`로 실패, SSE 테스트가 채널 없음으로 실패.

- [ ] **Step 3: 계약 파일을 복사하고 internal 경로를 제거한다**

```bash
cp ../docs/contracts/asyncapi-web-server.yml asyncapi.yml
cp ../docs/contracts/openapi3-server.yml openapi3.yml
```

`openapi3.yml`에서 `/internal/v1/callbacks/analyses/{analysisId}`, `/internal/v1/notes/{noteId}/context`, `/internal/v1/workspaces/{workspaceId}/notes` 세 경로 블록을 통째로 지운다. `components.securitySchemes.internalToken`도 함께 지운다 — 참조하는 경로가 사라졌다.

파일 맨 위 주석 두 줄을 다음으로 교체한다.

```yaml
# heymoa-server 빌드 산출물의 미러 (docs/contracts/openapi3-server.yml).
# 손으로 수정하지 말 것. 갱신: docs repo에서 복사한 뒤 /internal/** 경로를 제거.
# /internal/** 3경로는 heymoa-ai가 호출하는 경로라 web에서 제외한다 — 남기면
# 브라우저가 부르지 않는 훅과 목이 생긴다.
```

- [ ] **Step 4: 테스트 통과를 확인한다**

```bash
pnpm vitest run lib/api/openapi-contract.test.ts lib/api/contract-consistency.test.ts
```

기대: PASS.

- [ ] **Step 5: 커밋**

```bash
git add openapi3.yml asyncapi.yml lib/api/openapi-contract.test.ts lib/api/contract-consistency.test.ts
git commit -m "feat: 계약 미러를 34경로로 갱신하고 채팅 SSE를 반영"
```

---

### Task 3: orval 재생성

**Files:**
- Modify: `lib/api/generated/**` (생성물)
- Create: `docs/generated-api-map.md`
- Modify: `lib/api/openapi-contract.test.ts`

**Interfaces:**
- Consumes: Task 2의 34경로 `openapi3.yml`
- Produces: `docs/generated-api-map.md` — 태그별 실제 생성 파일 경로. Task 4~7이 import 경로를 여기서 확인한다. 서버 계약의 태그 중 `Workspace Invitations`·`Workspace Members`에 공백이 있어 orval 출력 디렉터리명을 미리 확정할 수 없다.

- [ ] **Step 1: 생성**

```bash
pnpm orval
```

기대: 오류 없이 끝나고 `lib/api/generated/` 아래 디렉터리가 늘어난다.

- [ ] **Step 2: 실제 생성 경로를 기록한다**

```bash
ls -1 lib/api/generated
```

출력을 보고 `docs/generated-api-map.md`를 쓴다.

```markdown
# orval 생성물 지도 (2026-07-23)

`pnpm orval`이 만든 태그별 파일. import 경로는 여기서 확인한다.

| 서버 태그 | 생성 디렉터리 | 훅 파일 | MSW 파일 |
|---|---|---|---|
| AgentChat | (실제 값) | (실제 값) | (실제 값) |
| Notifications | | | |
| WorkspaceIntegration | | | |
| Workspace Invitations | | | |
| Workspace Members | | | |
| Analysis | | | |
| Meeting | | | |
| NoteSharedChat | | | |

## SSE 두 경로는 생성 훅을 쓰지 않는다

`sendAgentChatMessage`, `sendNoteSharedChatMessage`는 응답이 `text/event-stream`이라
생성된 훅이 스트림을 읽지 못한다. `lib/api/sse.ts`의 `postEventStream()`을 쓴다.
```

빈칸을 `ls` 결과로 채운다.

- [ ] **Step 3: 생성물에 internal 훅이 없음을 테스트로 고정한다**

`lib/api/openapi-contract.test.ts`에 추가:

```typescript
import { readdirSync, readFileSync as read } from "node:fs";

describe("generated client", () => {
  it("never generates a client for internal paths", () => {
    const files = readdirSync("lib/api/generated", { recursive: true })
      .map(String)
      .filter((name) => name.endsWith(".ts"));
    const offenders = files.filter((name) =>
      read(`lib/api/generated/${name}`, "utf8").includes("/internal/")
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 4: AGENTS.md의 훅 규칙을 정확하게 만든다**

현재 `AGENTS.md`의 "API & Data" 절은 "직접 `fetch()` 금지"라고만 해서 `lib/api/sse.ts`가 규칙 위반처럼 읽힌다. 해당 줄을 교체한다.

```markdown
- All API calls MUST use Orval-generated hooks from `lib/api/generated/`. The only exceptions are `lib/api/fetcher.ts` (the shared mutator) and `lib/api/sse.ts` (SSE streams, which generated hooks cannot read). Nothing else may `fetch()` an API path directly.
- SSE endpoints (`sendAgentChatMessage`, `sendNoteSharedChatMessage`) return `text/event-stream`. Their generated hooks exist but are unusable — call `postEventStream()` from `lib/api/sse.ts` instead.
```

- [ ] **Step 5: 전체 검증**

```bash
pnpm test:run && pnpm lint && pnpm build
```

기대: 전부 PASS. 목 핸들러가 아직 없는 신규 경로는 이 시점에 호출되지 않으므로 통과한다.

- [ ] **Step 6: 커밋**

```bash
git add lib/api/generated docs/generated-api-map.md lib/api/openapi-contract.test.ts AGENTS.md
git commit -m "feat: orval 재생성 — 신규 8개 태그 훅과 목 생성물"
```

---

### Task 4: 목 상태 확장 — 초대·알림·멤버

**Files:**
- Modify: `lib/mocks/db.ts`
- Modify: `lib/mocks/db.test.ts`
- Modify: `lib/mocks/rest-handlers.ts`
- Modify: `lib/mocks/rest-handlers.test.ts`

**Interfaces:**
- Consumes: `docs/generated-api-map.md`의 `Notifications`·`Workspace Invitations`·`Workspace Members` MSW 파일 경로
- Produces: `mockDb.listMembers(workspaceId)`, `mockDb.listInvitations(workspaceId)`, `mockDb.createInvitation(workspaceId, { email, role })`, `mockDb.acceptInvitation(invitationId)`, `mockDb.declineInvitation(invitationId)`, `mockDb.cancelInvitation(invitationId)`, `mockDb.listNotifications()`, `mockDb.markNotificationRead(notificationId)`. Task 8이 이 목록을 맥락 맵에 옮긴다.

- [ ] **Step 1: 실패하는 상태 전이 테스트를 쓴다**

`lib/mocks/db.test.ts`에 추가:

```typescript
describe("invitations and notifications", () => {
  beforeEach(() => mockDb.reset());

  it("accepting an invitation adds a member and clears the pending row", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    const before = mockDb.listMembers(workspaceId).length;

    const invitation = mockDb.createInvitation(workspaceId, {
      email: "new@heymoa.com",
      role: "MEMBER",
    });
    expect(mockDb.listInvitations(workspaceId)).toHaveLength(1);

    mockDb.acceptInvitation(invitation.invitationId);

    expect(mockDb.listMembers(workspaceId)).toHaveLength(before + 1);
    expect(mockDb.listInvitations(workspaceId)).toEqual([]);
  });

  it("declining an invitation leaves the member list untouched", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    const before = mockDb.listMembers(workspaceId).length;
    const invitation = mockDb.createInvitation(workspaceId, {
      email: "nope@heymoa.com",
      role: "MEMBER",
    });

    mockDb.declineInvitation(invitation.invitationId);

    expect(mockDb.listMembers(workspaceId)).toHaveLength(before);
    expect(mockDb.listInvitations(workspaceId)).toEqual([]);
  });

  it("rejects a duplicate pending invitation for the same email", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    mockDb.createInvitation(workspaceId, {
      email: "dup@heymoa.com",
      role: "MEMBER",
    });

    expect(() =>
      mockDb.createInvitation(workspaceId, {
        email: "dup@heymoa.com",
        role: "MEMBER",
      })
    ).toThrow("DUPLICATE_PENDING_INVITATION");
  });

  it("reading a notification lowers the unread count", () => {
    const first = mockDb.listNotifications();
    expect(first.unreadCount).toBeGreaterThan(0);

    mockDb.markNotificationRead(first.notifications[0].notificationId);

    expect(mockDb.listNotifications().unreadCount).toBe(first.unreadCount - 1);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run lib/mocks/db.test.ts
```

기대: `mockDb.listMembers is not a function`.

- [ ] **Step 3: `db.ts`에 상태와 동작을 추가한다**

`StoreState`에 필드를 더한다.

```typescript
type MockMember = {
  userId: string;
  workspaceId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
};

type MockInvitation = {
  invitationId: string;
  workspaceId: string;
  email: string;
  role: string;
  status: string;
  inviterName: string;
  createdAt: string;
};

type MockNotification = {
  notificationId: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  invitation: {
    invitationId: string;
    status: string;
    role: string;
    workspaceId: string;
    workspaceName: string;
    inviterName: string;
  };
};
```

`StoreState`에 `members: MockMember[]`, `invitations: MockInvitation[]`, `notifications: MockNotification[]`을 추가하고, `createSeedState()`에서 각 워크스페이스에 본인(ADMIN) + 멤버 1명을 넣고 PENDING 초대 알림 1건을 만든다. 시각은 기존 `nextTimestamp()`, id는 `nextId()`를 쓴다 — hydration 규칙상 `Date.now()`를 쓰지 않는다.

동작:

```typescript
listMembers(workspaceId: string) {
  return copy(state.members.filter((m) => m.workspaceId === workspaceId));
},

listInvitations(workspaceId: string) {
  return copy(
    state.invitations.filter(
      (i) => i.workspaceId === workspaceId && i.status === "PENDING"
    )
  );
},

createInvitation(workspaceId: string, input: { email: string; role: string }) {
  if (state.members.some((m) => m.workspaceId === workspaceId && m.email === input.email)) {
    fail("ALREADY_WORKSPACE_MEMBER");
  }
  if (
    state.invitations.some(
      (i) =>
        i.workspaceId === workspaceId &&
        i.email === input.email &&
        i.status === "PENDING"
    )
  ) {
    fail("DUPLICATE_PENDING_INVITATION");
  }
  const invitation: MockInvitation = {
    invitationId: nextId(),
    workspaceId,
    email: input.email,
    role: input.role,
    status: "PENDING",
    inviterName: state.user.name,
    createdAt: nextTimestamp(),
  };
  state.invitations.push(invitation);
  return copy(invitation);
},

acceptInvitation(invitationId: string) {
  const invitation = state.invitations.find((i) => i.invitationId === invitationId);
  if (!invitation) fail("INVITATION_NOT_FOUND");
  if (invitation.status !== "PENDING") fail("INVITATION_NOT_PENDING");
  invitation.status = "ACCEPTED";
  state.members.push({
    userId: nextId(),
    workspaceId: invitation.workspaceId,
    name: invitation.email.split("@")[0],
    email: invitation.email,
    role: invitation.role,
    joinedAt: nextTimestamp(),
  });
  syncNotification(invitation);
  return copy(invitation);
},

declineInvitation(invitationId: string) {
  const invitation = state.invitations.find((i) => i.invitationId === invitationId);
  if (!invitation) fail("INVITATION_NOT_FOUND");
  if (invitation.status !== "PENDING") fail("INVITATION_NOT_PENDING");
  invitation.status = "DECLINED";
  syncNotification(invitation);
  return copy(invitation);
},

cancelInvitation(invitationId: string) {
  const invitation = state.invitations.find((i) => i.invitationId === invitationId);
  if (!invitation) fail("INVITATION_NOT_FOUND");
  if (invitation.status !== "PENDING") fail("INVITATION_NOT_PENDING");
  invitation.status = "CANCELED";
  syncNotification(invitation);
  return copy(invitation);
},

listNotifications() {
  return copy({
    notifications: state.notifications,
    unreadCount: state.notifications.filter((n) => n.readAt === null).length,
  });
},

markNotificationRead(notificationId: string) {
  const notification = state.notifications.find(
    (n) => n.notificationId === notificationId
  );
  if (!notification) fail("NOTIFICATION_NOT_FOUND");
  notification.readAt ??= nextTimestamp();
  return copy(notification);
},
```

`syncNotification(invitation)`은 그 초대를 가리키는 알림의 `invitation.status`를 초대 상태와 맞춘다. 계약상 알림이 초대의 **현재** 상태를 보여줘야 하기 때문이다.

```typescript
function syncNotification(invitation: MockInvitation) {
  const notification = state.notifications.find(
    (n) => n.invitation.invitationId === invitation.invitationId
  );
  if (notification) notification.invitation.status = invitation.status;
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm vitest run lib/mocks/db.test.ts
```

기대: PASS.

- [ ] **Step 5: REST 핸들러를 등록한다**

`lib/mocks/rest-handlers.ts`에 추가한다. import 경로는 `docs/generated-api-map.md`에서 확인한다.

```typescript
getGetWorkspaceMembersMockHandler(({ params }) => ({
  success: true,
  data: { members: mockDb.listMembers(id(params.workspaceId)) },
  error: null,
})),
getGetWorkspaceInvitationsMockHandler(({ params }) => ({
  success: true,
  data: { invitations: mockDb.listInvitations(id(params.workspaceId)) },
  error: null,
})),
getGetNotificationsMockHandler(() => ({
  success: true,
  data: mockDb.listNotifications(),
  error: null,
})),
```

상태 코드를 갈라야 하는 것(초대 생성의 409, 수락의 404)은 기존 전사 세션 핸들러와 같이 `http.post(...)` + `HttpResponse.json(..., { status })`로 쓴다.

```typescript
http.post("*/v1/workspaces/:workspaceId/invitations", async ({ request, params }) => {
  const body = (await request.json()) as { email: string; role: string };
  try {
    const data = mockDb.createInvitation(id(params.workspaceId), body);
    return HttpResponse.json({ success: true, data, error: null }, { status: 201 });
  } catch (error) {
    const code = (error as Error).message;
    const status = code === "DUPLICATE_PENDING_INVITATION" ? 409 : 400;
    return HttpResponse.json(
      { success: false, data: null, error: { code, message: code, details: null } },
      { status }
    );
  }
}),
```

`accept`·`decline`·`cancel`도 같은 형태로 쓰고, `INVITATION_NOT_FOUND`는 404, `INVITATION_NOT_PENDING`은 409로 매핑한다.

- [ ] **Step 6: 핸들러 테스트**

`lib/mocks/rest-handlers.test.ts`에 추가:

```typescript
it("returns 409 for a duplicate pending invitation", async () => {
  const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
  const url = `http://localhost/v1/workspaces/${workspaceId}/invitations`;
  const payload = { email: "dup@heymoa.com", role: "MEMBER" };

  const first = await fetch(url, { method: "POST", body: JSON.stringify(payload) });
  expect(first.status).toBe(201);

  const second = await fetch(url, { method: "POST", body: JSON.stringify(payload) });
  expect(second.status).toBe(409);
  expect((await second.json()).error.code).toBe("DUPLICATE_PENDING_INVITATION");
});
```

- [ ] **Step 7: 검증과 커밋**

```bash
pnpm test:run && pnpm lint
git add lib/mocks
git commit -m "feat(mocks): 초대·알림·멤버 상태 전이 목"
```

---

### Task 5: 목 상태 확장 — 회의·분석·연동

**Files:**
- Modify: `lib/mocks/db.ts`
- Modify: `lib/mocks/db.test.ts`
- Modify: `lib/mocks/rest-handlers.ts`

**Interfaces:**
- Consumes: Task 4의 `db.ts` 구조
- Produces: `mockDb.endMeeting(noteId)`, `mockDb.pauseMeeting(noteId)`, `mockDb.resumeMeeting(noteId)`, `mockDb.requestAnalysis(noteId)`, `mockDb.advanceAnalysis(noteId)`, `mockDb.getLatestAnalysis(noteId)`, `mockDb.listIntegrations(workspaceId)`, `mockDb.connectIntegration(workspaceId, provider)`, `mockDb.disconnectIntegration(workspaceId, provider)`. 노트에 `meetingStatus` 필드가 생긴다 — Task 6의 잠금 검사가 이 값을 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/mocks/db.test.ts`에 추가:

```typescript
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
});

describe("workspace integrations", () => {
  beforeEach(() => mockDb.reset());

  it("connecting records who connected it and when", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    expect(mockDb.listIntegrations(workspaceId)).toEqual([]);

    mockDb.connectIntegration(workspaceId, "LINEAR");

    const [connection] = mockDb.listIntegrations(workspaceId);
    expect(connection.provider).toBe("LINEAR");
    expect(connection.connectedBy.name).toBe("테스트 유저");
    expect(connection.connectedAt).toBeTruthy();
  });

  it("disconnecting removes the connection", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    mockDb.connectIntegration(workspaceId, "LINEAR");

    mockDb.disconnectIntegration(workspaceId, "LINEAR");

    expect(mockDb.listIntegrations(workspaceId)).toEqual([]);
  });
});
```

`firstNoteId()`는 파일 상단에 헬퍼로 둔다.

```typescript
function firstNoteId() {
  const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
  const projectId = mockDb.listProjects(workspaceId)[0].projectId;
  return mockDb.listNotes(projectId)[0].noteId;
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run lib/mocks/db.test.ts
```

기대: `mockDb.endMeeting is not a function`.

- [ ] **Step 3: 구현한다**

`StoreState`에 `analyses: MockAnalysis[]`, `integrations: MockIntegration[]`을 추가하고 노트에 `meetingStatus`, `meetingStartedBy`를 둔다.

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

```typescript
endMeeting(noteId: string) {
  const note = requireNote(noteId);
  if (note.meetingStatus === "ENDED") fail("MEETING_ALREADY_ENDED");
  note.meetingStatus = "ENDED";
  return this.requestAnalysis(noteId);
},

pauseMeeting(noteId: string) {
  const note = requireNote(noteId);
  if (note.meetingStatus !== "IN_PROGRESS") fail("MEETING_NOT_IN_PROGRESS");
  note.meetingStatus = "PAUSED";
  return copy({ noteId, meetingStatus: note.meetingStatus });
},

resumeMeeting(noteId: string) {
  const note = requireNote(noteId);
  if (note.meetingStatus !== "PAUSED") fail("MEETING_NOT_PAUSED");
  note.meetingStatus = "IN_PROGRESS";
  return copy({ noteId, meetingStatus: note.meetingStatus });
},

requestAnalysis(noteId: string) {
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

/** 폴링 데모용 — 대기 중인 분석을 완료로 넘긴다. E2E와 테스트가 호출한다. */
advanceAnalysis(noteId: string) {
  const analysis = latestAnalysis(noteId);
  if (!analysis || analysis.status !== "PENDING") return null;
  analysis.status = "SUCCEEDED";
  analysis.overview = "## 회의 개요\n\n출시 일정과 담당을 정했습니다.";
  analysis.actionItems = "- 배포 체크리스트 작성 (김민수)\n- QA 일정 공유 (한지원)";
  analysis.insights = "- 일정 리스크는 QA 인력에 몰려 있습니다.";
  return copy(analysis);
},

getLatestAnalysis(noteId: string) {
  const analysis = latestAnalysis(noteId);
  if (!analysis) fail("ANALYSIS_NOT_FOUND");
  return copy(analysis);
},

listIntegrations(workspaceId: string) {
  return copy(state.integrations.filter((i) => i.workspaceId === workspaceId));
},

connectIntegration(workspaceId: string, provider: string) {
  if (state.integrations.some((i) => i.workspaceId === workspaceId && i.provider === provider)) {
    fail("INTEGRATION_ALREADY_CONNECTED");
  }
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
    (i) => i.workspaceId === workspaceId && i.provider === provider
  );
  if (index === -1) fail("INTEGRATION_NOT_FOUND");
  state.integrations.splice(index, 1);
},
```

`requireNote(noteId)`와 `latestAnalysis(noteId)`는 파일 안의 기존 헬퍼 옆에 둔다.

`createSeedState()`에서 노트의 `meetingStatus`를 `"IN_PROGRESS"`로 시드하고, 연동은 빈 배열로 둔다 — 연결 흐름을 데모에서 직접 밟게 한다.

- [ ] **Step 4: 통과 확인**

```bash
pnpm vitest run lib/mocks/db.test.ts
```

- [ ] **Step 5: REST 핸들러 등록**

`meeting-end`(202), `meeting-pause`, `meeting-resume`, `analyses`(202), `analyses/latest`, 연동 4개를 `rest-handlers.ts`에 추가한다. `MEETING_NOT_IN_PROGRESS`·`MEETING_NOT_PAUSED`·`MEETING_ALREADY_ENDED`는 409, `ANALYSIS_NOT_FOUND`·`INTEGRATION_NOT_FOUND`는 404다.

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

`meeting-resume`, `meeting-end`, `analyses`, `analyses/latest`, 연동 4개도 같은 뼈대에 호출하는 `mockDb` 함수와 성공 상태 코드만 바꿔 쓴다 — `meeting-end`와 `analyses`는 202, 나머지는 200이다.

**OAuth 우회** — `startWorkspaceIntegration`은 외부로 리다이렉트하는 계약이지만 목에서는 우리 도메인의 목 전용 승인 화면으로 보낸다.

```typescript
http.get("*/v1/workspaces/:workspaceId/integrations/:provider/authorize", ({ params }) =>
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

이 `/mock-oauth` 화면 자체는 Task 9의 디자인 대상이며 구현은 다음 goal이 한다.

- [ ] **Step 6: 검증과 커밋**

```bash
pnpm test:run && pnpm lint
git add lib/mocks
git commit -m "feat(mocks): 회의 상태·분석·워크스페이스 연동 목"
```

---

### Task 6: SSE 스트림 목

**Files:**
- Create: `lib/mocks/chat-stream.ts`
- Create: `lib/mocks/chat-stream.test.ts`
- Create: `lib/mocks/sse-handler.ts`
- Modify: `lib/mocks/handlers.ts`
- Modify: `lib/mocks/db.ts`

**Interfaces:**
- Consumes: Task 5가 노트에 넣은 `meetingStatus` 필드
- Produces: `buildChatEvents(input): MockSseEvent[]` — SSE 이벤트 배열을 만드는 순수 함수. `chatSseHandlers` — MSW 핸들러 배열. `mockDb.acquireSharedChatLock(noteId)`, `mockDb.releaseSharedChatLock(noteId)`.

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

마지막 두 케이스가 계약의 실패 경로다. `"장애를 재현해줘"`는 `error` 종료, `"연결을 끊어줘"`는 **종료 이벤트 없이 끊기는 세 번째 경로**를 만든다.

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

/** 13자 TSID를 결정적으로 만든다 — 계약이 요구하는 형식이고, 무작위면 테스트가 흔들린다. */
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
  const start = frame("message_start", { chatId: input.chatId, messageId });

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
    return [start, ...tokens(content), frame("message_end", { messageId, content })];
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

기대: PASS. `tool_approval_request` 앞뒤 `token`이 각각 1개여야 두 번째 테스트의 배열이 맞는다.

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
        { success: false, data: null, error: { code, message: code, details: null } },
        { status: 409 }
      );
    }
    const events = buildChatEvents({ chatId: noteId, message: body.message });
    mockDb.releaseSharedChatLock(noteId);
    return sseResponse(events);
  }),

  http.post("*/v1/agent-chats/:chatId/approvals/:approvalId", () =>
    HttpResponse.json({ success: true, data: null, error: null }, { status: 204 })
  ),
];
```

`db.ts`에 잠금 두 개를 추가한다.

```typescript
acquireSharedChatLock(noteId: string) {
  const note = requireNote(noteId);
  if (note.meetingStatus !== "IN_PROGRESS") fail("MEETING_NOT_ACTIVE");
  if (state.sharedChatLocks.has(noteId)) fail("CHAT_LOCKED");
  state.sharedChatLocks.add(noteId);
},

releaseSharedChatLock(noteId: string) {
  state.sharedChatLocks.delete(noteId);
},
```

`StoreState`에 `sharedChatLocks: Set<string>`을 추가하고 `createSeedState()`에서 빈 `Set`으로 시드한다.

- [ ] **Step 6: 레지스트리에 등록**

`lib/mocks/handlers.ts`의 `handlers` 배열에 `...chatSseHandlers`를 `...restHandlers` 뒤, `transcriptionWebSocketHandler` 앞에 넣는다.

- [ ] **Step 7: 검증과 커밋**

```bash
pnpm test:run && pnpm lint && pnpm build
git add lib/mocks
git commit -m "feat(mocks): 채팅 SSE 스트림 목 — 승인 흐름과 실패 경로 포함"
```

- [ ] **Step 8: codex 리뷰 (1차 게이트)**

목 세 태스크가 이 작업에서 로직이 가장 많은 곳이라 여기서 한 번 받는다.

```bash
codex exec review --base dev
```

지적마다 **고친다 / 근거를 적고 넘어간다 / 별도 이슈로 뺀다** 중 하나를 고르고
`docs/codex-review-2026-07-23.md`에 한 줄씩 남긴다.

```markdown
# codex 리뷰 기록 (2026-07-23)

## 1차 — 목 3종 (Task 4~6)

| 지적 | 판단 | 근거 |
|---|---|---|
```

계약 미러와 `lib/api/generated/**`에 대한 지적은 반영하지 않고 기록만 한다.

```bash
git add docs/codex-review-2026-07-23.md
git commit -m "docs: codex 1차 리뷰 기록 (목 3종)"
```

---

### Task 7: Playwright 도입과 스모크

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 4~6의 목
- Produces: `pnpm test:e2e`. Task 8·9의 검증 명령에 포함된다.

- [ ] **Step 1: 설치**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: 설정 파일**

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

`package.json`의 `scripts`에 추가한다.

```json
"test:e2e": "playwright test"
```

`.gitignore`에 추가한다.

```
/test-results
/playwright-report
```

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

세 번째가 이 태스크의 핵심이다 — 3단계 목이 **jsdom이 아니라 서비스 워커 경로에서도** 도는지의 증거다.

- [ ] **Step 4: 실행**

```bash
pnpm test:e2e
```

기대: 3 passed. 첫 실행에서 `/w` 경로나 텍스트가 실제 화면과 다르면 셀렉터를 실제 렌더 결과에 맞춰 고친다 — 화면을 고치지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add playwright.config.ts e2e package.json pnpm-lock.yaml .gitignore
git commit -m "test(e2e): Playwright 스모크 — MSW 서비스 워커 경로 검증"
```

- [ ] **Step 6: codex 리뷰 (2차 게이트)**

새 도구·설정이 들어온 직후라 여기서 한 번 더 받는다.

```bash
codex exec review --base dev
```

`docs/codex-review-2026-07-23.md`에 `## 2차 — Playwright 도입` 절을 추가해 같은 형식으로 남긴다.

```bash
git add docs/codex-review-2026-07-23.md
git commit -m "docs: codex 2차 리뷰 기록 (Playwright)"
```

---

### Task 8: API 맥락 맵과 shadcn 매핑표

**Files:**
- Create: `docs/api-surface.md`

**Interfaces:**
- Consumes: `docs/generated-api-map.md`, `openapi3.yml`, Task 4~6의 `mockDb` 동작
- Produces: `docs/api-surface.md`. Task 9의 여섯 에이전트가 공통 입력으로 읽는다. `v4 프레임 ID`가 `없음`인 행의 집합이 Task 9의 작업 목록이다.

- [ ] **Step 1: 34경로를 표로 옮긴다**

`docs/api-surface.md`:

```markdown
# API 표면 (2026-07-23)

`openapi3.yml` 34경로가 만드는 화면과 상태. mvp.pen v4 프레임과의 대응을 함께 적는다.
`v4 프레임 ID`가 `없음`인 행이 디자인 작업 목록이다.

| 경로 | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 ID |
|---|---|---|---|---|
| `GET /v1/notifications` | `useGetNotifications` | 알림 벨 | 빈 목록 / 미읽음 배지 | `O1xLI` |
| `PUT /v1/notifications/{id}/read` | `useMarkNotificationRead` | 알림 벨 | 배지 감소 | `O1xLI` |
| `POST /v1/agent-chats/{chatId}/messages` | (없음 — `postEventStream`) | 개인 챗봇 | 스트리밍 / 승인 대기 / 실패 | `LeuWE`, `LCXcj` |
```

나머지 31행을 같은 형식으로 채운다. 훅 이름은 `docs/generated-api-map.md`의 파일을 열어 실제 export 이름을 확인하고 옮긴다 — 추정하지 않는다.

v4 프레임 ID는 pencil MCP로 `mvp.pen`의 y≥17000 프레임을 조회해 대응을 찾는다. 없으면 `없음`으로 적는다.

- [ ] **Step 2: 실패 상태를 표 아래에 정리한다**

```markdown
## 목이 표현하는 실패

| 실패 | 경로 | 화면에서 보여야 하는 것 | v4 프레임 ID |
|---|---|---|---|
| 409 입력 잠금 | `POST /v1/notes/{noteId}/chat/messages` | "OO님이 입력 중" + 입력창 비활성 | `xPpzc` |
| 409 회의 비ACTIVE | 같음 | "중지 중에는 개인 챗봇을 이용하세요" | |
| 403 관전자 승인 시도 | `POST /v1/agent-chats/{chatId}/approvals/{approvalId}` | 승인 권한 없음 안내 | |
| 404 만료된 승인 | 같음 | 카드 무효화 + 사유 | |
| 종료 이벤트 없이 SSE 끊김 | 두 스트림 경로 | 재시도 UX | |
| OAuth 리다이렉트 | `.../integrations/{provider}/authorize` | 목 전용 승인 화면 `/mock-oauth` | |
```

빈 칸은 조회 결과로 채우고, 없으면 `없음`이라 적는다.

- [ ] **Step 3: shadcn 매핑표**

```markdown
## shadcn 프리미티브 매핑

여섯 에이전트가 각자 다른 프리미티브를 고르면 구현이 갈라진다. 여기 적힌 것을 쓴다.

| UI 요소 | shadcn 프리미티브 |
|---|---|
| 승인 카드 | `Card` + `Button`(승인/거절) |
| 알림 벨 | `DropdownMenu` + `Badge` |
| 설정 탭(멤버·연동) | `Tabs` |
| 초대 폼 | `Form` + `Input` + `Select`(역할) |
| 잠금·비ACTIVE 안내 | `Alert` |
| 회의 종료 확인 | `AlertDialog` |
| 분석 진행 | `Skeleton` |
| 요약 3종 | `Tabs` + 마크다운 렌더 |
| 도구 실행 기록 | `Card`(축약) + `Badge`(상태) |
| 연동 연결/해제 | `Card` + `Button` + `Badge`(연결됨) |
```

- [ ] **Step 4: 검증**

`openapi3.yml`의 경로 수와 표의 행 수가 같은지 센다.

```bash
grep -c "^| \`" docs/api-surface.md
```

기대: 34 (표 헤더 제외).

- [ ] **Step 5: 커밋**

```bash
git add docs/api-surface.md
git commit -m "docs: API 표면 맵과 shadcn 매핑표"
```

---

### Task 9: mvp.pen v4 계약 정합성 감사 (에이전트 6개)

**Files:**
- Modify: `/Users/kms/Desktop/heymoa/mvp.pen` (git 밖)
- Create: `docs/design-decisions.md`

**Interfaces:**
- Consumes: `docs/api-surface.md`의 `없음` 목록, shadcn 매핑표
- Produces: `docs/design-decisions.md`. 화면 구현 이슈(APP-111~117)가 읽을 문서다

- [ ] **Step 1: 백업**

```bash
cp /Users/kms/Desktop/heymoa/mvp.pen /Users/kms/Desktop/heymoa/mvp.pen.bak-2026-07-23
ls -la /Users/kms/Desktop/heymoa/mvp.pen.bak-2026-07-23
```

`mvp.pen`은 git 밖이라 이 사본이 유일한 복구 경로다. 백업이 없으면 다음 단계로 가지 않는다.

- [ ] **Step 2: 실측 기준 확보**

```bash
NEXT_PUBLIC_API_MOCKING=enabled pnpm dev
```

구현된 화면(워크스페이스 목록·노트 상세·설정)의 실제 치수를 재서 기록한다. 신규 화면은 이 값에서 파생시킨다 — 추측으로 만들지 않는다.

- [ ] **Step 3: 여섯 에이전트를 동시에 띄운다**

각 에이전트에게 아래 프롬프트를 행 정보만 바꿔 준다.

```
mvp.pen v4의 「{행 이름}」 행을 계약 기준으로 감사하고 구멍을 메운다.

파일: /Users/kms/Desktop/heymoa/mvp.pen  (pencil MCP로만 접근)
담당 행: y={행 y좌표}, 현재 프레임 {프레임 ID 목록}
입력: heymoa-web/docs/api-surface.md — 네 행에 해당하는 경로·상태·shadcn 매핑만 본다

할 일
1. 담당 행의 프레임을 읽는다
2. api-surface.md에서 v4 프레임 ID가 "없음"인 행 중 네 담당인 것을 찾는다
3. 그 화면·상태를 프레임으로 추가한다
4. 기존 프레임이 계약과 어긋나면 고친다

규약 (어기면 되돌릴 수 없다)
- 새 프레임: x = 네 행 마지막 프레임의 x + 1840, y는 행 고정, 크기 1440x900
- 재구성은 네 행 안에서, 기존 v4 토큰·컴포넌트 범위 내로
- 공용 reusable 노드는 절대 수정하지 않는다. 필요하면 보고만 한다
- 치수는 실측값에서 파생시킨다. 추측 금지

산출
heymoa-web/docs/design-decisions.md의 「{행 이름}」 절에 추가한다.
프레임마다: 프레임 ID · 대응 API · 응답이 만드는 상태 · shadcn 프리미티브 · 실측 근거

끝나면 담당 행의 snapshot_layout과 스크린샷을 남긴다.
```

행 배정:

| 에이전트 | 행 이름 | y | 현재 프레임 |
|---|---|---|---|
| 1 | note-hub + side panel | 20000, 32000 | `TkHep` `DdzUR` `oMqgT` `Kl7Dz` `ezlsT` `X3vCNH` `LdiLi` `V7cEN` |
| 2 | 회의 종료와 요약 | 22000 | `hbv5v` `uWnWH` `quNSL` `PAVkf` |
| 3 | 공유 챗봇 | 24000 | `F8dV8C` `xPpzc` `TqX06` |
| 4 | 개인 챗봇 | 26000 | `LeuWE` `LCXcj` `xyR27` |
| 5 | 도구 승인 | 28000 | `eP8jX` `jobCE` `ImOW0` |
| 6 | 연동·알림·멤버 | 30000 | `soPy6` `t8oW0` `O1xLI` `iAG1e` |

`/mock-oauth` 목 전용 승인 화면은 6번 담당이다.

- [ ] **Step 4: 손상 감지와 강등**

여섯이 끝나면 파일을 연다.

```bash
ls -la /Users/kms/Desktop/heymoa/mvp.pen
```

pencil MCP로 문서를 읽어 파싱되는지 확인한다. 파싱이 깨지거나 프레임이 유실됐으면:

```bash
cp /Users/kms/Desktop/heymoa/mvp.pen.bak-2026-07-23 /Users/kms/Desktop/heymoa/mvp.pen
```

복구한 뒤 **2명씩 3배치로 다시 돌린다.** 배치 사이마다 백업을 갱신한다.

- [ ] **Step 5: 정합성 확인**

`docs/api-surface.md`를 다시 열어 `없음`이 남아 있는지 센다.

```bash
grep -c "없음" docs/api-surface.md
```

기대: 0. 남아 있으면 그 행의 담당 에이전트를 다시 띄운다.

`docs/design-decisions.md`에 여섯 절이 모두 있고, 각 프레임마다 대응 API·상태·shadcn 프리미티브가 적혀 있는지 확인한다.

공용 `reusable` 노드가 바뀌지 않았는지 백업본과 대조한다.

- [ ] **Step 6: 최종 검증과 커밋**

```bash
pnpm test:run && pnpm lint && pnpm build && pnpm test:e2e
git add docs/design-decisions.md docs/api-surface.md
git commit -m "docs: v4 계약 정합성 감사 결과와 디자인 결정 기록"
```

`mvp.pen`은 git 밖이라 커밋되지 않는다. 백업본을 남겨 둔다.

- [ ] **Step 7: codex 리뷰 (최종 게이트)**

브랜치 전체를 한 번 받는다. merge 전 마지막 관문이다.

```bash
codex exec review --base dev
```

`docs/codex-review-2026-07-23.md`에 `## 3차 — 브랜치 전체` 절을 추가한다.
남은 지적이 전부 판단·기록되면 merge한다.

```bash
git add docs/codex-review-2026-07-23.md
git commit -m "docs: codex 최종 리뷰 기록 (브랜치 전체)"
git checkout dev && git merge --squash - && git commit
```
