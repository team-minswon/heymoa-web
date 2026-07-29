# Task 6 report — State and time across list, detail, transcript, and chat

## Implemented

- Unified list rows on the four server labels (`시작 전`, `기록 중`, `중지됨`, `종료됨`) and cumulative active-only duration from `getRecordedDurationMs`.
- Removed the obsolete `now - meetingStartedAt` helpers and aligned the shared list clock to `activeSessionStartedAt`.
- Added the absolute first start to full and side metadata through `<time dateTime>`, while keeping the cumulative timer frozen in `PAUSED`/`ENDED` and ticking only from an active session.
- Kept one polite meeting-state live region and removed live semantics from the ticking timer and the visible end guidance.
- Made the partial transcript row stack responsively, keep `실시간 · 확정 전` on one line, wrap Korean by words, and reserve the same first-column width as final rows.
- Kept shared-chat history reachable in `PAUSED`, hid the competing personal-chat rail, and replaced the composer with locked paused/ended notices. Sending remains restricted to `IN_PROGRESS`.
- Repaired the nullable list/detail `activeSessionStartedAt` samples and the seven shared-chat SSE active fixtures left by Task 5.

## TDD evidence

- RED: 18 focused failures covered four-state list copy, active-only duration, full/side absolute start, paused chat, the state announcer, the non-live timer, and partial-row layout.
- RED: the two known full-suite fixture files reproduced 8 failures (2 nullable sample gaps and 7 shared-chat lifecycle cases).
- RED: follow-up checks caught the paused shared-chat/personal-chat rail collision and the duplicate end-state live announcement.
- GREEN: Task 6 surfaces plus meeting helper and fixture coverage passed 179 tests.

## Verification

- Full Vitest: 79 files, 630 tests passed.
- `rtk pnpm typecheck` — passed.
- `rtk pnpm lint` — passed.
- `rtk pnpm build` — passed.
- `rtk git diff --check` — passed.

## Remaining concern

- Repository-wide `pnpm format:check` still reports pre-existing formatting debt outside Task 6; Task 6 changed files are formatted.

## Aggressive review fix round 1

- Restored the cumulative time's accessible name with a named `timer` role while keeping its implicit live setting off.
- Removed the partial row's unmatched horizontal padding so partial and final columns keep the same x-position and body width.
- Let narrow list metadata yield, hid starter/duration detail below `sm`, and reserved a readable title minimum while keeping the state label visible.
- Stacked the side title above wrapping status/window-control groups below `sm`; lifecycle and window buttons remain 44px.
- RED: 7 focused failures covered the timer role, transcript padding parity, narrow list priority, and narrow side-header hierarchy.
- GREEN: Task 6 focused coverage passed 181 tests; full Vitest passed 632 tests.
- `rtk pnpm typecheck`, `rtk pnpm lint`, and `rtk pnpm build` passed.
