# Restore Meeting Surfaces Design

## Goal

Restore the project note list, note detail surface, and recording controls to the visual structure that existed immediately before commit `fba2d3f`, while retaining the current OpenAPI- and AsyncAPI-backed behavior.

This is a visual and interaction-shell restoration, not a rollback of generated API clients, realtime protocol types, transcript state, or recording lifecycle logic.

## Constraints

- Keep all REST requests on the current Orval-generated hooks.
- Keep the current AsyncAPI protocol: `connected`, `partial`, `final`, `completed`, and `error` server events plus `commit` and `stop` client commands.
- Keep automatic transcript finalization. The server finalizes after detected silence, forces a commit after 15 seconds of buffered audio, and drains pending audio when recording stops.
- Keep the internal `commit` capability for protocol compatibility, but do not expose it as a user-facing control.
- Do not restore pause or resume because those operations are absent from the current AsyncAPI contract.
- Preserve the active-session guard that prevents creating a second recording while one is running.
- Continue using the current `--el-*` design tokens and current generated models.

## Chosen Approach

Rebuild the historical presentation on top of the current component data and recording context.

Checking out the old components wholesale would also restore obsolete session statuses, pause/resume calls, and outdated query ownership. Merely approximating the old look with the current wide split layout would be safer but would not restore the requested interaction model. A selective presentation restoration provides the closest visual match without regressing contract synchronization.

## Project Note List

The project note list returns to a compact editorial row rather than a bordered card-like row.

Each note row contains:

- a left rail with a waveform icon and placeholder duration for saved notes;
- a live waveform and elapsed recording time for the actively recorded note;
- the note title as the primary label;
- a project badge and concise recording status as secondary metadata;
- the update time and project name aligned to the right on wider screens;
- the existing overflow menu and links to side and full note views.

The list remains grouped by update date. Hover treatment uses a subtle surface tint without a persistent border or shadow. Current page-level fetching stays in `WorkspacePage`, including selected-project and all-project aggregation. The list does not take ownership of API calls again.

The current create-meeting behavior remains intact: when idle it creates and starts a fresh meeting note; when a session is active it opens the current recording instead of creating another session.

## Note Detail Surface

The desktop side sheet returns from 1080 px to the historical 780 px maximum width. Mobile continues to use the full-height drawer, and explicit full view continues to occupy the workspace content area.

Inside the note panel, both desktop and mobile use the same tabbed information architecture:

- `원본 전사` displays the persisted and live transcript;
- `노트 정보` displays editable note metadata.

The permanent desktop transcript/details two-column split is removed. This restores focus and avoids compressing the content inside the narrower sheet. Existing URL tab state remains authoritative so opening, refreshing, and switching surfaces preserve the selected tab.

## Recording Controls

The recording UI returns to the historical compact floating pill language:

- microphone status label;
- live input waveform;
- elapsed time;
- a single destructive stop control.

The note-local control, workspace-level floating control, and global recording indicator use the same control hierarchy. The `구간 확정` control is removed from every visible surface. Pause/resume controls are not restored.

Starting a recording remains available from the existing meeting CTA and note-local idle control. During permission and connection phases, controls communicate that recording is connecting. During recording they show the live waveform and timer. During stopping, the stop control is disabled and the status changes to a finishing label. Errors remain visible through the existing recording error surfaces.

The provider and socket retain their internal `commit()` methods because the protocol supports manual flushing, but no product UI calls them. Automatic silence finalization, the 15-second server safeguard, and stop draining provide the normal user flow.

## Component Boundaries

- `WorkspacePage` owns note/project queries, meeting creation, and active-session navigation.
- `WorkspaceNoteList` owns list loading, error, empty, and date-group presentation.
- `NoteListRow` owns historical row metadata and active waveform presentation.
- `NoteRouteSurface` owns sheet, drawer, and full-view geometry.
- `NotePanel` owns tab navigation and note-local recording controls.
- `WorkspaceToolbar` owns workspace context actions and the cross-note recording pill.
- `GlobalRecordingIndicator` owns the persistent recording pill outside the active workspace surface.
- `RecordingProvider` remains the lifecycle and protocol adapter and is not visually coupled to these components.

## Data and State Flow

Components read `session`, `phase`, `elapsedMs`, `levelHistory`, `error`, `start`, and `stop` from `RecordingProvider`. Presentation derives active and transitional states from the current `RecordingPhase` values rather than the obsolete server status values.

Transcript data continues to merge persisted Orval query results with live `partial` and `final` events. No changes are made to ordering, deduplication, invalidation, audio capture, WebSocket validation, or session persistence.

## Error Handling

- Permission, session creation, socket, and upstream errors continue to populate the provider error state.
- Recording controls remain disabled when their action is not valid for the current phase.
- A meeting CTA cannot create another note while a session is requesting permission, connecting, recording, or stopping.
- Stopping continues to drain pending transcript output before closing, with the existing bounded timeout.

## Testing

Update focused component tests before production changes:

- note rows show historical metadata and live waveform state;
- the side sheet uses the restored maximum width;
- note details use tabs on desktop as well as mobile;
- recording surfaces expose stop but not commit or pause/resume controls;
- transitional recording states disable invalid actions;
- active-session navigation still prevents duplicate meeting creation.

Run the complete Vitest suite, ESLint, and the production Next.js build. Existing generated API output and realtime protocol behavior must remain unchanged.

## Out of Scope

- Changing OpenAPI or AsyncAPI contracts;
- regenerating Orval clients without a contract change;
- adding pause/resume support;
- changing automatic transcript segmentation thresholds;
- redesigning note editing, workspace navigation, or authentication;
- restoring obsolete API ownership inside presentation components.
