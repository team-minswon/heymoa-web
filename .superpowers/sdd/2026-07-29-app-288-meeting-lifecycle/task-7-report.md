# Task 7 report — Browser lifecycle scenarios and design handoff

## Implemented

- Replaced the stale APP-218 browser expectation with APP-288 server-state flows through browser MSW.
- Added create-only `NOT_STARTED` coverage proving `00:00`, a visible `회의 시작` dock, and zero microphone requests.
- Added start→end, start→stop→end, and start→stop→resume→stop coverage with cumulative-time freeze and continuation checks.
- Covered side `NOT_STARTED`, remote active-session explanation, updated four-state copy, and the ended summary transition.
- Added Chromium fake-media launch flags so microphone flows are deterministic without local hardware or permission prompts.
- Recovered a clean WebSocket close with reason `completed` when it races ahead of the terminal frame; the provider now receives the missing completed event and one-confirmation stop→end proceeds.
- Updated current design decisions for APP-288. The Pencil handoff now records the actual list/full/side/end-dialog frame IDs returned by the canvas round trip.

## TDD evidence

- RED: the old APP-218 E2E failed on its removed `기록 시작` expectation.
- RED: the new one-confirmation E2E consistently exposed a clean-close race (`completed` arrived as a close reason before the terminal event).
- RED: the focused realtime-session test failed because the clean close was reported through `onFailure`.
- GREEN: the focused runtime suite passed 13/13 and the APP-288 browser matrix passed 6/6.

## Verification

- Full Vitest: 79 files, 633 tests passed.
- Full Playwright browser-MSW suite: 25 tests passed.
- `rtk pnpm lint` — passed.
- `rtk pnpm typecheck` — passed.
- `rtk pnpm build` — passed with existing Next.js workspace-root, edge static-generation, and `metadataBase` warnings.
- `rtk git diff --check` — passed.

## Remaining concern

- Partial-row width and Korean wrapping remain in the deterministic `transcript-view.test.tsx` DOM contract; fake microphone content is not stable enough to make that a useful E2E assertion.
