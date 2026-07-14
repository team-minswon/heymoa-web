# Single Recording Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block start attempts from note detail whenever a different note owns an active transcription session.

**Architecture:** Derive an active-session boolean from the existing recording phase inside `NotePanel`. Use it to keep the current note's controls intact and render a disabled, labelled start button for all other notes; leave provider enforcement unchanged.

**Tech Stack:** Next.js 16 client components, React, Vitest, Testing Library.

## Global Constraints

- Do not edit `lib/api/generated/`.
- Keep `ACTIVE_TRANSCRIPTION_SESSION` as provider-level protection.
- Treat `requesting-permission`, `connecting`, `recording`, and `stopping` as one active session.

---

### Task 1: Disable cross-note starts from note detail

**Files:**
- Modify: `components/notes/note-panel.tsx`
- Modify: `components/notes/note-panel.test.tsx`

**Interfaces:**
- Consumes: `useRecording().session`, `phase`, and `start`.
- Produces: a disabled `다른 노트에서 녹음 중` control when a different note owns an active session.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByRole("button", { name: "다른 노트에서 녹음 중" })).toBeDisabled();
fireEvent.click(screen.getByRole("button", { name: "다른 노트에서 녹음 중" }));
expect(startSession).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run components/notes/note-panel.test.tsx`

Expected: FAIL because the existing panel renders an enabled `기록 시작` button for a different active note.

- [ ] **Step 3: Write minimal implementation**

```tsx
const hasActiveSession = ["requesting-permission", "connecting", "recording", "stopping"].includes(recording.phase);
const isOtherNoteRecording = hasActiveSession && !isThisNoteRecording;

<button disabled={isOtherNoteRecording} aria-label={isOtherNoteRecording ? "다른 노트에서 녹음 중" : "기록 시작"} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run components/notes/note-panel.test.tsx`

Expected: PASS.

### Task 2: Verify session safety

**Files:**
- Modify: `components/notes/note-panel.tsx`
- Modify: `components/notes/note-panel.test.tsx`

- [ ] **Step 1: Run focused regression checks**

Run: `pnpm test:run components/notes/note-panel.test.tsx components/transcription/recording-provider.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run required validation**

Run: `pnpm lint && pnpm build`

Expected: lint exits successfully with only existing warnings and production build succeeds.
