# Restore Meeting Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the compact project note list, 780 px tabbed note side sheet, and historical floating recording controls while preserving current API and realtime behavior.

**Architecture:** Keep query ownership in `WorkspacePage` and lifecycle ownership in `RecordingProvider`; only change presentation props and component composition. Reintroduce the historical list metadata and tabbed panel using current generated models and `RecordingPhase`, and remove visible manual commit controls without removing protocol support.

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript, Tailwind CSS, TanStack Query, Orval, Motion, Vitest, Testing Library.

## Global Constraints

- Keep all REST requests on current Orval-generated hooks.
- Do not edit `lib/api/generated/`.
- Keep the current AsyncAPI protocol and internal `commit()` capability.
- Do not expose commit, pause, or resume controls in the UI.
- Keep automatic silence/15-second/stop-drain transcript finalization.
- Preserve the active-session duplicate-meeting guard already present in the working tree.
- Use only `--el-*` design tokens for new styling.
- Run commands with the required `rtk` prefix.

---

### Task 1: Restore Compact Project Note Rows

**Files:**
- Create: `components/workspace/note-list-row.test.tsx`
- Modify: `components/workspace/note-list-row.tsx`
- Modify: `components/workspace/workspace-note-list.tsx`
- Modify: `components/workspace/workspace-page.tsx`
- Modify: `components/workspace/workspace-page.test.tsx`

**Interfaces:**
- Consumes: `RecordingContextValue.session`, `phase`, `elapsedMs`, and `levelHistory`; the current project list already loaded by `WorkspacePage`.
- Produces: `WorkspaceNoteList` prop `projectNames: Record<string, string>` and `NoteListRow` prop `projectName?: string`.

- [ ] **Step 1: Write the failing row presentation test**

Create a test that mocks `useRecording()` with an active session, renders `NoteListRow` with `projectName="모바일 앱"`, and asserts:

```tsx
expect(screen.getByText("모바일 앱")).toBeInTheDocument();
expect(screen.getByText("00:12")).toBeInTheDocument();
expect(screen.getByRole("meter", { name: "주간 제품 회의 마이크 입력" }))
  .toBeInTheDocument();
expect(screen.getByText("기록 중")).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk pnpm test:run components/workspace/note-list-row.test.tsx`

Expected: FAIL because `projectName` and the historical waveform/duration rail are not rendered.

- [ ] **Step 3: Implement the historical row with current state**

Update the row signature and derive active state from current phases:

```tsx
export function NoteListRow({
  workspaceId,
  note,
  projectName,
}: {
  workspaceId: string;
  note: NoteListResponseDataNotesItem;
  projectName?: string;
}) {
  const { session, phase, elapsedMs, levelHistory } = useRecording();
  const isRecording =
    session?.noteId === note.noteId &&
    ["requesting-permission", "connecting", "recording", "stopping"].includes(phase);
```

Render a left waveform/duration rail, title and badge/status metadata, and right-aligned time/project metadata. Restore the subtle `rounded-xl ... hover:bg-white/70` row treatment and keep the existing links and menu.

Build `projectNames` in `WorkspacePage` without new requests and pass it through:

```tsx
const projectNames = Object.fromEntries(
  projects.map((project) => [project.projectId, project.name])
);

<WorkspaceNoteList projectNames={projectNames} ... />
```

`WorkspaceNoteList` passes `projectNames[note.projectId]` to every row. Retain its current loading/error/empty props and active-session CTA behavior.

- [ ] **Step 4: Run focused workspace tests and verify GREEN**

Run: `rtk pnpm test:run components/workspace/note-list-row.test.tsx components/workspace/workspace-note-list.test.tsx components/workspace/workspace-page.test.tsx`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the list restoration**

```bash
rtk git add components/workspace/note-list-row.tsx components/workspace/note-list-row.test.tsx components/workspace/workspace-note-list.tsx components/workspace/workspace-page.tsx components/workspace/workspace-page.test.tsx
rtk git commit -m "feat(ui): restore compact project note rows"
```

### Task 2: Restore the Narrow Tabbed Note Surface

**Files:**
- Modify: `components/notes/note-route-surface.tsx`
- Modify: `components/notes/note-panel.tsx`
- Modify: `components/notes/note-panel.test.tsx`

**Interfaces:**
- Consumes: controlled `NoteTab`, `onTabChange`, current `TranscriptView`, `NoteDetails`, and `RecordingContextValue`.
- Produces: a 780 px desktop sheet and a tabbed panel shared by desktop and mobile.

- [ ] **Step 1: Write failing tab and control assertions**

Change the panel test to click `노트 정보` and assert controlled tab behavior. Add assertions that both tab names exist on desktop-independent rendering and that visible recording controls contain stop but not commit/pause:

```tsx
expect(screen.getByRole("tab", { name: "원본 전사" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("tab", { name: "노트 정보" }));
expect(onTabChange).toHaveBeenCalledWith("details");
expect(screen.queryByRole("button", { name: "구간 확정" })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: /일시 정지|재개/ })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the panel test and verify RED**

Run: `rtk pnpm test:run components/notes/note-panel.test.tsx`

Expected: FAIL because the current desktop composition does not expose the tabbed information architecture and still renders commit while active.

- [ ] **Step 3: Implement the restored surface**

Set desktop side sheet geometry in `NoteRouteSurface`:

```tsx
style={{
  width: "min(780px, calc(100vw - 16rem))",
  maxWidth: "780px",
}}
```

Remove the desktop media-query split from `NotePanel` and render one controlled tab tree for every viewport:

```tsx
<Tabs value={tab} onValueChange={(value) => value && onTabChange(value as NoteTab)}>
  <TabsList variant="line">
    <TabsTrigger value="transcript">원본 전사</TabsTrigger>
    <TabsTrigger value="details">노트 정보</TabsTrigger>
  </TabsList>
  <TabsContent value="transcript"><TranscriptView noteId={noteId} /></TabsContent>
  <TabsContent value="details"><NoteDetails noteId={noteId} /></TabsContent>
</Tabs>
```

Keep the historical bottom floating pill geometry, live five-bar waveform, timer, and start/stop behavior. Remove the visible commit button and its `Scissors` import. Do not alter provider methods.

- [ ] **Step 4: Run note tests and verify GREEN**

Run: `rtk pnpm test:run components/notes/note-panel.test.tsx`

Expected: all available focused note tests PASS.

- [ ] **Step 5: Commit the note surface restoration**

```bash
rtk git add components/notes/note-route-surface.tsx components/notes/note-panel.tsx components/notes/note-panel.test.tsx
rtk git commit -m "feat(ui): restore tabbed note side sheet"
```

### Task 3: Simplify Workspace and Global Recording Pills

**Files:**
- Modify: `components/workspace/workspace-toolbar.tsx`
- Modify: `components/workspace/workspace-toolbar.test.tsx`
- Modify: `components/transcription/global-recording-indicator.tsx`
- Modify: `components/transcription/global-recording-indicator.test.tsx`

**Interfaces:**
- Consumes: current recording `phase`, `session`, `elapsedMs`, `level`, `levelHistory`, `error`, and `stop()`.
- Produces: consistent status/waveform/time/stop pills with no manual segmentation controls.

- [ ] **Step 1: Write failing control-surface tests**

Replace commit expectations in both tests with absence assertions and retain stop behavior:

```tsx
expect(screen.queryByRole("button", { name: "구간 확정" })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: /일시 정지|재개/ })).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "녹음 종료" }));
expect(recording.stop).toHaveBeenCalledOnce();
```

Continue asserting the accessible microphone meter, elapsed time, and `녹음 중` status.

- [ ] **Step 2: Run focused recording UI tests and verify RED**

Run: `rtk pnpm test:run components/workspace/workspace-toolbar.test.tsx components/transcription/global-recording-indicator.test.tsx`

Expected: FAIL because both current surfaces expose `구간 확정`.

- [ ] **Step 3: Remove visible commit controls and restore the pill hierarchy**

Remove `Scissors` imports, `commit` destructuring, and commit buttons from both components. Keep their historical floating white pill, status, accessible waveform, elapsed timer, current-recording navigation, and destructive stop icon. Keep phase-specific labels:

```tsx
const stateLabel =
  phase === "requesting-permission" || phase === "connecting"
    ? "연결 중"
    : phase === "recording"
      ? "녹음 중"
      : phase === "stopping"
        ? "마무리 중"
        : "연결 오류";
```

Disable stop while `stopping` or `failed`. Do not remove `commit` from `RecordingProvider`, `TranscriptionSocket`, or protocol types.

- [ ] **Step 4: Run focused recording tests and verify GREEN**

Run: `rtk pnpm test:run components/workspace/workspace-toolbar.test.tsx components/transcription/global-recording-indicator.test.tsx components/transcription/recording-provider.test.tsx`

Expected: all focused tests PASS and provider protocol coverage remains intact.

- [ ] **Step 5: Commit the recording UI simplification**

```bash
rtk git add components/workspace/workspace-toolbar.tsx components/workspace/workspace-toolbar.test.tsx components/transcription/global-recording-indicator.tsx components/transcription/global-recording-indicator.test.tsx
rtk git commit -m "feat(ui): simplify automatic recording controls"
```

### Task 4: Verify the Integrated Restoration

**Files:**
- Verify only; modify a scoped file only if verification exposes a regression caused by Tasks 1-3.

**Interfaces:**
- Consumes: all outputs from Tasks 1-3.
- Produces: verified UI restoration with unchanged generated clients and realtime protocol.

- [ ] **Step 1: Verify no stale visible controls remain**

Run:

```bash
rtk rg -n "구간 확정|일시 정지|재개" components --glob '*.{ts,tsx}'
```

Expected: no production-component matches; negative test assertions may match.

- [ ] **Step 2: Run the complete test suite**

Run: `rtk pnpm test:run`

Expected: all test files and tests PASS.

- [ ] **Step 3: Verify generated clients remain untouched**

Run: `rtk git diff --exit-code -- lib/api/generated`

Expected: exit code 0 with no output.

- [ ] **Step 4: Run required lint and build verification**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: ESLint exits 0 (known unrelated warnings may remain) and Next.js production build exits 0.

- [ ] **Step 5: Check final patch hygiene**

Run: `rtk git diff --check && rtk git status --short --branch`

Expected: no whitespace errors; only intentional task files are changed or the working tree is clean after task commits.
