# Live Transcript Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present final and live transcription as a compact, self-following transcript and slow only the global recording indicator exit.

**Architecture:** Keep the existing reducer and AsyncAPI event contract intact. `TranscriptView` owns a trailing DOM anchor and scrolls it after final or partial content changes; the global indicator uses Motion presence animation with a longer exit duration.

**Tech Stack:** Next.js 16 client components, React, Motion, Vitest, Testing Library.

## Global Constraints

- Do not edit `lib/api/generated/`.
- Preserve the existing partial-to-final reducer behavior and generated Orval hooks.
- Use existing `--el-*` design tokens.

---

### Task 1: Present and follow live transcript content

**Files:**
- Modify: `components/notes/transcript-view.tsx`
- Modify: `components/notes/transcript-view.test.tsx`

**Interfaces:**
- Consumes: `useRecording().transcript.finalSegments` and `partialByUtteranceId`.
- Produces: final rows marked `data-state="final"`, partial rows marked `data-state="partial"`, and a trailing scroll anchor.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByText("결과를 정리합니다")).toHaveClass("text-[var(--el-muted)]");
expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run components/notes/transcript-view.test.tsx`

Expected: FAIL because the partial uses the old card treatment and no trailing anchor scrolls.

- [ ] **Step 3: Write minimal implementation**

```tsx
const transcriptEndRef = useRef<HTMLDivElement>(null);
const liveContentKey = `${orderedSegments.at(-1)?.segmentId ?? ""}:${Object.values(recording.transcript.partialByUtteranceId).join("\\u0000")}`;

useEffect(() => {
  transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
}, [liveContentKey]);
```

Render partial text as an unbordered muted transcript row and append `<div ref={transcriptEndRef} />` after the list.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run components/notes/transcript-view.test.tsx`

Expected: PASS.

### Task 2: Slow the global recording indicator exit

**Files:**
- Modify: `components/transcription/global-recording-indicator.tsx`
- Modify: `components/transcription/global-recording-indicator.test.tsx`

**Interfaces:**
- Consumes: existing recording session state.
- Produces: the same indicator with a 0.3-second exit transition.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByLabelText("진행 중인 녹음")).toHaveAttribute("data-motion-exit-duration", "0.3");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run components/transcription/global-recording-indicator.test.tsx`

Expected: FAIL because the indicator has no Motion presence exit configuration.

- [ ] **Step 3: Write minimal implementation**

Wrap the conditional indicator in `AnimatePresence` and make the rendered `motion.aside` use `exit={{ opacity: 0, y: -8, transition: { duration: 0.3 } }}` while leaving the initial/animate duration at `0.15` seconds.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run components/transcription/global-recording-indicator.test.tsx`

Expected: PASS.

### Task 3: Verify the combined change

**Files:**
- Modify: both implementation and test files above.

- [ ] **Step 1: Run focused tests**

Run: `pnpm test:run components/notes/transcript-view.test.tsx components/transcription/global-recording-indicator.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run required validation**

Run: `pnpm lint && pnpm build`

Expected: lint exits successfully (existing warnings allowed) and Next production build succeeds.
