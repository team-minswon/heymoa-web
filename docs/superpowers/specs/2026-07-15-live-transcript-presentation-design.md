# Live Transcript Presentation Design

## Goal

Make an active note read like a continuous transcript: durable final segments remain prominent, while the current partial appears as a subdued live line and new transcript content stays in view.

## Interaction

- Final segments keep their timestamp and use the primary ink color.
- The current partial is rendered directly after the final list in muted text, without a separate card or status badge.
- A final event replaces its matching partial through the existing transcript reducer; no API or protocol change is needed.
- When a final segment or live partial changes, the transcript scroll container moves its last item into view with smooth scrolling.
- The global recording indicator keeps its entering behavior and uses a two-times-longer exit transition.

## Verification

- Unit tests assert final/partial visual state and auto-scroll behavior.
- The global indicator test asserts its exit transition duration.
- Run the affected tests, then `pnpm lint && pnpm build`.
