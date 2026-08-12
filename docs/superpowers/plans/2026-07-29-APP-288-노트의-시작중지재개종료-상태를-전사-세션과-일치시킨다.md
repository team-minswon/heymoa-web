# APP-288 Meeting Lifecycle Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render and control `NOT_STARTED → IN_PROGRESS ↔ PAUSED → ENDED` consistently across list, full, and side views without auto-starting a new note or counting paused time.

**Architecture:** Generated OpenAPI models remain the boundary, `RecordingProvider` remains the sole local transcription controller, and REST note snapshots remain the authority. A small pure meeting-state module formats state and cumulative time; existing realtime events only invalidate queries. `RecordingDock` is the single start/stop/resume surface in full and side; `MeetingControls` owns status and final end.

**Tech Stack:** Next.js 15, React 19, TypeScript, TanStack Query, Orval, MSW, Vitest, Playwright, Pencil.

## Global Constraints

- Never infer meeting state from `meetingStartedBy` or local recording phase.
- Never calculate duration from `meetingStartedAt`.
- READY may be `IN_PROGRESS` with null `activeSessionStartedAt`; freeze the base duration.
- New note creation must not request microphone permission or start transcription.
- Add no pause/resume API, local meeting store, dependency, or duplicate recording controls.
- Lifecycle buttons keep 44px hit targets and accessible names.

---

### Task 1: Sync generated contract and four-state MSW

**Files:**
- Replace from docs public contract: `openapi3.yml`
- Generated: `lib/api/generated/**`
- Modify: `lib/mocks/db.ts`, `lib/mocks/rest-handlers.ts`, `lib/mocks/transcription-scenario.ts`
- Test: `lib/api/openapi-contract.test.ts`
- Test: `lib/api/contract-consistency.test.ts`
- Test: `lib/mocks/db.test.ts`
- Test: `lib/mocks/rest-handlers.test.ts`

**Interfaces:**
- Produces: four-state generated enums and list/detail timing fields.
- Consumes: server/docs contract commit.

- [ ] Write failing contract tests for four states, required timing keys, and absence of pause/resume paths.
- [ ] Run `rtk pnpm test:run lib/api/openapi-contract.test.ts`.
- [ ] Copy the public OpenAPI and run `rtk pnpm orval`; never hand-edit generated files.
- [ ] Make MSW create `NOT_STARTED`, session create `IN_PROGRESS`, terminal `PAUSED`, repeat sessions cumulatively, and reject ENDED start.
- [ ] Run mock tests and commit `[APP-288] 회의 상태 계약과 MSW 동기화`.

### Task 2: Pure status and time presentation

**Files:**
- Create: `lib/notes/meeting-state.ts`
- Create: `lib/notes/meeting-state.test.ts`

**Interfaces:**
- Produces: status copy/action mapping and `getRecordedDurationMs(note, now)`.
- Consumes: generated note list/detail timing shape.

- [ ] Write failing table tests for all four states, READY-null freeze, future/invalid timestamps, pause freeze, and repeated resume.
- [ ] Implement:

```ts
const live = status === "IN_PROGRESS" && activeSessionStartedAt
  ? Math.max(0, now - Date.parse(activeSessionStartedAt))
  : 0;
return Math.max(0, recordedDurationMs) + live;
```

- [ ] Keep absolute start formatting separate and render it through `<time dateTime>`.
- [ ] Run the focused test and commit `[APP-288] 회의 상태와 누적 시간 표시 추가`.

### Task 3: Create notes without auto-recording

**Files:**
- Modify: `lib/workspace/use-create-meeting.ts`
- Test: `lib/workspace/use-create-meeting.test.ts`
- Modify: `components/workspace/workspace-toolbar.tsx`
- Test: `components/workspace/workspace-toolbar.test.tsx`

**Interfaces:**
- Produces: create → optimistic NOT_STARTED list item → full note route.
- Consumes: generated create-note mutation and router.

- [ ] Write tests proving no `recording.start`, no microphone request, and full route navigation.
- [ ] Remove recording-state branching and auto-start from the existing hook.
- [ ] Keep one `새 노트` entry point and commit `[APP-288] 새 노트 자동 녹음 제거`.

### Task 4: Recording lifecycle reconciliation

**Files:**
- Modify: `components/transcription/recording-provider.tsx`
- Test: `components/transcription/recording-provider.test.tsx`
- Modify: `components/notes/note-realtime-provider.tsx`
- Test: `components/notes/note-realtime-provider.test.tsx`

**Interfaces:**
- Produces: `stop(): Promise<boolean>` and note/list/transcript invalidation after start/terminal.
- Consumes: existing socket terminal reconciliation and note-topic messages.

- [ ] Test start/stop invalidation, stop dedupe, terminal timeout/failure, and stale-event invalidate-only behavior.
- [ ] Return false unless terminal session reconciliation succeeds; callers must not end after false.
- [ ] Invalidate exact note and affected lists after start/stop; never write event payload state into cache.
- [ ] Commit `[APP-288] 녹음 전이 후 서버 상태 재동기화`.

### Task 5: One recording surface and end orchestration

**Files:**
- Modify: `components/notes/meeting-controls.tsx`
- Test: `components/notes/meeting-controls.test.tsx`
- Modify: `components/notes/meeting-end-dialog.tsx`
- Test: `components/notes/meeting-end-dialog.test.tsx`
- Modify: `components/transcription/recording-dock.tsx`
- Test: `components/transcription/recording-dock.test.tsx`
- Modify: `components/notes/note-panel.tsx`
- Test: `components/notes/note-panel.test.tsx`

**Interfaces:**
- Produces: one floating start/stop/resume surface plus status/end/summary selected by server state and role.
- Consumes: Task 4 `stop(): Promise<boolean>`.

- [ ] Test the matrix in full and side: NOT_STARTED/member start; IN_PROGRESS/local starter floating
  stop+end; remote starter visible explanation rather than false start; viewer no dock; PAUSED starter
  floating resume+end; ENDED no dock+summary.
- [ ] Remove the `view === "full"` gate in `NotePanel.showDock`; drive visibility and copy from server
  status, starter role, and whether the local provider owns this note.
- [ ] Render lifecycle and window control groups separately with accessible names and 44px hit areas.
- [ ] Test one-confirmation `await stop → end`, false stop preventing end, PAUSED direct end, and already-ended convergence.
- [ ] Cancel stale PAUSED refetch before optimistic ENDED update to prevent final-state regression.
- [ ] Commit `[APP-288] 회의 시작 중지 재개 종료 제어 통합`.

### Task 6: Apply state and time across list, full, side, and chat

**Files:**
- Modify and test: `components/workspace/note-list-row.tsx`
- Modify and test: `components/workspace/workspace-note-list.tsx`
- Modify and test: `components/notes/note-panel.tsx`
- Modify and test: `components/notes/note-view.tsx`
- Modify and test: `components/notes/shared-chat-panel.tsx`
- Modify: `components/notes/transcript-view.tsx`
- Test: `components/notes/transcript-view.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: identical status/time semantics on all surfaces.

- [ ] Test list copy: 시작 전, 기록 중, 중지됨, 종료됨; remove every `now - meetingStartedAt`.
- [ ] Test full/side absolute first start and cumulative timer freeze/continuation.
- [ ] Test the full partial row with one-line `실시간 · 확정 전`,
  `max-content minmax(0, 1fr)` columns, long Korean wrapping, and stable partial→final width.
- [ ] Keep PAUSED chat history readable but composer locked; only IN_PROGRESS sends.
- [ ] Announce state changes once via polite live text; do not announce the ticking timer.
- [ ] Commit `[APP-288] 노트 화면 상태와 시간 정합화`.

### Task 7: Local visual round-trip and end-to-end scenarios

**Files:**
- Modify: `docs/design-decisions.md`
- Test: `e2e/smoke.spec.ts` or one focused APP-288 spec.
- Pencil only: `/Users/kms/Desktop/heymoa/mvp.pen`

**Interfaces:**
- Produces: final Pencil frame IDs and tested browser flows.
- Consumes: completed web UI.

- [ ] Run local MSW and test create-only, start/end, start/stop/end, and repeated stop/resume/stop.
- [ ] Import list/full/side/end-dialog final DOMs through Pencil `import-to-canvas`; returned IDs are the latest screen keys.
- [ ] Compare hierarchy, responsive layout, keyboard flow, status text, absolute time, and cumulative time.
- [ ] Record the final IDs in `docs/design-decisions.md`.
- [ ] Run:

```bash
rtk pnpm test:run
rtk pnpm lint
rtk pnpm typecheck
rtk pnpm build
rtk pnpm test:e2e
```

- [ ] Commit `[APP-288] 회의 생명주기 화면과 Pencil 키 확정`.
