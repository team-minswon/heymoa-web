# APP-112 공유 챗봇 UI 구현 계획

**Goal:** 노트 full 모드 우측에 공유 챗봇 트레이 — 회의 상태 게이트·입력 잠금·관전자 폴링·아카이브. APP-113 SSE 레이어 재사용.

**Architecture:** `use-chat-stream`·`chat-thread`·`stream-protocol`을 개인 챗봇과 공유한다. 공유만의 것(회의 게이트·잠금·폴링·아카이브)을 더한다. 게이트는 순수 파생(`meeting-state.ts`)으로 떼어 브라우저 없이 테스트한다.

**Tech Stack:** Next.js 16, TanStack Query v5, orval, MSW 2, vitest(jsdom), Playwright.

## Global Constraints

- ACTIVE 판정 = `meetingStatus === "IN_PROGRESS" && meetingStartedBy !== null` (단일 출처).
- 관전자 = `!내가_로컬_스트리밍_중 && lock.locked`. 이름 비교 금지.
- 폴링(`refetchInterval`)은 `meetingStatus === IN_PROGRESS && !스트리밍`일 때만.
- 개인 챗봇 `hidden = side || (full && meetingStatus !== "ENDED")`. `open()`이 hidden을 이긴다.
- 모든 API는 orval 훅. SSE만 `postEventStream`. 인라인 상태는 `suppressErrorToast`.
- 오류 표시: `AGENTS.md` 경계표. 지속 상태 = 인라인 Alert, mutation 실패 = 전역 토스트.
- 검증: `pnpm orval && pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`.

---

### Task 1: 회의 상태 파생 (`lib/notes/meeting-state.ts`)

**Files:** Create `lib/notes/meeting-state.ts`, `lib/notes/meeting-state.test.ts`.

**Interfaces:**
- Produces: `type SharedChatPhase = "active" | "not-started" | "paused" | "ended"`.
  `deriveMeetingPhase(note: { meetingStatus; meetingStartedBy } | undefined): SharedChatPhase | "unknown"`.
  `isMeetingActive(note): boolean` = phase === "active".

- [ ] 테스트: IN_PROGRESS+startedBy → "active"; IN_PROGRESS+null → "not-started"; PAUSED → "paused"; ENDED → "ended"; undefined → "unknown".
- [ ] 구현: 위 판정. `meetingStartedBy !== null` 조건 포함.
- [ ] `pnpm test:run lib/notes/meeting-state` 통과.
- [ ] Commit: `feat(app-112): 회의 상태 파생`.

### Task 2: `chat-thread`가 작성자 이름을 수용

**Files:** Modify `components/chat/chat-thread.tsx`, `components/chat/chat-thread.test.tsx`.

**Interfaces:**
- `ThreadMessage` 타입을 개인·공유 둘 다 받게 넓힌다: 공통 필드 + optional `authorName?: string | null`.
- Consumes: `NoteSharedChatResponseDataMessagesItem` | `AgentChatMessagesResponseDataMessagesItem`.

- [ ] 테스트: `authorName`이 있는 USER 메시지는 이름을 렌더(`role="USER"` 위 작은 텍스트), 없으면 미렌더. ASSISTANT/TOOL은 이름 없음.
- [ ] 구현: `ThreadMessage` union/확장, `UserBubble`에 optional `author` prop, `HistoryMessage`가 `message.authorName` 전달.
- [ ] `pnpm test:run components/chat/chat-thread` 통과.
- [ ] Commit: `feat(app-112): chat-thread 작성자 이름 수용`.

### Task 3: 개인 챗봇 `open()`이 감춤을 이긴다

**Files:** Modify `components/chat/personal-chat.tsx`, `components/chat/personal-chat.test.tsx`.

**Interfaces:**
- Provider에 `forceVisible` 상태. `open()` → `setForceVisible(true)` + `setIsOpen(true)` + `setHasOpened(true)`. `close()` → `setForceVisible(false)` + `setIsOpen(false)`.
- `isVisible = (isOpen && !hidden) || (isOpen && forceVisible)`. 버튼/패널 hidden 계산에 forceVisible 반영.
- 라우트 이탈 시 forceVisible 리셋(스코프 해제 경로에 편승).

- [ ] 테스트: `hidden=true`인데 `open()` 호출 → 패널이 보인다(`data-testid` 노출). `close()` → 다시 감춤.
- [ ] 구현: `forceVisible` 추가, 패널 `hidden` prop = `!isOpen || (hidden && !forceVisible)`.
- [ ] `pnpm test:run components/chat/personal-chat` 통과.
- [ ] Commit: `feat(app-112): 개인 챗봇 open이 감춤을 이긴다`.

### Task 4: 목에 남의 잠금 시드

**Files:** Modify `lib/mocks/db.ts`, `lib/mocks/rest-handlers.ts`, `lib/mocks/rest-handlers.test.ts`.

**Interfaces:**
- `mockDb.seedForeignLock(noteId, lockedByName)` — `lockedBy`가 현재 유저가 아닌 잠금을 세팅.
- `getNoteSharedChat`이 시드된 이름을 `lockedBy`로 반환(없으면 기존 로직).
- 데모/e2e 진입점: 쿼리파라미터나 전용 목 경로로 시드 (테스트에서 호출 가능하게).

- [ ] 테스트: `seedForeignLock` 후 `GET chat/messages`가 `lock.locked=true`·`lockedBy="다른 사람"` 반환.
- [ ] 구현: `state`에 `sharedChatForeignLock: Map<noteId, name>`, `getNoteSharedChat` 우선 반영.
- [ ] `pnpm test:run lib/mocks/rest-handlers` 통과.
- [ ] Commit: `feat(app-112): 목에 남의 잠금 시드 (관전자 재현)`.

### Task 5: 공유 챗봇 패널 (`components/notes/shared-chat-panel.tsx`)

**Files:** Create `components/notes/shared-chat-panel.tsx`, `components/notes/shared-chat-panel.test.tsx`.

**Interfaces:**
- Consumes: `deriveMeetingPhase`(Task 1), `useChatStream`, `ChatThread`(Task 2), `useGetNoteSharedChatMessages`, `getSendNoteSharedChatMessageUrl`, `usePersonalChat().openPersonal`(Task 3 open).
- Props: `{ noteId: string; phase: SharedChatPhase }`.
- 관전자 판별: `stream.state.phase === "idle" && lock.locked`.
- 폴링: `refetchInterval: phase === "active" && !streaming ? 3000 : false`.
- 전송 트랜잭션: 개인 패널의 send 흐름 재사용(스트림 → `message_end` → 히스토리 fetchQuery → reset). 공유는 세션 생성 없음(chatId 항상 존재, `data.chatId`).
- 승인: `useResolveToolApproval({ chatId: data.chatId, approvalId })` — 개인과 동일(심화는 APP-114).

- [ ] 테스트(활성): 전송 → 목 스트림 토큰 렌더 → `message_end` 후 히스토리 반영.
- [ ] 테스트(관전): `lock.locked`+비스트리밍 → 입력 비활성 + "OO님이 입력 중" Alert + TypingDivider.
- [ ] 테스트(중지): phase=paused → 컴포저 잠김 + "개인 챗봇 이용" + [개인 챗봇 열기]가 `openPersonal` 호출.
- [ ] 테스트(미시작): phase=not-started → 빈 상태 + 녹음 안내.
- [ ] 구현: 위. 컴포저는 phase로 분기, 스레드는 `ChatThread` 재사용.
- [ ] `pnpm test:run components/notes/shared-chat-panel` 통과.
- [ ] Commit: `feat(app-112): 공유 챗봇 패널 — 게이트·잠금·관전·스트림`.

### Task 6: 노트 full 2컬럼 셸 + 개인 챗봇 감춤 확장

**Files:** Modify `components/notes/note-panel.tsx`, `components/notes/note-view.tsx`.

**Interfaces:**
- `note-panel.tsx`: full 모드(`onExpand` 없음 = full? 아니다 — view를 prop으로 받는다)일 때 우측에 `<SharedChatPanel noteId phase>` 트레이 추가(ENDED 제외). `deriveMeetingPhase(note)`로 phase 계산. side는 그대로.
- `note-view.tsx`: `useGetNote`로 meetingStatus 읽어 `usePersonalChatScope({ noteId, hidden: view==="side" || (view==="full" && phase!=="ended") })`.
- ENDED면 우측 트레이 대신 좌측을 아카이브로(Task 7), 개인 챗봇 보임.

- [ ] 테스트: full+active면 공유 트레이 렌더(`shared-chat-panel` testid), full+ended면 미렌더. side면 미렌더.
- [ ] 테스트: full+active면 개인 챗봇 hidden, ended면 보임.
- [ ] 구현: 2컬럼 레이아웃(좌 flex-1 or 폭, 우 448). full에서만.
- [ ] `pnpm test:run components/notes/note-panel components/notes/note-view` 통과.
- [ ] Commit: `feat(app-112): 노트 full 2컬럼 셸 + 개인 챗봇 감춤 확장`.

### Task 7: ENDED 아카이브 (`components/notes/note-archive.tsx`)

**Files:** Create `components/notes/note-archive.tsx`, `components/notes/note-archive.test.tsx`. Modify `note-panel.tsx`(ENDED에서 아카이브 섹션 노출).

**Interfaces:**
- Consumes: `useGetNoteTranscript`(전사 블록), `useGetNoteSharedChatMessages`(Q&A), `ChatThread` 히스토리 렌더.
- 렌더: 기존 전사 블록 + 아래 "회의 중 챗봇 대화" 구분선 + 공유 Q&A(`createdAt` 순, 승인/실행 기록 포함).
- `ponytail:` 천장 — 세그먼트 절대 시각이 계약에 없어 인터리브 대신 섹션 부착. 주석으로 명시.

- [ ] 테스트: ENDED 노트에서 전사 블록과 공유 Q&A가 모두 렌더, Q&A가 createdAt 순.
- [ ] 구현: 전사 컬럼 아래 Q&A 섹션. Q&A 없으면 섹션 미표시.
- [ ] `pnpm test:run components/notes/note-archive` 통과.
- [ ] Commit: `feat(app-112): ENDED 아카이브 — 전사 + 공유 Q&A`.

### Task 8: e2e 스모크 + 브라우저 실측 검증

**Files:** Modify `e2e/smoke.spec.ts`.

- [ ] 브라우저(MSW 서비스 워커)로 노트 full 열어 공유 챗봇 한 턴 흘리기, 남의 잠금 시드로 관전자 화면 확인 — 실측 후 좌표·간격 v4 프레임과 대조.
- [ ] e2e: 노트 full → 공유 챗봇 전송 → 목 답변 노출.
- [ ] 전체 검증 `pnpm orval && pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` 통과.
- [ ] Commit: `test(app-112): 공유 챗봇 e2e 스모크`.

## Self-Review

- 스펙 커버: 상태 게이트(T1,5,6)·잠금/관전(T4,5)·스트림 재사용(T5)·아카이브(T7)·개인챗 조정(T3,6)·작성자(T2)·검증(T8). 전부 태스크 있음.
- 타입 일관: `SharedChatPhase`(T1)를 T5·T6가 소비, `ThreadMessage` 확장(T2)을 T5·T7이 소비.
- 천장: 아카이브 인터리브 한계는 T7 주석 + spec에 기록.
