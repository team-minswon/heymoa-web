# Single Recording Session Design

## Goal

Prevent a second note from attempting to start transcription while another note has an active or stopping session.

## Behavior

- `stopping` means the user requested recording to end and the client is waiting for final transcript persistence plus a `completed` event; it is not pause.
- The floating cross-note control remains visible through `stopping` so the user can return to the owning note while completion is pending.
- A note panel that does not own the active session renders a disabled start control with an explicit accessible label instead of calling `RecordingProvider.start`.
- `RecordingProvider.start` keeps its `ACTIVE_TRANSCRIPTION_SESSION` guard as a defense against future UI paths.

## Verification

- Test that an active session for another note disables the detail start control and never calls the session API.
- Run the note-panel and recording-provider tests, then `pnpm lint && pnpm build`.
