# HeyMoa Meeting Notes Mock MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the REST and WebSocket contracts, generate the Orval client, and build a mock-backed Next.js meeting-note flow that exercises notes, folders, and one global real-time transcription session without a Spring server.

**Architecture:** `openapi3.yml` remains the REST source of truth and generates TanStack Query, MSW, and Faker artifacts through Orval. `asyncapi.yml` is the raw WebSocket source of truth; focused handwritten TypeScript adapters implement native WebSocket, AudioWorklet PCM capture, transcript reduction, and an MSW `ws.link()` state machine. A root RecordingProvider owns the connection across route changes, while `/w/[workspaceId]/notes/[noteId]` uses query parameters for side/full and details/transcript state.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, TanStack Query 5.101, Orval 8.16, OpenAPI 3.0.3, AsyncAPI 3.1, MSW 2.14, Faker 10.5, Zod 4.4, Vitest, Testing Library

## Global Constraints

- Work only in `heymoa-web`; Spring Kotlin and OpenAI server integration are out of scope.
- Read `AGENTS.md` and the relevant Next.js 16 docs under `node_modules/next/dist/docs/` before editing Next.js routes or providers.
- Keep `openapi3.yml` as the REST source of truth; never hand-edit `lib/api/generated/`.
- Run `pnpm orval` immediately after every OpenAPI change.
- Use only Orval-generated hooks/functions for REST calls; do not add direct REST `fetch()` calls.
- Keep `asyncapi.yml` as the WebSocket source of truth; Orval does not process it.
- Use native WebSocket and raw binary PCM frames, not STOMP, SockJS, or Base64 audio JSON.
- Every entity PK and public resource ID is a 13-character TSID string.
- Every server timestamp is an RFC 3339 `date-time` representing Kotlin `Instant`.
- All notes are visible to their workspace; no roles, member management, or private/team visibility.
- A note can belong to zero or more folders; folders have no hierarchy, color, or access semantics.
- A user can have at most one active TranscriptionSession across tabs and devices.
- Pause/resume stays in one Session; stop or unrecoverable interruption ends it.
- Partial transcript snapshots are ephemeral; only Final TranscriptSegments are persisted in mock state.
- TranscriptSegments can be deleted but not edited.
- Every manually registered REST mock must return an explicit `success: true` response on success.
- Seed Faker so fixtures do not change across reloads.
- Follow the existing ElevenLabs editorial design rules in `DESIGN.md` and `AGENTS.md`.
- Verify each task before committing; final verification is `pnpm test:run && pnpm asyncapi:validate && pnpm orval && pnpm lint && pnpm build`.

---

## File Structure

### Contract and generated boundary

- Modify `openapi3.yml` — all REST paths, schemas, errors, TSID/date contracts.
- Create `asyncapi.yml` — WebSocket server, channel, operations, commands, events, and binary audio message.
- Modify `orval.config.ts` — deterministic mock generation options only.
- Regenerate `lib/api/generated/**` — generated artifacts, never edited manually.

### Test and runtime tooling

- Modify `package.json` and `pnpm-lock.yaml` — Vitest and AsyncAPI validation dependencies/scripts.
- Create `vitest.config.ts` — jsdom, aliases, setup file.
- Create `vitest.setup.ts` — jest-dom and browser API cleanup.

### REST mock runtime

- Create `lib/mocks/db.ts` — seeded in-memory Workspace, Folder, Note, Session, Segment state and mutation helpers.
- Create `lib/mocks/rest-handlers.ts` — explicit Orval handler overrides backed by `db.ts`.
- Modify `lib/mocks/handlers.ts` — combine existing auth, REST domain, and WebSocket handlers.

### WebSocket and transcription runtime

- Create `lib/transcription/protocol.ts` — Zod schemas and exported command/event TypeScript unions.
- Create `lib/transcription/transcript-reducer.ts` — item snapshot replacement and Final upsert.
- Create `lib/transcription/socket.ts` — native WebSocket lifecycle and typed message dispatch.
- Create `lib/transcription/audio.ts` — microphone, AudioWorklet, PCM16, resampling, batching, backpressure.
- Create `public/audio/pcm-capture-worklet.js` — Float32 AudioWorklet source blocks.
- Create `lib/mocks/transcription-scenario.ts` — pure mock Session state machine.
- Create `lib/mocks/websocket-handler.ts` — MSW `ws.link()` adapter.
- Create `components/transcription/recording-provider.tsx` — application-level active recording ownership.
- Create `components/transcription/global-recording-indicator.tsx` — global status and controls.
- Modify `app/providers.tsx` and `app/layout.tsx` — mount provider and indicator outside route content.

### Meeting-note pages

- Create `app/w/[workspaceId]/page.tsx` — workspace route shell.
- Create `app/w/[workspaceId]/notes/[noteId]/page.tsx` — canonical note route shell.
- Create `components/workspace/workspace-page.tsx` — note list, folder filter, create actions, side view background.
- Create `components/notes/note-view.tsx` — query normalization and side/full composition.
- Create `components/notes/note-details.tsx` — title, context, folders.
- Create `components/notes/transcript-view.tsx` — Sessions, Partial snapshots, Final Segments, delete action.

---

### Task 1: Add deterministic contract test tooling

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `lib/api/app-response.test.ts`

**Interfaces:**
- Consumes: existing `unwrapAppResponse<T>()` from `lib/api/app-response.ts`.
- Produces: `pnpm test`, `pnpm test:run`, and `pnpm asyncapi:validate` scripts used by every later task.

- [ ] **Step 1: Install and configure the test/contract tools**

Run:

```bash
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @asyncapi/cli
```

Add scripts:

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "asyncapi:validate": "asyncapi validate asyncapi.yml"
}
```

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Write the first failing response-envelope test**

```ts
import { describe, expect, it } from "vitest";
import { AppResponseError, unwrapAppResponse } from "@/lib/api/app-response";

describe("unwrapAppResponse", () => {
  it("returns successful data", () => {
    expect(unwrapAppResponse({ success: true, data: { id: "01K0000000000" } })).toEqual({
      id: "01K0000000000",
    });
  });

  it("throws the application error code", () => {
    expect(() =>
      unwrapAppResponse({
        success: false,
        error: { code: "NOTE_NOT_FOUND", message: "노트를 찾을 수 없습니다." },
      })
    ).toThrow(AppResponseError);
  });
});
```

- [ ] **Step 3: Run the new test command**

Run: `pnpm test:run lib/api/app-response.test.ts`

Expected: both tests pass. If the Vitest alias or jsdom setup fails, correct only the configuration until this file passes.

- [ ] **Step 4: Commit the tooling foundation**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts lib/api/app-response.test.ts
git commit -m "test: add contract test tooling"
```

### Task 2: Expand OpenAPI for Workspace, Folder, and Note

**Files:**
- Modify: `openapi3.yml`
- Modify: `orval.config.ts`
- Regenerate: `lib/api/generated/**`
- Create: `lib/api/meeting-notes-contract.test.ts`

**Interfaces:**
- Consumes: existing cookie security scheme and `AppErrorBody`/`AppErrorDetail` schemas.
- Produces: `Tsid`, `UserSummary`, `WorkspaceResponse`, `FolderResponse`, `NoteSummaryResponse`, `NoteResponse`, cursor page schemas, request schemas, and generated `workspace`, `folder`, and `note` clients.

- [ ] **Step 1: Write a compile-time contract test before the schemas exist**

```ts
import { describe, expect, it } from "vitest";
import type {
  FolderResponse,
  NoteResponse,
  NoteSummaryResponse,
  WorkspaceResponse,
} from "@/lib/api/generated/models";

describe("meeting-note generated models", () => {
  it("uses TSID strings and RFC 3339 dates", () => {
    const workspace: WorkspaceResponse = {
      workspaceId: "01K0000000000",
      name: "테스트 유저의 워크스페이스",
    };
    const folder: FolderResponse = { folderId: "01K0000000001", name: "제품" };
    const note: NoteResponse = {
      noteId: "01K0000000002",
      workspaceId: workspace.workspaceId,
      title: "주간 회의",
      context: null,
      createdBy: { userId: "01K0000000003", name: "테스트 유저" },
      folders: [folder],
      createdAt: "2026-07-11T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
    };
    const summary: NoteSummaryResponse = {
      ...note,
      lastRecordedAt: null,
      recordedDurationMs: 0,
    };

    expect(summary.noteId).toHaveLength(13);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test:run lib/api/meeting-notes-contract.test.ts`

Expected: TypeScript transform fails because the four generated models do not exist.

- [ ] **Step 3: Add exact Workspace/Folder/Note operations**

Add these operation IDs and paths to `openapi3.yml`:

```yaml
getDefaultWorkspace: GET /v1/workspaces/default
getWorkspace: GET /v1/workspaces/{workspaceId}
listWorkspaceNotes: GET /v1/workspaces/{workspaceId}/notes
createNote: POST /v1/workspaces/{workspaceId}/notes
getNote: GET /v1/notes/{noteId}
updateNote: PUT /v1/notes/{noteId}
deleteNote: DELETE /v1/notes/{noteId}
listWorkspaceFolders: GET /v1/workspaces/{workspaceId}/folders
createFolder: POST /v1/workspaces/{workspaceId}/folders
updateFolder: PUT /v1/folders/{folderId}
deleteFolder: DELETE /v1/folders/{folderId}
attachNoteFolder: PUT /v1/notes/{noteId}/folders/{folderId}
detachNoteFolder: DELETE /v1/notes/{noteId}/folders/{folderId}
```

Define the shared path parameter exactly once per operation using:

```yaml
schema:
  $ref: '#/components/schemas/Tsid'
```

Define `Tsid`, title/context/folder constraints, explicit success wrappers, error responses, and cursor fields exactly as specified in `docs/superpowers/specs/2026-07-11-meeting-notes-contract-design.md`. `CreateNoteRequest.title` is optional; `UpdateNoteRequest.title` is required. Both requests allow nullable `context`. Folder names are 1–50 characters; Note titles are 1–200; context is nullable with maxLength 4000.

- [ ] **Step 4: Make generated mocks deterministic and regenerate**

Replace `mock: true` in `orval.config.ts` with:

```ts
mock: {
  indexMockFiles: true,
  generators: [
    { type: "msw", useExamples: true },
    { type: "faker", useExamples: true, schemas: true },
  ],
},
```

Run: `pnpm orval`

Expected: generation succeeds and creates `workspace`, `folder`, and `note` tag outputs plus the four tested model files.

- [ ] **Step 5: Run GREEN checks**

Run: `pnpm test:run lib/api/meeting-notes-contract.test.ts && pnpm lint`

Expected: the model test and lint pass.

- [ ] **Step 6: Commit the REST resource contract**

```bash
git add openapi3.yml orval.config.ts lib/api/generated lib/api/meeting-notes-contract.test.ts
git commit -m "feat(api): add workspace folder and note contracts"
```

### Task 3: Add transcription REST contracts

**Files:**
- Modify: `openapi3.yml`
- Regenerate: `lib/api/generated/**`
- Create: `lib/api/transcription-contract.test.ts`

**Interfaces:**
- Consumes: Task 2 `Tsid`, `UserSummary`, cursor, and AppResponse schemas.
- Produces: `TranscriptionSessionResponse`, `TranscriptionConnectionResponse`, `ActiveTranscriptionSessionResponse`, `TranscriptSegmentResponse`, generated transcription hooks, and all transcription error codes.

- [ ] **Step 1: Write the failing generated-model test**

```ts
import { describe, expect, it } from "vitest";
import type {
  TranscriptSegmentResponse,
  TranscriptionSessionResponse,
} from "@/lib/api/generated/models";

describe("transcription generated models", () => {
  it("represents one persisted final segment", () => {
    const session: TranscriptionSessionResponse = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "STREAMING",
      language: "ko",
      startedBy: { userId: "01K0000000003", name: "테스트 유저" },
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: null,
    };
    const segment: TranscriptSegmentResponse = {
      segmentId: "01K0000000011",
      sessionId: session.sessionId,
      sequence: 1,
      text: "확정 문장",
      startedAtMs: 0,
      endedAtMs: 1200,
    };
    expect(segment.sessionId).toBe(session.sessionId);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test:run lib/api/transcription-contract.test.ts`

Expected: transform fails because the generated transcription models do not exist.

- [ ] **Step 3: Add exact transcription operations and schemas**

Add these operation IDs and paths:

```yaml
createTranscriptionSession: POST /v1/notes/{noteId}/transcription-sessions
listNoteTranscriptionSessions: GET /v1/notes/{noteId}/transcription-sessions
getTranscriptionSession: GET /v1/transcription-sessions/{sessionId}
getActiveTranscriptionSession: GET /v1/transcription-sessions/active
createTranscriptionConnectionTicket: POST /v1/transcription-sessions/{sessionId}/connection-ticket
listNoteTranscriptSegments: GET /v1/notes/{noteId}/transcript-segments
deleteTranscriptSegment: DELETE /v1/transcript-segments/{segmentId}
```

Use this enum without additional states:

```yaml
TranscriptionSessionStatus:
  type: string
  enum: [CONNECTING, STREAMING, PAUSED, FINALIZING, COMPLETED, INTERRUPTED, FAILED]
```

`CreateTranscriptionSessionRequest.language` is nullable ISO 639-1. The creation and ticket responses contain `session`, `socketUrl`, and `ticketExpiresAt`; the opaque ticket is embedded in `socketUrl`, not duplicated as another field. `ActiveTranscriptionSessionResponse.session` is nullable so “none active” remains HTTP 200.

Add the exact error codes and statuses from the design spec, including 409 `ACTIVE_TRANSCRIPTION_SESSION_EXISTS`, 409 `INVALID_TRANSCRIPTION_SESSION_STATE`, and 503 `STT_PROVIDER_UNAVAILABLE`.

- [ ] **Step 4: Regenerate and verify GREEN**

Run: `pnpm orval && pnpm test:run lib/api/transcription-contract.test.ts && pnpm lint`

Expected: Orval, the generated-model test, and lint all pass.

- [ ] **Step 5: Commit the transcription REST contract**

```bash
git add openapi3.yml lib/api/generated lib/api/transcription-contract.test.ts
git commit -m "feat(api): add transcription rest contracts"
```

### Task 4: Build a stateful REST mock store

**Files:**
- Create: `lib/mocks/db.ts`
- Create: `lib/mocks/db.test.ts`
- Create: `lib/mocks/rest-handlers.ts`
- Modify: `lib/mocks/handlers.ts`

**Interfaces:**
- Consumes: generated request/response models and Orval `*.msw.ts` handler factories.
- Produces: `mockDb.reset()`, Workspace/Folder/Note/Session/Segment query/mutation methods, and `restHandlers`.

- [ ] **Step 1: Write failing state-transition tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { mockDb } from "@/lib/mocks/db";

describe("mockDb", () => {
  beforeEach(() => mockDb.reset());

  it("attaches one note to multiple folders idempotently", () => {
    const note = mockDb.createNote(mockDb.workspace.workspaceId, {});
    const first = mockDb.createFolder(mockDb.workspace.workspaceId, { name: "제품" });
    const second = mockDb.createFolder(mockDb.workspace.workspaceId, { name: "개발" });
    mockDb.attachFolder(note.noteId, first.folderId);
    mockDb.attachFolder(note.noteId, first.folderId);
    mockDb.attachFolder(note.noteId, second.folderId);
    expect(mockDb.getNote(note.noteId).folders).toHaveLength(2);
  });

  it("rejects a second active session", () => {
    const note = mockDb.createNote(mockDb.workspace.workspaceId, {});
    mockDb.createSession(note.noteId, { language: "ko" });
    expect(() => mockDb.createSession(note.noteId, { language: "en" })).toThrow(
      "ACTIVE_TRANSCRIPTION_SESSION_EXISTS"
    );
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test:run lib/mocks/db.test.ts`

Expected: module resolution fails because `lib/mocks/db.ts` does not exist.

- [ ] **Step 3: Implement the smallest deterministic database**

Use fixed IDs beginning with `01K` and a monotonically incremented 13-character test ID factory. Seed one user, one default Workspace, two folders, two notes, one completed Session, and three Final Segments. Export one singleton:

```ts
export const mockDb = {
  workspace,
  reset,
  listNotes,
  createNote,
  getNote,
  updateNote,
  deleteNote,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  attachFolder,
  detachFolder,
  createSession,
  listSessions,
  getSession,
  getActiveSession,
  updateSessionStatus,
  listSegments,
  addSegment,
  deleteSegment,
};
```

All returned values must be copies so React Query cache consumers cannot mutate the store. Folder and Note deletion rules, sorting, cursor behavior, and Segment ordering must match the design spec.

- [ ] **Step 4: Verify the store tests pass**

Run: `pnpm test:run lib/mocks/db.test.ts`

Expected: both state tests pass.

- [ ] **Step 5: Register explicit Orval handler overrides**

In `rest-handlers.ts`, use generated handler factories with callbacks, for example:

```ts
getListWorkspaceNotesMockHandler(({ request, params }) => {
  const url = new URL(request.url);
  return {
    success: true,
    data: mockDb.listNotes(params.workspaceId, {
      cursor: url.searchParams.get("cursor"),
      folderId: url.searchParams.get("folderId"),
      limit: Number(url.searchParams.get("limit") ?? 20),
    }),
  };
});
```

Map store errors to explicit `HttpResponse.json({ success: false, error }, { status })` manual override handlers only where the generated success handler cannot change status. Keep all successful responses explicit and never call an Orval default Faker response.

- [ ] **Step 6: Run all REST mock tests and lint**

Run: `pnpm test:run lib/mocks/db.test.ts && pnpm lint`

Expected: tests and lint pass.

- [ ] **Step 7: Commit the stateful REST mock**

```bash
git add lib/mocks/db.ts lib/mocks/db.test.ts lib/mocks/rest-handlers.ts lib/mocks/handlers.ts
git commit -m "feat(mocks): add stateful meeting note rest handlers"
```

### Task 5: Add and validate the AsyncAPI contract

**Files:**
- Create: `asyncapi.yml`
- Create: `lib/transcription/protocol.examples.test.ts`

**Interfaces:**
- Consumes: design-spec WebSocket endpoint, TSID schema, state enum, and shared error codes.
- Produces: AsyncAPI 3.1 channel `/v1/transcription-sessions/{sessionId}/stream`, five client commands, seven server events, binary audio, examples, and close-code documentation.

- [ ] **Step 1: Create an intentionally incomplete document and verify validation fails**

Create:

```yaml
asyncapi: 3.1.0
info:
  title: HeyMoa Realtime Transcription API
  version: 0.0.1
channels:
  transcription:
    address: /v1/transcription-sessions/{sessionId}/stream
    messages:
      MissingMessage:
        $ref: '#/components/messages/MissingMessage'
```

Run: `pnpm asyncapi:validate`

Expected: FAIL because the referenced message and required channel parameter definition are missing.

- [ ] **Step 2: Complete the AsyncAPI document**

Define:

- servers `local` (`localhost:8080`, protocol `ws`) and `production` (`api.heymoa.com`, protocol `wss`)
- one WebSocket channel with `{sessionId}` TSID path parameter and required `ticket` query binding
- `receiveBrowserMessages` action `receive`
- `sendBrowserEvents` action `send`
- message components `AudioChunk`, `TurnCommit`, `SessionPause`, `SessionResume`, `SessionComplete`, `Ping`, `SessionReady`, `SessionStatus`, `TranscriptPartial`, `TranscriptFinal`, `SessionCompleted`, `Error`, `Pong`
- JSON `type` fields as single-value enums and `additionalProperties: false`
- AudioChunk content type `application/octet-stream`, payload `type: string`, `format: binary`
- close codes 1000, 4401, 4403, 4404, 4409, 4503 in channel documentation
- one valid example for every JSON message

The AsyncAPI document describes the Spring application perspective: Browser messages are received and Browser events are sent.

- [ ] **Step 3: Validate the completed contract**

Run: `pnpm asyncapi:validate`

Expected: `File asyncapi.yml is valid` or the CLI equivalent success with exit code 0.

- [ ] **Step 4: Add example-shape regression tests**

Create a test that imports the same literal payloads later exported from `protocol.ts`; until Task 6 it should assert static JSON examples copied from AsyncAPI:

```ts
import { describe, expect, it } from "vitest";

describe("AsyncAPI examples", () => {
  it("keeps Partial as a full snapshot", () => {
    const message = {
      type: "TRANSCRIPT_PARTIAL",
      itemId: "provider-item-1",
      text: "현재까지 누적된 문장",
    } as const;
    expect(message.text).not.toBe("");
  });
});
```

- [ ] **Step 5: Commit the WebSocket contract**

```bash
git add asyncapi.yml lib/transcription/protocol.examples.test.ts
git commit -m "feat(api): add realtime transcription asyncapi contract"
```

### Task 6: Implement the typed protocol and MSW WebSocket state machine

**Files:**
- Create: `lib/transcription/protocol.ts`
- Create: `lib/transcription/protocol.test.ts`
- Create: `lib/mocks/transcription-scenario.ts`
- Create: `lib/mocks/transcription-scenario.test.ts`
- Create: `lib/mocks/websocket-handler.ts`
- Modify: `lib/mocks/handlers.ts`

**Interfaces:**
- Produces: `ClientCommand`, `ServerEvent`, `parseClientCommand()`, `parseServerEvent()`, `MockTranscriptionScenario.receive()`, and `transcriptionWebSocketHandler`.

- [ ] **Step 1: Write failing protocol parsing tests**

```ts
import { describe, expect, it } from "vitest";
import { parseServerEvent } from "@/lib/transcription/protocol";

describe("parseServerEvent", () => {
  it("accepts a Partial snapshot", () => {
    expect(
      parseServerEvent(JSON.stringify({
        type: "TRANSCRIPT_PARTIAL",
        itemId: "provider-item-1",
        text: "안녕하세요",
      }))
    ).toMatchObject({ type: "TRANSCRIPT_PARTIAL", text: "안녕하세요" });
  });

  it("rejects a Final without a persisted segment ID", () => {
    expect(() =>
      parseServerEvent(
        JSON.stringify({
          type: "TRANSCRIPT_FINAL",
          itemId: "provider-item-1",
          segment: { text: "누락" },
        })
      )
    ).toThrow();
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test:run lib/transcription/protocol.test.ts`

Expected: module resolution fails.

- [ ] **Step 3: Implement Zod discriminated unions**

Create exact Zod schemas for all AsyncAPI JSON messages and export inferred unions. `parseServerEvent(raw)` must parse JSON and then call `serverEventSchema.parse`. `parseClientCommand(raw)` follows the same pattern. Share `transcriptionSessionStatusSchema` and `transcriptSegmentSchema` inside this file.

- [ ] **Step 4: Verify protocol GREEN**

Run: `pnpm test:run lib/transcription/protocol.test.ts lib/transcription/protocol.examples.test.ts`

Expected: all protocol/example tests pass.

- [ ] **Step 5: Write the failing pure state-machine test**

```ts
import { describe, expect, it, vi } from "vitest";
import { MockTranscriptionScenario } from "@/lib/mocks/transcription-scenario";

describe("MockTranscriptionScenario", () => {
  it("keeps pause and resume in one session", () => {
    const send = vi.fn();
    const scenario = new MockTranscriptionScenario("01K0000000010", send);
    scenario.open();
    scenario.receive({ type: "SESSION_PAUSE" });
    scenario.receive({ type: "SESSION_RESUME" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "SESSION_STATUS", status: "PAUSED" }));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ type: "SESSION_STATUS", status: "STREAMING" }));
  });
});
```

- [ ] **Step 6: Implement scenario and handler adapter**

The pure scenario owns status, accumulated Faker sentence, item ID, sequence, and timers. `open()` emits READY then STREAMING. Binary input advances a deterministic sentence and emits full Partial snapshots. TURN_COMMIT stores a Final in `mockDb`, emits Final, and clears the Partial. COMPLETE performs a final commit, emits FINALIZING then COMPLETED, and requests close 1000. PAUSE commits and emits PAUSED; RESUME emits STREAMING.

The MSW adapter must use:

```ts
import { ws } from "msw";

const link = ws.link(/\/v1\/transcription-sessions\/[^/]+\/stream/);

export const transcriptionWebSocketHandler = link.addEventListener(
  "connection",
  ({ client }) => {
    const scenario = createScenarioFromConnection(client.url, client);
    scenario.open();
    client.addEventListener("message", (event) => scenario.receiveFrame(event.data));
    client.addEventListener("close", () => scenario.dispose());
  }
);
```

Register it once in `handlers.ts` beside the REST handlers.

- [ ] **Step 7: Run state-machine and lint checks**

Run: `pnpm test:run lib/mocks/transcription-scenario.test.ts && pnpm lint`

Expected: tests and lint pass.

- [ ] **Step 8: Commit typed protocol and WebSocket mock**

```bash
git add lib/transcription lib/mocks/transcription-scenario.ts lib/mocks/transcription-scenario.test.ts lib/mocks/websocket-handler.ts lib/mocks/handlers.ts
git commit -m "feat(mocks): simulate realtime transcription websocket"
```

### Task 7: Implement transcript reduction, socket lifecycle, and PCM capture

**Files:**
- Create: `lib/transcription/transcript-reducer.ts`
- Create: `lib/transcription/transcript-reducer.test.ts`
- Create: `lib/transcription/socket.ts`
- Create: `lib/transcription/socket.test.ts`
- Create: `lib/transcription/audio.ts`
- Create: `lib/transcription/audio.test.ts`
- Create: `public/audio/pcm-capture-worklet.js`

**Interfaces:**
- Produces: `TranscriptState`, `transcriptReducer`, `TranscriptionSocket`, `PcmAudioCapture`.

- [ ] **Step 1: Write failing reducer tests**

```ts
import { describe, expect, it } from "vitest";
import { initialTranscriptState, transcriptReducer } from "@/lib/transcription/transcript-reducer";

describe("transcriptReducer", () => {
  it("replaces Partial snapshots and removes them on Final", () => {
    const first = transcriptReducer(initialTranscriptState, {
      type: "TRANSCRIPT_PARTIAL",
      itemId: "item-1",
      text: "안녕",
    });
    const second = transcriptReducer(first, {
      type: "TRANSCRIPT_PARTIAL",
      itemId: "item-1",
      text: "안녕하세요",
    });
    const final = transcriptReducer(second, {
      type: "TRANSCRIPT_FINAL",
      itemId: "item-1",
      segment: {
        segmentId: "01K0000000011",
        sessionId: "01K0000000010",
        sequence: 1,
        text: "안녕하세요",
        startedAtMs: 0,
        endedAtMs: 1200,
      },
    });
    expect(second.partialByItemId["item-1"]).toBe("안녕하세요");
    expect(final.partialByItemId["item-1"]).toBeUndefined();
    expect(final.finalSegments).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify RED, implement the reducer, verify GREEN**

Run before: `pnpm test:run lib/transcription/transcript-reducer.test.ts`

Expected before: module resolution failure.

Implement immutable Partial replacement and `segmentId` Final upsert, then rerun the same command and expect PASS.

- [ ] **Step 3: Write socket lifecycle tests with a fake WebSocket**

Cover READY gating, typed command serialization, binary forwarding only in STREAMING, ERROR propagation, completed close, and cleanup. The public API must be:

```ts
type TranscriptionSocketOptions = {
  url: string;
  onEvent: (event: ServerEvent) => void;
  onClose: (code: number, reason: string) => void;
};

class TranscriptionSocket {
  connect(): Promise<void>;
  sendAudio(chunk: ArrayBuffer): void;
  sendCommand(command: ClientCommand): void;
  close(): void;
}
```

Run: `pnpm test:run lib/transcription/socket.test.ts`

Expected before implementation: FAIL; expected after implementation: PASS.

- [ ] **Step 4: Write audio conversion and resampling tests**

Test Float32 clamping to PCM16, linear resampling from 48 kHz to 24 kHz, 40–100 ms batching, and backlog conversion:

```ts
expect(backlogMs(48_000, 24_000)).toBe(1000);
```

Implement AudioWorklet registration, `getUserMedia`, deterministic linear resampling, Int16 little-endian conversion, and bounded chunk batching in `audio.ts`. The worklet only posts transferable Float32 buffers; it does not open sockets or know Session state.

- [ ] **Step 5: Run all transcription unit tests**

Run: `pnpm test:run lib/transcription && pnpm lint`

Expected: reducer, socket, audio, and protocol tests pass; lint passes.

- [ ] **Step 6: Commit the browser transcription primitives**

```bash
git add lib/transcription public/audio/pcm-capture-worklet.js
git commit -m "feat(transcription): add browser audio and socket runtime"
```

### Task 8: Mount one global RecordingProvider

**Files:**
- Create: `components/transcription/recording-provider.tsx`
- Create: `components/transcription/recording-provider.test.tsx`
- Create: `components/transcription/global-recording-indicator.tsx`
- Modify: `app/providers.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: generated transcription mutations/queries, `TranscriptionSocket`, `PcmAudioCapture`, and `transcriptReducer`.
- Produces: `useRecording()` with `start(noteId, language)`, `pause()`, `resume()`, `stop()`, current Session, transcript state, elapsed time, and error.

- [ ] **Step 1: Read the local Next.js provider guidance**

Read completely:

```text
node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md
```

- [ ] **Step 2: Write the failing provider persistence test**

Render a harness under MemoryRouter-like mocked navigation, start one Session, rerender children as another page, and assert the same socket instance and Session ID remain. Also assert pause/resume keeps that ID and stop waits for SESSION_COMPLETED.

```ts
expect(result.current.session?.sessionId).toBe("01K0000000010");
await act(() => result.current.pause());
await act(() => result.current.resume());
expect(result.current.session?.sessionId).toBe("01K0000000010");
```

- [ ] **Step 3: Verify RED and implement the provider**

Run before: `pnpm test:run components/transcription/recording-provider.test.tsx`

Expected before: module resolution failure.

Implement a reducer-driven Provider that:

- checks `getActiveTranscriptionSession` on authenticated startup
- creates a Session and socket ticket through generated Orval mutations
- requests microphone permission before Session creation
- opens audio only after SESSION_READY
- preserves itself across route changes
- pauses capture before SESSION_PAUSE
- resumes capture after STREAMING acknowledgement
- stops capture before SESSION_COMPLETE and waits for SESSION_COMPLETED
- refetches active Session and obtains a new ticket after reload
- invalidates note Sessions/Segments after Final or completion
- exposes 409 active-session recovery instead of creating another Session

- [ ] **Step 4: Add the global indicator and mount order**

Wrap `AuthProvider` children with `RecordingProvider` inside `QueryClientProvider`. Render `GlobalRecordingIndicator` inside the authenticated app chrome but outside route `children`. The indicator links to:

```text
/w/{workspaceId}/notes/{noteId}?view=full&tab=transcript
```

It shows status, elapsed time, pause/resume, stop, and no transcript content.

- [ ] **Step 5: Verify provider tests and build**

Run: `pnpm test:run components/transcription && pnpm lint && pnpm build`

Expected: provider tests, lint, and Next.js build pass.

- [ ] **Step 6: Commit the global recording lifecycle**

```bash
git add components/transcription app/providers.tsx app/layout.tsx
git commit -m "feat(transcription): add global recording provider"
```

### Task 9: Build Workspace and canonical Note routes

**Files:**
- Create: `app/w/[workspaceId]/page.tsx`
- Create: `app/w/[workspaceId]/notes/[noteId]/page.tsx`
- Create: `components/workspace/workspace-page.tsx`
- Create: `components/notes/note-view.tsx`
- Create: `components/notes/note-view.test.tsx`
- Create: `components/notes/note-details.tsx`
- Create: `components/notes/transcript-view.tsx`
- Modify: `components/FooterGate.tsx`
- Modify: `components/layout/Navbar.tsx`
- Modify: `lib/auth/paths.ts`

**Interfaces:**
- Consumes: generated Workspace/Folder/Note/Session/Segment hooks and `useRecording()`.
- Produces: mock-backed URLs `/w/{workspaceId}` and `/w/{workspaceId}/notes/{noteId}?view=side|full&tab=details|transcript`.

- [ ] **Step 1: Read the local Next.js routing/search-param docs**

Read completely:

```text
node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md
```

- [ ] **Step 2: Write the failing URL normalization test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeNoteViewQuery } from "@/components/notes/note-view";

describe("normalizeNoteViewQuery", () => {
  it("falls back to full transcript", () => {
    expect(normalizeNoteViewQuery({ view: "invalid", tab: "invalid" })).toEqual({
      view: "full",
      tab: "transcript",
    });
  });

  it("preserves an explicit side details view", () => {
    expect(normalizeNoteViewQuery({ view: "side", tab: "details" })).toEqual({
      view: "side",
      tab: "details",
    });
  });
});
```

- [ ] **Step 3: Verify RED and implement route shells/query normalization**

Run before: `pnpm test:run components/notes/note-view.test.tsx`

Expected before: module resolution failure.

Server page files unwrap asynchronous Next.js 16 `params`/`searchParams` and pass plain IDs/query to client components. `NoteView` updates only query params when toggling side/full or details/transcript. Closing side view navigates to `/w/{workspaceId}`.

- [ ] **Step 4: Implement the Workspace mock workflow**

Use generated hooks for Workspace, folders, and cursor notes. Render notes grouped by `lastRecordedAt ?? createdAt`, include title, recorded duration, creator, and folder pills. Add actions to create Note, create/rename/delete Folder, and filter by Folder. Creating a Note navigates to its canonical URL with `view=full&tab=transcript`.

- [ ] **Step 5: Implement Note details and transcript tabs**

Details uses generated update Note and attach/detach Folder mutations. Transcript renders Sessions and persisted Final Segments from REST plus live Partial/Final state from `useRecording()`. Segment delete uses the generated mutation and invalidates the Segment list. The record button calls `start(noteId, language)`; active recording controls come from the global provider.

- [ ] **Step 6: Adjust app chrome and OAuth return paths**

Hide the marketing footer on `/w/**`. Make the Navbar logo go to the default Workspace for authenticated users while preserving `/` for anonymous users. Extend `normalizeReturnTo` to allow paths matching `/w/{13-char-tsid}` and their Note descendants while continuing to reject absolute/open-redirect URLs.

- [ ] **Step 7: Run route tests and full browser build**

Run: `pnpm test:run components/notes components/transcription lib/mocks lib/transcription && pnpm lint && pnpm build`

Expected: tests, lint, and Next.js build pass; generated route types accept both dynamic pages.

- [ ] **Step 8: Manual MSW acceptance flow**

Run: `NEXT_PUBLIC_API_MOCKING=enabled pnpm dev`

Verify in a browser:

1. Open the default Workspace and filter notes by Folder.
2. Create a Note and attach two Folders.
3. Open the same Note in side/details and full/transcript modes by changing only query params.
4. Start recording and observe READY, multiple Partial snapshots, and a Final Segment.
5. Navigate to another page and confirm the global indicator and socket remain active.
6. Pause/resume and confirm the Session ID does not change.
7. Stop and confirm the final Segment arrives before COMPLETED.
8. Delete one Segment and confirm it disappears without renumbering the remaining sequence.

- [ ] **Step 9: Commit the mock-backed meeting-note pages**

```bash
git add app/w components/workspace components/notes components/FooterGate.tsx components/layout/Navbar.tsx lib/auth/paths.ts
git commit -m "feat: add mock-backed meeting note workspace"
```

### Task 10: Final contract and regression verification

**Files:**
- Verify: all changed files
- Modify: `README.md`

**Interfaces:**
- Consumes: completed REST/AsyncAPI contracts, generated client, mocks, transcription runtime, and pages.
- Produces: reproducible developer commands and a clean verified branch.

- [ ] **Step 1: Document the two-contract development loop**

Add commands and responsibilities to `README.md`:

```text
REST contract: openapi3.yml → pnpm orval → generated TanStack Query/MSW/Faker
WebSocket contract: asyncapi.yml → pnpm asyncapi:validate → handwritten protocol/client/MSW
Mock app: NEXT_PUBLIC_API_MOCKING=enabled pnpm dev
```

State that generated files must never be edited and Spring implementation is a separate project phase.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
pnpm test:run
pnpm asyncapi:validate
pnpm orval
pnpm format:check
pnpm lint
pnpm build
git diff --check
git status --short
```

Expected: all commands exit 0. After `pnpm orval`, `git status --short` must show no unexpected generated diff. Only intentional README or final formatting changes may remain.

- [ ] **Step 3: Review scope against the design**

Confirm there is no Workspace management, member management, participant model, private/team visibility, TranscriptSegment edit, AI document, summary, template, chatbot, raw audio storage, STOMP, or direct OpenAI browser connection.

- [ ] **Step 4: Commit final documentation and formatting**

```bash
git add README.md openapi3.yml asyncapi.yml orval.config.ts lib app components public package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts
git commit -m "docs: document contract-first meeting note workflow"
```

If Step 2 produced no tracked changes after the previous task commits, skip this commit instead of creating an empty commit.
