# Task 5 report — One recording surface and end orchestration

## Implemented

- Made `RecordingDock` the single 44px start/stop/resume surface in both full and side views.
- Selected dock visibility and copy from server meeting status, starter role, and local provider ownership; remote `IN_PROGRESS` starters now see an explanation instead of a false start.
- Moved server status, cumulative recording time, final end, and ended-summary navigation into one accessible `MeetingControls` group; full and side window controls are separate accessible groups.
- Changed meeting end to one confirmation: local `IN_PROGRESS` awaits `stop()` and ends only after `true`, `PAUSED` ends directly, and `MEETING_ALREADY_ENDED` converges as success.
- Awaited exact-note query cancellation before the optimistic `ENDED` cache update so a stale `PAUSED` response cannot regress final state.
- Removed stale v5 dock comments and updated the three outdated NotePanel fixtures.

## TDD evidence

- RED: 22 initial focused failures covered the full/side lifecycle matrix, dock labels and 44px targets, top status/time/summary, and five end-orchestration cases; later RED checks caught two sessionless ownership cases plus two remaining 44px/grouping gaps.
- GREEN: `rtk pnpm test:run components/notes/meeting-controls.test.tsx components/notes/meeting-end-dialog.test.tsx components/transcription/recording-dock.test.tsx components/notes/note-panel.test.tsx` — 78 passed.

## Verification

- Task 5 plus related provider/realtime/note-view/toolbar callers: 127 passed.
- `rtk pnpm typecheck` — passed.
- `rtk pnpm lint` — passed.
- `rtk git diff --check` — passed.
- Full Vitest: 603 passed, 8 failed outside Task 5.

## Remaining full-suite concerns

- `lib/mocks/nullable-coverage.test.ts`: detail/list mocks still lack non-null `activeSessionStartedAt` samples.
- `lib/mocks/sse-handler.test.ts`: seven shared-chat fixtures still seed meetings outside `IN_PROGRESS`, so the new server-authoritative gate returns `MEETING_NOT_ACTIVE`.

## Review fix round 1

- Distinguished a locally controllable provider from a server session that merely remains active: `failed + ACTIVE` now shows the remote/stale recording explanation instead of a dead retry.
- Preserved retry for sessionless permission failures in both `NOT_STARTED` and `PAUSED`.
- RED: the full/side `failed + ACTIVE` cases failed while the four sessionless retry guards passed.
- GREEN: focused NotePanel matrix 53 passed; Task 5 plus provider/realtime/note-view/toolbar callers 133 passed.
- `rtk pnpm typecheck`, `rtk pnpm lint`, and `rtk git diff --check` passed.
