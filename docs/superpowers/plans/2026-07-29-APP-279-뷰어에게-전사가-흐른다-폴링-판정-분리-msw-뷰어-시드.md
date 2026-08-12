# APP-279 Viewer Transcript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 진행 중인 남의 회의를 연 뷰어가 전사를 실시간으로 따라가고, 시작자 전용 조작 대신 뷰어용 상태와 안내를 보게 합니다.

**Architecture:** `NotePanel`이 이미 조회한 노트에서 `SharedChatPhase`와 시작자 여부를 계산해 전사·독·종료 전환에 전달합니다. 로컬 녹음 상태는 마이크 partial과 파형에만 남기고, 서버 회의 상태는 폴링과 라이브 착지를 소유합니다. MSW는 실제 계약 오류 봉투와 별도 뷰어 시드를 제공합니다.

**Tech Stack:** Next.js 16, React 19, TanStack Query, Vitest, Testing Library, MSW, Playwright

## Global Constraints

- `lib/api/generated/**`와 `openapi3.yml`은 편집하지 않습니다.
- `deriveMeetingPhase(note) === "active"`가 서버 회의 라이브 판정입니다.
- `liveForNote`는 이 브라우저의 partial·final 병합에만 사용합니다.
- 진행 중 뷰어에게 레코더 독과 `기록 시작`을 노출하지 않습니다.
- 종료 전환은 인라인 안내를 먼저 보이고 읽던 전사를 즉시 교체하지 않습니다.
- 지속 잠금은 인라인 Alert로 남기되 disabled placeholder는 제거합니다.
- 모든 production 변경은 먼저 실패하는 행동 테스트를 확인합니다.
- 기존 컴포넌트·헬퍼를 재사용하고 새 의존성을 추가하지 않습니다.

---

### Task 1: MSW Viewer Seed and Session Authorization

**Files:**
- Modify: `lib/mocks/db.ts`
- Test: `lib/mocks/db.test.ts`
- Test: `lib/mocks/rest-handlers.test.ts`

**Interfaces:**
- Produces: 다른 사용자가 시작한 `IN_PROGRESS` 노트와 여러 persisted transcript segment
- Produces: foreign meeting의 session POST가 `403 NOT_MEETING_STARTER` 계약 봉투를 반환

- [ ] **Step 1: Write the failing seed test**

`mockDb.listNotes(projectId)`에서 현재 mock user가 아닌 시작자의 진행 중 노트를 찾고, `mockDb.getTranscript(noteId).segments`가 여러 행인지 검증합니다.

- [ ] **Step 2: Run the seed test and verify RED**

Run: `pnpm vitest run lib/mocks/db.test.ts`

Expected: foreign active note를 찾지 못해 FAIL.

- [ ] **Step 3: Add the minimal deterministic seed**

기존 프로젝트에 외부 시작자 진행 노트 하나, 완료 세션 하나, 해당 세션의 여러 transcript segment를 고정 ID로 추가합니다. ACTIVE 세션은 시드하지 않습니다.

- [ ] **Step 4: Write and verify the failing REST authorization test**

foreign note에 `POST /v1/notes/{noteId}/transcription-sessions`를 보내 `403`, `success:false`, `data:null`, `error.code:"NOT_MEETING_STARTER"`, `error.message:"회의 시작자만 조작할 수 있습니다."`를 기대합니다.

Run: `pnpm vitest run lib/mocks/rest-handlers.test.ts`

Expected: 현재 201 또는 잘못된 오류 봉투로 FAIL.

- [ ] **Step 5: Add the minimal createSession guard**

`meetingStartedBy`가 존재하고 현재 mock user와 다를 때만 `NOT_MEETING_STARTER`를 발생시킵니다. 시작자가 null인 새 회의는 계속 시작할 수 있어야 합니다.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm vitest run lib/mocks/db.test.ts lib/mocks/rest-handlers.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `[APP-279] MSW 뷰어 회의와 시작 권한 반영`

---

### Task 2: Viewer Polling, Live Landing, and Empty Copy

**Files:**
- Modify: `components/notes/note-panel.tsx`
- Modify: `components/notes/transcript-view.tsx`
- Test: `components/notes/transcript-view.test.tsx`
- Test: `components/notes/note-panel.test.tsx`

**Interfaces:**
- Consumes: `NotePanel`의 `phase: SharedChatPhase`
- Produces: `<TranscriptView noteId phase>`; phase가 active면 로컬 녹음 여부와 무관하게 2.5초 폴링하고 첫 렌더에 끝단 착지

- [ ] **Step 1: Write the failing viewer polling test**

로컬 녹음이 idle이어도 `phase="active"`이면 `refetchInterval:2500`, `staleTime:0`인지 검증합니다. `phase="not-started"`이면 폴링하지 않아야 합니다.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run components/notes/transcript-view.test.tsx`

Expected: `TranscriptView`가 phase를 받지 않아 FAIL.

- [ ] **Step 3: Pass the existing phase and split local/server state**

`NotePanel`에서 이미 계산한 phase를 `TranscriptView`에 전달합니다. 서버 회의 active는 query polling과 진입 scroll effect를 제어하고, `liveForNote`는 local partial/final 병합만 제어합니다.

- [ ] **Step 4: Write the failing landing and copy tests**

active viewer가 mount될 때 `scrollTo({top:scrollHeight})`가 호출되는지 검증합니다. active 빈 전사는 `첫 발화를 기다리고 있습니다`, not-started 빈 전사는 `기록을 시작하고 평소처럼 대화하세요`를 보여야 합니다.

- [ ] **Step 5: Implement the minimal effect and copy conditions**

기존 스크롤 엔진과 180px threshold는 바꾸지 않고 effect 조건만 server phase로 바꿉니다.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm vitest run components/notes/transcript-view.test.tsx components/notes/note-panel.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `[APP-279] 뷰어 전사 폴링과 라이브 착지 분리`

---

### Task 3: Viewer Controls, End Notice, and Chat Lock

**Files:**
- Modify: `components/notes/note-panel.tsx`
- Modify: `components/notes/shared-chat-panel.tsx`
- Test: `components/notes/note-panel.test.tsx`
- Test: `components/notes/shared-chat-panel.test.tsx`

**Interfaces:**
- Consumes: `useAuth().user`, `note.meetingStartedBy`, `phase`
- Produces: 시작자 또는 미시작 회의만 full 레코더 독 노출
- Produces: active→ended 뷰어 전환 시 인라인 종료 안내와 명시적 archive 전환

- [ ] **Step 1: Write the failing dock role test**

다른 사용자가 시작한 active note의 full 화면에서 `녹음 제어`와 `기록 시작`이 없어야 합니다. 현재 사용자가 시작자이거나 회의가 not-started이면 기존 독이 남아야 합니다.

- [ ] **Step 2: Verify RED and implement the minimal owner predicate**

Run: `pnpm vitest run components/notes/note-panel.test.tsx`

Expected before implementation: foreign viewer에도 독이 보여 FAIL.

`showDock`은 현재 노트의 로컬 녹음이 실제로 active이거나, full에서 미시작/현재 시작자인 경우만 true로 둡니다.

- [ ] **Step 3: Write the failing viewer end-transition test**

foreign active note를 ended로 rerender했을 때 `회의가 종료되었습니다` 인라인 안내가 보이고 기존 `TranscriptView`가 유지되며 `NoteArchive`는 아직 없어야 합니다. 안내의 `기록과 요약 보기`를 누른 뒤에 archive가 보여야 합니다.

- [ ] **Step 4: Implement the minimal transition state**

이전 phase가 active였고 현재 phase가 ended이며 현재 사용자가 시작자가 아닐 때만 안내를 엽니다. 초기 ended 로드는 기존 archive를 그대로 사용합니다.

- [ ] **Step 5: Write the failing spectator-lock test**

빈 대화에 foreign lock이 있으면 lock Alert와 typing divider만 보이고, `아직 나눈 대화가 없습니다`와 disabled message input은 없어야 합니다.

- [ ] **Step 6: Remove only the redundant placeholder**

spectator일 때 `ChatThread.emptyState`를 null로 하고 `ComposerNotice`의 disabled input 렌더를 제거합니다. Alert와 typing divider는 유지합니다.

- [ ] **Step 7: Verify GREEN**

Run: `pnpm vitest run components/notes/note-panel.test.tsx components/notes/shared-chat-panel.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit: `[APP-279] 뷰어 조작과 종료·잠금 안내 정리`

---

### Task 4: Note Cache Invalidation and Browser Verification

**Files:**
- Modify: `components/transcription/recording-provider.tsx`
- Test: `components/transcription/recording-provider.test.tsx`
- Test: `e2e/smoke.spec.ts`

**Interfaces:**
- Produces: session creation 성공 직후 `getGetNoteQueryKey(noteId)` invalidation
- Verifies: MSW viewer route at 1280×720 and 375×812

- [ ] **Step 1: Write the failing note invalidation test**

`start(noteId)` 성공 뒤 `invalidateQueries`가 exact note query key로 호출되는지 검증합니다. transcript와 project note-list invalidation만으로는 통과하지 않게 exact key를 비교합니다.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run components/transcription/recording-provider.test.tsx`

Expected: note detail key 호출이 없어 FAIL.

- [ ] **Step 3: Add the minimal invalidation**

generated notes module의 `getGetNoteQueryKey(noteId)`를 사용해 session 생성 성공 직후 note detail query를 invalidate합니다.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run components/transcription/recording-provider.test.tsx`

Expected: PASS.

- [ ] **Step 5: Add one focused viewer E2E flow**

foreign viewer seed full route에서 레코더 독이 없고 transcript block이 보이며 scroll viewport가 끝단에 착지하는지 검증합니다. viewport는 1280×720과 375×812 두 크기를 같은 검증 함수로 실행합니다.

- [ ] **Step 6: Run focused integration checks**

Run: `pnpm vitest run lib/mocks/db.test.ts lib/mocks/rest-handlers.test.ts components/notes/transcript-view.test.tsx components/notes/note-panel.test.tsx components/notes/shared-chat-panel.test.tsx components/transcription/recording-provider.test.tsx`

Run: `pnpm playwright test e2e/smoke.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `[APP-279] 녹음 시작 상태 동기화와 뷰어 검증 추가`
