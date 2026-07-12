# Contract, Mock Transcription, and Workspace Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a contract-consistent Korean-only meeting-note MVP with deterministic REST/WebSocket mocks, microphone-driven Partial/Final transcription, pause-correct recording time, and polished account, workspace, note-list, and note-overlay flows.

**Architecture:** OpenAPI remains the REST source of truth and regenerates all Orval clients; AsyncAPI plus `lib/transcription/protocol.ts` defines the raw WebSocket boundary. A shared in-memory MSW store backs REST and WebSocket handlers, while `RecordingProvider` owns the single active microphone, socket, transcript, level, and active-duration state above `/w/**` navigation. Workspace and note surfaces consume generated TanStack Query hooks and URL state only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui Base UI primitives, TanStack Query 5, Orval 8, MSW 2 WebSocket, Faker 10 seeded utilities, Zod 4, Web Audio API, AudioWorklet, Vitest, Testing Library.

## Global Constraints

- Work directly on the existing `dev` branch; do not create a worktree.
- Prefix every shell command with `rtk`.
- Read the relevant files in `node_modules/next/dist/docs/` before changing App Router pages, layouts, providers, or navigation.
- Never hand-edit `lib/api/generated/**`; change `openapi3.yml`, run `rtk pnpm orval`, and commit generated output.
- All REST calls in application UI use Orval-generated hooks; no direct `fetch()` to REST endpoints.
- MSW success envelopes explicitly include `success: true`.
- Public IDs and server PKs are 13-character TSID strings; external timestamps are RFC 3339 `date-time` mapped to Spring Kotlin `Instant`.
- The MVP is Korean-only: no language field, language selector, English option, or automatic language detection UI.
- Exactly one TranscriptionSession may be active per user; pause/resume retains the same session.
- `recordedDurationMs`, `startedAtMs`, and `endedAtMs` exclude paused wall-clock time.
- TranscriptSegment is immutable except for deletion.
- Do not add workspace deletion, members, roles, invitations, plans, usage, templates, integrations, sharing, AI summaries, documents, action items, or chatbot features.
- Do not add an audio visualization dependency or use an HTML `<canvas>`; use Web Audio API plus SVG/CSS.
- Follow `DESIGN.md`: `--el-*` tokens, off-white canvas, rounded white card surfaces, one hairline and soft shadow tier, serif-light display headings, sans-serif controls, and ink pill CTAs.
- Before every commit run `rtk pnpm lint && rtk pnpm build` and require exit code 0.

---

## File Structure

### Contracts and generation

- Modify `openapi3.yml`: success/error envelopes, User/Workspace endpoints, Korean-only session contract, and active duration.
- Modify `asyncapi.yml`: active-duration status events, Partial offsets, exact command/state rules, close codes, and examples.
- Modify `orval.config.ts` only if generated grouping no longer maps User and Workspace operations cleanly.
- Regenerate `lib/api/generated/**`: models, clients, query hooks, Faker factories, and generated MSW helpers.
- Create `lib/api/contract-consistency.test.ts`: duplicate-key, operationId, shared-enum, TSID, and segment drift checks.
- Modify `lib/api/transcription-contract.test.ts`: assert REST transcription schema constraints.
- Modify `lib/transcription/protocol.ts`: runtime schemas that mirror AsyncAPI.
- Modify `lib/transcription/protocol.examples.test.ts`: parse every documented WebSocket example.

### Mock state and handlers

- Modify `lib/mocks/db.ts`: stateful User and multiple Workspace entities, workspace-scoped resources, default invariant, recorded duration, and deterministic TSIDs.
- Modify `lib/mocks/db.test.ts`: User/Workspace mutations, default invariant, cross-workspace authorization, active-session and duration behavior.
- Modify `lib/mocks/rest-handlers.ts`: implement all new generated User/Workspace routes and revised envelopes.
- Modify `lib/mocks/handlers.ts`: keep one normal browser scenario and register revised handlers.
- Create `lib/mocks/voice-activity.ts`: pure PCM16 RMS, adaptive threshold, voiced/silence duration helpers.
- Create `lib/mocks/voice-activity.test.ts`: deterministic silence, noise, and speech tests.
- Modify `lib/mocks/transcription-scenario.ts`: seeded Korean scripts and microphone-energy-driven Partial/Final state machine.
- Modify `lib/mocks/transcription-scenario.test.ts`: timing, pause, resume, commit, complete, persistence, and injected failure tests.
- Modify `lib/mocks/websocket-handler.ts`: pass binary frames and injectable scenario dependencies without an environment selector.

### Browser audio and recording state

- Modify `lib/transcription/audio.ts`: one media graph exposing PCM chunks and normalized levels.
- Modify `lib/transcription/audio.test.ts`: RMS/level throttling and capture lifecycle tests around pure helpers.
- Add `public/pcm-capture-worklet.js`: mono 24 kHz PCM16 frame production.
- Modify `components/transcription/recording-provider.tsx`: remove language, expose mic level/device state, restore active duration, and freeze pause time.
- Modify `components/transcription/recording-provider.test.tsx`: single-session lifecycle, pause-correct timer, rehydrate, and level updates.
- Modify `components/transcription/global-recording-indicator.tsx`: actual compact level meter and consistent error/state labels.

### Account, workspace, and note UI

- Create `components/settings/settings-dialog.tsx`: responsive Account and Workspace General settings.
- Create `components/settings/account-settings-form.tsx`: display-name mutation and read-only Google identity fields.
- Create `components/settings/workspace-settings-form.tsx`: name/description mutation and explicit default command.
- Create matching `*.test.tsx` files for all three settings components.
- Modify `components/workspace/workspace-app-shell.tsx`: query and distribute User/Workspace list state and own settings-dialog state.
- Modify `components/workspace/workspace-sidebar.tsx`: profile menu, workspace switcher/create/settings, folders, rounded editorial surface.
- Modify `components/workspace/workspace-sidebar.test.tsx`: switching, creation, settings, logout, and Folder regression tests.
- Modify `components/workspace/workspace-toolbar.tsx`: remove language and retain only location, new note, and recording CTA/state.
- Modify `components/workspace/workspace-page.tsx`: dense home composition and supported empty/loading/error states.
- Modify `components/workspace/workspace-note-list.tsx` and `note-list-row.tsx`: cursor pagination, date grouping, active row, and editorial density.
- Modify `app/auth/callback/page.tsx`: navigate to the default workspace from the list with observable fallback.
- Modify `components/notes/note-route-surface.tsx`: inset rounded desktop overlay, mobile surface, and full view.
- Modify `components/notes/note-view.tsx`: URL normalization and close/full transitions.
- Modify `components/notes/note-panel.tsx`: shared top-left surface controls and supported tabs.
- Modify `components/notes/transcript-view.tsx`: real waveform, active time, Partial/Final reconciliation, session boundaries, and segment deletion.
- Modify `components/notes/note-details.tsx`: title, context, folders, metadata, and explicit save feedback only.
- Update existing component tests and create focused tests where the responsibilities above lack coverage.

---

### Task 1: Restore a trustworthy baseline

**Files:**

- Modify: `components/notes/note-panel.test.tsx`
- Read: `components/transcription/recording-provider.test.tsx`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

**Interfaces:**

- Consumes: existing `RecordingProvider` and `NotePanel` public props.
- Produces: a shared test render wrapper proving Note UI always has Query and Recording providers.

- [ ] **Step 1: Capture the current failure**

Run: `rtk pnpm test:run components/notes/note-panel.test.tsx`

Expected: FAIL with `useRecording must be used inside RecordingProvider.`

- [ ] **Step 2: Add the provider-backed test runtime**

Add a local wrapper that supplies inert audio/socket/API dependencies rather than mocking `useRecording`:

```tsx
const runtime: RecordingRuntime = {
  createAudio: () => ({
    requestPermission: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  }),
  createSocket: () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn(),
    sendCommand: vi.fn(),
    close: vi.fn(),
  }),
};

function renderNotePanel(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RecordingProvider
        runtime={runtime}
        api={{
          createSession: vi.fn(),
          createTicket: vi.fn(),
        }}
      >
        {ui}
      </RecordingProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Verify the repaired baseline**

Run: `rtk pnpm test:run`

Expected: all current tests pass with no unhandled provider error.

- [ ] **Step 4: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: both exit 0; existing warnings may remain but no new warning is introduced.

```bash
rtk git add components/notes/note-panel.test.tsx
rtk git commit -m "test: restore note panel provider baseline"
```

### Task 2: Make OpenAPI the exact REST contract

**Files:**

- Modify: `openapi3.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `lib/api/transcription-contract.test.ts`
- Create: `lib/api/openapi-contract.test.ts`
- Regenerate: `lib/api/generated/**`

**Interfaces:**

- Produces: `CurrentUserResponse`, `UpdateCurrentUserRequest`, `WorkspaceResponse`, `CreateWorkspaceRequest`, `UpdateWorkspaceRequest`, `WorkspaceListResponse`, `AppErrorResponse`, and `TranscriptionSessionResponse.recordedDurationMs`.
- Produces generated hooks `useGetCurrentUser`, `useUpdateCurrentUser`, `useListWorkspaces`, `useCreateWorkspace`, `useGetWorkspace`, `useUpdateWorkspace`, and `useSetDefaultWorkspace`.
- Removes: `getDefaultWorkspace`, `CreateTranscriptionSessionRequest.language`, `TranscriptionSessionResponse.language`, and the create-session request body.

- [ ] **Step 1: Write contract tests that expose the current defects**

Add the YAML parser as a direct test dependency before importing it:

Run: `rtk pnpm add -D yaml@2.9.0`

Expected: `yaml` appears in `devDependencies` and the lockfile remains on version 2.9.0 already used by the toolchain.

Use the `yaml` parser already available transitively through AsyncAPI tooling and reject duplicate keys before parsing:

```ts
import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

const source = readFileSync("openapi3.yml", "utf8");
const document = parseDocument(source, { uniqueKeys: true });

describe("OpenAPI contract", () => {
  it("has no duplicate YAML keys", () => {
    expect(document.errors).toEqual([]);
  });

  it("gives every operation a unique operationId", () => {
    const api = document.toJS();
    const ids = Object.values(api.paths).flatMap((path: any) =>
      Object.values(path)
        .map((operation: any) => operation?.operationId)
        .filter(Boolean)
    );
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids.every((id: string) => id.length > 0)).toBe(true);
  });

  it("does not expose a language field or default-workspace read route", () => {
    expect(source).not.toContain("/v1/workspaces/default:");
    expect(source).not.toMatch(/^\s+language:/m);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run lib/api/openapi-contract.test.ts lib/api/transcription-contract.test.ts`

Expected: FAIL for duplicate keys, the legacy default route, missing workspace list/mutations, language, and missing `recordedDurationMs`.

- [ ] **Step 3: Rewrite the affected OpenAPI paths and schemas**

Define the exact paths:

```yaml
/v1/users/me:
  get:
    operationId: getCurrentUser
  patch:
    operationId: updateCurrentUser
/v1/workspaces:
  get:
    operationId: listWorkspaces
  post:
    operationId: createWorkspace
/v1/workspaces/{workspaceId}:
  get:
    operationId: getWorkspace
  patch:
    operationId: updateWorkspace
/v1/workspaces/{workspaceId}/default:
  put:
    operationId: setDefaultWorkspace
```

Use required discriminated envelopes:

```yaml
AppErrorResponse:
  type: object
  required: [success, error]
  properties:
    success: { type: boolean, enum: [false] }
    error: { $ref: "#/components/schemas/AppErrorBody" }
WorkspaceResponse:
  type: object
  required: [workspaceId, name, description, isDefault, createdAt, updatedAt]
  properties:
    workspaceId: { $ref: "#/components/schemas/Tsid" }
    name: { type: string, minLength: 1, maxLength: 80 }
    description: { type: [string, "null"], maxLength: 500 }
    isDefault: { type: boolean }
    createdAt: { type: string, format: date-time }
    updatedAt: { type: string, format: date-time }
```

Make every endpoint-specific success envelope require `success` and `data`, constrain `success` to `[true]`, and reference `AppErrorResponse` from common error responses. Keep create/delete responses at HTTP 200.

- [ ] **Step 4: Regenerate Orval artifacts**

Run: `rtk pnpm orval`

Expected: generation succeeds; User and Workspace hooks listed under `lib/api/generated/`; no generated model contains a transcription `language` property or `getDefaultWorkspace` function.

- [ ] **Step 5: Verify GREEN and generation stability**

Run: `rtk pnpm test:run lib/api/openapi-contract.test.ts lib/api/transcription-contract.test.ts`

Expected: all contract tests pass.

Run: `rtk pnpm orval && rtk git diff --exit-code lib/api/generated`

Expected: the second generation produces no diff.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0 after application compile errors caused by removed generated fields are temporarily resolved with the smallest call-site signature updates: `start(noteId)` and `createSession(noteId)` only.

```bash
rtk git add openapi3.yml orval.config.ts package.json pnpm-lock.yaml lib/api/openapi-contract.test.ts lib/api/transcription-contract.test.ts lib/api/generated components/transcription/recording-provider.tsx components/workspace/workspace-toolbar.tsx components/notes/note-panel.tsx
rtk git commit -m "feat: define user workspace and recording contracts"
```

### Task 3: Expand the shared MSW REST store

**Files:**

- Modify: `lib/mocks/db.ts`
- Modify: `lib/mocks/db.test.ts`
- Modify: `lib/mocks/rest-handlers.ts`

**Interfaces:**

- Produces: `mockDb.getCurrentUser()`, `updateCurrentUser(input)`, `listWorkspaces()`, `createWorkspace(input)`, `getWorkspace(id)`, `updateWorkspace(id, input)`, and `setDefaultWorkspace(id)`.
- Preserves: Note, Folder, Session, and Segment methods, now scoped through owning Workspace.
- Consumes: generated request/response types from Task 2.

- [ ] **Step 1: Write failing store tests**

```ts
it("keeps exactly one explicit default workspace", () => {
  const created = mockDb.createWorkspace({ name: "제품", description: null });
  expect(mockDb.listWorkspaces().items[0].isDefault).toBe(true);
  expect(created.isDefault).toBe(false);

  mockDb.setDefaultWorkspace(created.workspaceId);
  const defaults = mockDb
    .listWorkspaces()
    .items.filter((item) => item.isDefault);
  expect(defaults).toEqual([
    expect.objectContaining({ workspaceId: created.workspaceId }),
  ]);
});

it("updates only the editable user display name", () => {
  const before = mockDb.getCurrentUser();
  const after = mockDb.updateCurrentUser({ name: "김민수" });
  expect(after).toMatchObject({ name: "김민수", email: before.email });
});

it("rejects cross-workspace folder attachment", () => {
  const other = mockDb.createWorkspace({ name: "다른 팀", description: null });
  const note = mockDb.createNote(other.workspaceId, {
    title: "다른 노트",
    context: null,
  });
  const defaultFolder = mockDb.listFolders(
    mockDb.listWorkspaces().items[0].workspaceId
  )[0];
  expect(() =>
    mockDb.attachFolder(note.noteId, defaultFolder.folderId)
  ).toThrow("FORBIDDEN");
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run lib/mocks/db.test.ts`

Expected: FAIL because User/Workspace mutation methods and multi-workspace ownership do not exist.

- [ ] **Step 3: Implement deterministic state and invariants**

Replace module constants with state-owned entities:

```ts
type StoreState = {
  user: CurrentUserResponse;
  workspaces: WorkspaceResponse[];
  folders: Array<FolderResponse & { workspaceId: string }>;
  notes: NoteResponse[];
  sessions: TranscriptionSessionResponse[];
  segments: TranscriptSegmentResponse[];
};

function assertWorkspace(workspaceId: string) {
  return (
    state.workspaces.find((item) => item.workspaceId === workspaceId) ??
    fail("WORKSPACE_NOT_FOUND")
  );
}

function setDefaultWorkspace(workspaceId: string) {
  assertWorkspace(workspaceId);
  const updatedAt = nextTimestamp();
  state.workspaces.forEach((workspace) => {
    workspace.isDefault = workspace.workspaceId === workspaceId;
    if (workspace.isDefault) workspace.updatedAt = updatedAt;
  });
  return copy(assertWorkspace(workspaceId));
}
```

Seed exactly two workspaces, put the default first, and sort the remainder by Korean locale name. Generate every new public ID with the existing deterministic 13-character TSID-shaped generator.

- [ ] **Step 4: Add explicit REST handlers**

Use generated route paths and explicit success envelopes:

```ts
http.get("*/v1/workspaces", () =>
  HttpResponse.json({ success: true, data: mockDb.listWorkspaces() })
),
http.patch("*/v1/users/me", async ({ request }) =>
  withStore(() => mockDb.updateCurrentUser(await request.json()))
),
http.put("*/v1/workspaces/:workspaceId/default", ({ params }) =>
  withStore(() => mockDb.setDefaultWorkspace(id(params.workspaceId)))
),
```

Map validation/conflict/not-found/forbidden errors to the documented `AppErrorResponse`; never return a unit success envelope for errors.

- [ ] **Step 5: Verify store and handler behavior**

Run: `rtk pnpm test:run lib/mocks/db.test.ts`

Expected: all User, Workspace, ownership, existing Folder/Note, and active-session tests pass.

Run: `rtk pnpm test:run`

Expected: the full suite passes.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0.

```bash
rtk git add lib/mocks/db.ts lib/mocks/db.test.ts lib/mocks/rest-handlers.ts lib/mocks/handlers.ts
rtk git commit -m "feat: add stateful user and workspace mocks"
```

### Task 4: Align AsyncAPI, Zod, and drift tests

**Files:**

- Modify: `asyncapi.yml`
- Modify: `lib/transcription/protocol.ts`
- Modify: `lib/transcription/protocol.test.ts`
- Modify: `lib/transcription/protocol.examples.test.ts`
- Create: `lib/api/contract-consistency.test.ts`

**Interfaces:**

- Produces: `SESSION_STATUS { status, recordedDurationMs }` and `TRANSCRIPT_PARTIAL { itemId, text, startedAtMs }`.
- Preserves: `TRANSCRIPT_FINAL` with persisted `TranscriptSegment`, raw binary PCM16 audio, and native JSON commands.
- Produces close-code documentation consumed by socket tests and mock scenarios.

- [ ] **Step 1: Write failing runtime schema tests**

```ts
it("requires active duration on status events", () => {
  expect(() =>
    parseServerEvent(
      JSON.stringify({
        type: "SESSION_STATUS",
        status: "PAUSED",
      })
    )
  ).toThrow();
});

it("requires a recording-timeline offset on Partial", () => {
  expect(
    parseServerEvent(
      JSON.stringify({
        type: "TRANSCRIPT_PARTIAL",
        itemId: "provider-item-1",
        text: "회의를",
        startedAtMs: 1200,
      })
    )
  ).toMatchObject({ startedAtMs: 1200 });
});
```

In the consistency test, parse both YAML files and compare TSID patterns, session-status enum values, error enum values, and TranscriptSegment required field names.

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run lib/transcription/protocol.test.ts lib/transcription/protocol.examples.test.ts lib/api/contract-consistency.test.ts`

Expected: FAIL because status duration, Partial offset, and cross-contract comparison are absent.

- [ ] **Step 3: Update AsyncAPI messages and examples**

Use exact payloads:

```yaml
SessionStatusEvent:
  payload:
    type: object
    required: [type, status, recordedDurationMs]
    properties:
      type: { type: string, enum: [SESSION_STATUS] }
      status: { $ref: "#/components/schemas/TranscriptionSessionStatus" }
      recordedDurationMs: { type: integer, format: int64, minimum: 0 }
TranscriptPartialEvent:
  payload:
    type: object
    required: [type, itemId, text, startedAtMs]
    properties:
      type: { type: string, enum: [TRANSCRIPT_PARTIAL] }
      itemId: { type: string, minLength: 1 }
      text: { type: string }
      startedAtMs: { type: integer, format: int64, minimum: 0 }
```

Document allowed commands for STREAMING, PAUSED, and FINALIZING; recoverable errors keep the connection, while authentication, authorization, missing-session, and provider failures send `ERROR` then close with explicit 44xx/45xx codes.

- [ ] **Step 4: Mirror schemas in Zod and parse all examples**

```ts
const sessionStatusEventSchema = z.strictObject({
  type: z.literal("SESSION_STATUS"),
  status: transcriptionSessionStatusSchema,
  recordedDurationMs: z.number().int().nonnegative(),
});

const transcriptPartialEventSchema = z.strictObject({
  type: z.literal("TRANSCRIPT_PARTIAL"),
  itemId: z.string().min(1),
  text: z.string(),
  startedAtMs: z.number().int().nonnegative(),
});
```

Update `protocolExamples` to exactly match AsyncAPI and make the example test iterate every client command and server event through the corresponding parser.

- [ ] **Step 5: Validate all contract layers**

Run: `rtk pnpm asyncapi:validate`

Expected: AsyncAPI document is valid.

Run: `rtk pnpm test:run lib/transcription lib/api/contract-consistency.test.ts`

Expected: all parser, example, reducer, socket, and consistency tests pass.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0.

```bash
rtk git add asyncapi.yml lib/transcription/protocol.ts lib/transcription/protocol.test.ts lib/transcription/protocol.examples.test.ts lib/api/contract-consistency.test.ts
rtk git commit -m "feat: align websocket contracts and runtime validation"
```

### Task 5: Build one real microphone pipeline and pause-correct clock

**Files:**

- Modify: `lib/transcription/audio.ts`
- Modify: `lib/transcription/audio.test.ts`
- Create: `public/pcm-capture-worklet.js`
- Modify: `components/transcription/recording-provider.tsx`
- Modify: `components/transcription/recording-provider.test.tsx`

**Interfaces:**

- Produces: `PcmAudioCapture({ onChunk, onLevel })`, where `onLevel(level: number)` is clamped to `0..1` at 15–20 fps.
- Produces Recording context fields `level`, `microphoneState`, and `elapsedMs`; `start(noteId)` has no language argument.
- Consumes `session.recordedDurationMs` and status-event `recordedDurationMs` from Tasks 2 and 4.

- [ ] **Step 1: Write failing pure audio and provider tests**

```ts
it("normalizes silence and full-scale PCM levels", () => {
  expect(normalizePcm16Level(new Int16Array(480))).toBe(0);
  expect(normalizePcm16Level(new Int16Array(480).fill(32767))).toBeCloseTo(
    1,
    2
  );
});

it("freezes elapsed time while paused and resumes from accumulated duration", async () => {
  vi.useFakeTimers();
  const view = renderRecordingProvider();
  await view.start("01K0000000002");
  vi.advanceTimersByTime(3_000);
  view.emit({
    type: "SESSION_STATUS",
    status: "PAUSED",
    recordedDurationMs: 3_000,
  });
  vi.advanceTimersByTime(5_000);
  expect(view.current.elapsedMs).toBe(3_000);
  view.emit({
    type: "SESSION_STATUS",
    status: "STREAMING",
    recordedDurationMs: 3_000,
  });
  vi.advanceTimersByTime(2_000);
  expect(view.current.elapsedMs).toBe(5_000);
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run lib/transcription/audio.test.ts components/transcription/recording-provider.test.tsx`

Expected: FAIL because normalized levels and active-duration accumulation do not exist.

- [ ] **Step 3: Implement the shared Web Audio graph**

Create one `MediaStream`, `AudioContext`, worklet source, and analyser. The worklet posts 960 mono samples per 40 ms frame at 24 kHz; the main thread converts them with `float32ToPcm16` and sends binary frames. Read analyser RMS through `requestAnimationFrame`, publish at 50–67 ms intervals, and cancel it on pause/stop.

```ts
export type PcmAudioCaptureOptions = {
  onChunk: (chunk: ArrayBuffer) => void;
  onLevel?: (level: number) => void;
};

export function normalizePcm16Level(samples: Int16Array) {
  if (samples.length === 0) return 0;
  const meanSquare =
    samples.reduce((sum, sample) => {
      const normalized = sample / 32768;
      return sum + normalized * normalized;
    }, 0) / samples.length;
  return Math.min(1, Math.sqrt(meanSquare));
}
```

The mock-enabled browser path must use the same real microphone capture; remove the interval that sends zero-filled buffers.

- [ ] **Step 4: Replace wall-clock origin with accumulated active time**

Keep these refs:

```ts
const accumulatedMsRef = useRef(0);
const streamingStartedAtRef = useRef<number | null>(null);

function currentRecordedDuration(now = Date.now()) {
  return (
    accumulatedMsRef.current +
    (streamingStartedAtRef.current === null
      ? 0
      : now - streamingStartedAtRef.current)
  );
}
```

On `SESSION_STATUS`, set the accumulated value from the server event, start a new origin only for STREAMING, and clear it for PAUSED/FINALIZING/terminal states. Rehydration starts from REST `recordedDurationMs`, not `startedAt`. Stop level publication and set level to zero when not STREAMING.

- [ ] **Step 5: Verify audio and timing behavior**

Run: `rtk pnpm test:run lib/transcription/audio.test.ts components/transcription/recording-provider.test.tsx lib/transcription/socket.test.ts`

Expected: all tests pass, including pause freeze, resume, rehydrate, one active socket, and normalized level.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0 and `public/pcm-capture-worklet.js` is emitted as a static asset.

```bash
rtk git add lib/transcription/audio.ts lib/transcription/audio.test.ts public/pcm-capture-worklet.js components/transcription/recording-provider.tsx components/transcription/recording-provider.test.tsx
rtk git commit -m "feat: drive recording state from microphone audio"
```

### Task 6: Make MSW transcription respond to actual sound

**Files:**

- Create: `lib/mocks/voice-activity.ts`
- Create: `lib/mocks/voice-activity.test.ts`
- Modify: `lib/mocks/transcription-scenario.ts`
- Modify: `lib/mocks/transcription-scenario.test.ts`
- Modify: `lib/mocks/websocket-handler.ts`
- Modify: `lib/mocks/db.ts`

**Interfaces:**

- Produces: `pcm16Rms(frame)`, `VoiceActivityDetector.push(frameDurationMs, rms)`, and deterministic `{ voicedMs, silenceMs, isVoiced }` snapshots.
- Produces: `createMockTranscriptionScenario({ sessionId, send, requestClose, config?, script? })` dependency seam used only by tests, not a UI/environment selector.
- Consumes: binary PCM16 little-endian frames and persists Final segments through `mockDb.addSegment`.

- [ ] **Step 1: Write failing voice-activity tests**

```ts
it("does not treat silence or brief noise as speech", () => {
  const detector = new VoiceActivityDetector(DEFAULT_VOICE_ACTIVITY_CONFIG);
  expect(detector.push(40, 0)).toMatchObject({ isVoiced: false, voicedMs: 0 });
  detector.push(40, 0.4);
  expect(detector.push(40, 0)).toMatchObject({ isVoiced: false });
});

it("commits a growing Partial after sustained voice then silence", async () => {
  const scenario = createScenario({
    config: { partialEveryMs: 320, finalSilenceMs: 800, minimumVoiceMs: 120 },
    script: ["이번 주 목표를 확인하겠습니다."],
  });
  await scenario.feed(voicedPcm, 12);
  expect(scenario.eventsOf("TRANSCRIPT_PARTIAL").at(-1)?.text).toContain(
    "목표를"
  );
  await scenario.feed(silentPcm, 20);
  expect(scenario.eventsOf("TRANSCRIPT_FINAL")).toHaveLength(1);
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run lib/mocks/voice-activity.test.ts lib/mocks/transcription-scenario.test.ts`

Expected: FAIL because every binary frame currently advances fixed words and silence has no meaning.

- [ ] **Step 3: Implement pure RMS and adaptive detection**

```ts
export const DEFAULT_VOICE_ACTIVITY_CONFIG = {
  minimumThreshold: 0.018,
  noiseMultiplier: 2.8,
  minimumVoiceMs: 120,
  partialEveryMs: 400,
  finalSilenceMs: 900,
} as const;

export function pcm16Rms(buffer: ArrayBufferLike) {
  const samples = new Int16Array(buffer);
  if (samples.length === 0) return 0;
  let squareSum = 0;
  for (const sample of samples) squareSum += (sample / 32768) ** 2;
  return Math.sqrt(squareSum / samples.length);
}
```

Estimate the initial noise floor with a bounded exponential moving average, choose `max(minimumThreshold, noiseFloor * noiseMultiplier)`, and require `minimumVoiceMs` before declaring speech.

- [ ] **Step 4: Implement seeded coherent Korean scripts**

Store several arrays of complete meeting sentences. Select by a stable hash of `sessionId`, tokenize each sentence by spaces, reveal more tokens every `partialEveryMs` of voiced duration, commit after `finalSilenceMs`, and cycle to the next script after the final sentence.

```ts
const KOREAN_MEETING_SCRIPTS = [
  [
    "오늘 제품 회의에서는 온보딩 개선안을 먼저 확인하겠습니다.",
    "사용자 테스트는 다음 주 화요일까지 다섯 명을 대상으로 진행합니다.",
    "결과를 정리한 뒤 금요일 회의에서 최종 우선순위를 결정하겠습니다.",
  ],
] as const;
```

`TURN_COMMIT`, pause, and complete commit a pending Partial immediately. Pause ignores subsequent binary frames. Every status event includes the active `recordedDurationMs`, and every segment offset uses that active timeline.

- [ ] **Step 5: Verify the complete mock lifecycle**

Run: `rtk pnpm test:run lib/mocks/voice-activity.test.ts lib/mocks/transcription-scenario.test.ts lib/mocks/db.test.ts`

Expected: silence creates nothing; voiced frames grow Partial snapshots; silence commits Final; pause freezes scenario time; resume continues; complete emits Final then completed; persisted Final appears through the REST store.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0.

```bash
rtk git add lib/mocks/voice-activity.ts lib/mocks/voice-activity.test.ts lib/mocks/transcription-scenario.ts lib/mocks/transcription-scenario.test.ts lib/mocks/websocket-handler.ts lib/mocks/db.ts
rtk git commit -m "feat: add microphone-driven mock transcription"
```

### Task 7: Add minimal account and workspace settings flows

**Files:**

- Create: `components/settings/settings-dialog.tsx`
- Create: `components/settings/settings-dialog.test.tsx`
- Create: `components/settings/account-settings-form.tsx`
- Create: `components/settings/account-settings-form.test.tsx`
- Create: `components/settings/workspace-settings-form.tsx`
- Create: `components/settings/workspace-settings-form.test.tsx`
- Modify: `components/workspace/workspace-app-shell.tsx`
- Modify: `components/workspace/workspace-app-shell.test.tsx`

**Interfaces:**

- Produces: `SettingsDialog({ open, onOpenChange, initialSection, workspaceId })` with sections `account | workspace`.
- Consumes: generated User and Workspace hooks from Task 2 and invalidates their generated query keys after mutations.

- [ ] **Step 1: Write failing user and workspace form tests**

```tsx
it("edits only the display name", async () => {
  renderAccountSettings();
  expect(screen.getByDisplayValue("test@heymoa.com")).toBeDisabled();
  await userEvent.clear(screen.getByLabelText("이름"));
  await userEvent.type(screen.getByLabelText("이름"), "김민수");
  await userEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
  expect(updateCurrentUser).toHaveBeenCalledWith({ data: { name: "김민수" } });
});

it("changes default only through the explicit command", async () => {
  renderWorkspaceSettings({ isDefault: false });
  await userEvent.click(
    screen.getByRole("button", { name: "기본 워크스페이스로 설정" })
  );
  expect(setDefaultWorkspace).toHaveBeenCalledWith({
    workspaceId: "01K0000000007",
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/settings`

Expected: FAIL because the settings components do not exist.

- [ ] **Step 3: Implement the two focused forms**

Use React Hook Form and Zod with exact validation:

```ts
const accountSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(80),
});

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "워크스페이스 이름을 입력해 주세요.").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
});
```

Render avatar/email as read-only, keep save feedback adjacent to each form, translate API errors to Korean field/general messages, and disable duplicate submission.

- [ ] **Step 4: Compose the responsive settings dialog**

Desktop uses a rounded large `Dialog`; mobile uses the same content at full viewport dimensions. The navigation contains only `내 계정` and `워크스페이스 일반`. Opening a section must not change the browser route.

- [ ] **Step 5: Verify settings behavior**

Run: `rtk pnpm test:run components/settings components/workspace/workspace-app-shell.test.tsx`

Expected: account save, workspace save, default command, field errors, loading, success feedback, and responsive section switching pass.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0.

```bash
rtk git add components/settings components/workspace/workspace-app-shell.tsx components/workspace/workspace-app-shell.test.tsx
rtk git commit -m "feat: add account and workspace settings"
```

### Task 8: Refine Sidebar, workspace switching, and callback navigation

**Files:**

- Modify: `components/workspace/workspace-sidebar.tsx`
- Modify: `components/workspace/workspace-sidebar.test.tsx`
- Modify: `components/workspace/workspace-app-shell.tsx`
- Modify: `app/auth/callback/page.tsx`
- Create: `app/auth/callback/page.test.tsx`

**Interfaces:**

- Consumes: User/Workspace list state and settings callbacks from Task 7.
- Produces: accessible profile menu, workspace switcher, workspace creation dialog, and explicit settings entry points.
- Navigation rule: selecting a workspace calls `router.push('/w/' + workspaceId)` without calling `setDefaultWorkspace`.

- [ ] **Step 1: Write failing sidebar and callback tests**

```tsx
it("switches workspace without changing the default", async () => {
  renderSidebar();
  await userEvent.click(
    screen.getByRole("button", { name: "워크스페이스 전환" })
  );
  await userEvent.click(screen.getByRole("menuitem", { name: /제품 팀/ }));
  expect(router.push).toHaveBeenCalledWith("/w/01K0000000007");
  expect(setDefaultWorkspace).not.toHaveBeenCalled();
});

it("redirects the callback to the explicit default workspace", async () => {
  renderCallbackWithWorkspaces([
    { workspaceId: "01K0000000007", isDefault: false },
    { workspaceId: "01K0000000000", isDefault: true },
  ]);
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/w/01K0000000000")
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/workspace/workspace-sidebar.test.tsx app/auth/callback/page.test.tsx`

Expected: FAIL because the current sidebar has no workspace list/create/settings behavior and callback uses the legacy default endpoint.

- [ ] **Step 3: Implement the compact Sidebar interactions**

At the top render User identity with a menu containing only `내 계정 설정` and `로그아웃`. Render a separate Workspace switcher listing all workspaces, a default badge, `새 워크스페이스`, and `워크스페이스 설정`. Keep existing Folder CRUD beneath `모든 노트`.

Create workspace through:

```ts
const response = await createWorkspace.mutateAsync({
  data: { name: values.name, description: values.description || null },
});
const workspace = unwrapGeneratedAppResponse<WorkspaceResponse>(response);
await queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
router.push(`/w/${workspace.workspaceId}`);
```

Do not call the default mutation during this flow.

- [ ] **Step 4: Implement callback fallback observability**

Choose `items.find(item => item.isDefault) ?? items[0]`. When fallback is used, call `console.error("DEFAULT_WORKSPACE_MISSING", { workspaceIds })` once before navigation. Show a retry state if the workspace list fails and a create-workspace state if it is empty.

- [ ] **Step 5: Verify interactions and regressions**

Run: `rtk pnpm test:run components/workspace/workspace-sidebar.test.tsx app/auth/callback/page.test.tsx`

Expected: profile settings, logout, switch, create, workspace settings, explicit default badge, callback default/fallback, and existing Folder CRUD tests pass.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0.

```bash
rtk git add components/workspace/workspace-sidebar.tsx components/workspace/workspace-sidebar.test.tsx components/workspace/workspace-app-shell.tsx app/auth/callback/page.tsx app/auth/callback/page.test.tsx
rtk git commit -m "feat: add workspace switching and profile navigation"
```

### Task 9: Polish the dense workspace home and global recording state

**Files:**

- Modify: `components/workspace/workspace-page.tsx`
- Modify: `components/workspace/workspace-toolbar.tsx`
- Modify: `components/workspace/workspace-toolbar.test.tsx`
- Modify: `components/workspace/workspace-note-list.tsx`
- Modify: `components/workspace/workspace-note-list.test.tsx`
- Modify: `components/workspace/note-list-row.tsx`
- Modify: `components/transcription/global-recording-indicator.tsx`
- Create: `components/transcription/global-recording-indicator.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes: `RecordingContextValue.level`, Korean-only `start(noteId)`, generated cursor-page hooks, and Workspace/Folder selection.
- Produces: no-language toolbar, date-grouped accessible list, `다음 노트 불러오기`, contextual active-recording row, and compact actual-level meter.

- [ ] **Step 1: Write failing UI behavior tests**

```tsx
it("has no language controls and starts a Korean-only recording", async () => {
  renderToolbar({ recording: { session: null } });
  expect(screen.queryByText(/영어|자동 감지|언어/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "기록 시작" }));
  expect(start).toHaveBeenCalledWith(expect.any(String));
});

it("renders input level as an accessible meter", () => {
  renderIndicator({ status: "STREAMING", level: 0.42 });
  expect(screen.getByRole("meter", { name: "마이크 입력" })).toHaveAttribute(
    "aria-valuenow",
    "42"
  );
});
```

Extend note-list tests to assert group order, row title/duration/folders/time/executor, pagination callback, loading skeleton, inline retry, and empty state.

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/workspace components/transcription/global-recording-indicator.test.tsx`

Expected: FAIL for language removal, actual meter, pagination/error states, and revised density.

- [ ] **Step 3: Implement editorial home composition**

Remove promotional cards entirely. Use an off-white page canvas and a narrow top toolbar. Render date headings with hairline continuation and rows with compact spacing; use serif-light only for page/display headings. Keep the Sidebar and content surfaces white, rounded 16–24 px, and softly shadowed with existing `--el-*` tokens.

The active-recording row appears only when a session is active and links to `/w/{workspaceId}/notes/{noteId}?view=side&tab=transcript`.

- [ ] **Step 4: Render real input level in both global controls**

Use CSS bars derived from `level`:

```tsx
<span
  role="meter"
  aria-label="마이크 입력"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(level * 100)}
>
  {[0.35, 0.6, 0.85, 0.55].map((weight, index) => (
    <span
      key={index}
      style={{ transform: `scaleY(${Math.max(0.12, level * weight)})` }}
    />
  ))}
</span>
```

Show text for `마이크 대기 중`, `녹음 중`, `일시정지`, permission denial, and device absence. Do not loop animation when level is zero or paused.

- [ ] **Step 5: Verify workspace UI**

Run: `rtk pnpm test:run components/workspace components/transcription/global-recording-indicator.test.tsx`

Expected: all home, toolbar, list, Sidebar regression, and level-meter tests pass.

- [ ] **Step 6: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0 and no unsupported language/promotional copy remains under `/w/**`.

```bash
rtk git add components/workspace components/transcription/global-recording-indicator.tsx components/transcription/global-recording-indicator.test.tsx app/globals.css
rtk git commit -m "feat: refine the editorial workspace home"
```

### Task 10: Refine Note overlay, transcript, and details

**Files:**

- Modify: `components/notes/note-route-surface.tsx`
- Modify: `components/notes/note-view.tsx`
- Modify: `components/notes/note-view.test.tsx`
- Modify: `components/notes/note-panel.tsx`
- Modify: `components/notes/note-panel.test.tsx`
- Modify: `components/notes/transcript-view.tsx`
- Create: `components/notes/transcript-view.test.tsx`
- Modify: `components/notes/note-details.tsx`
- Create: `components/notes/note-details.test.tsx`

**Interfaces:**

- Consumes: URL `view=side|full`, `tab=transcript|details`; Recording context; generated Note/Folder/Session/Segment hooks.
- Produces: one shared `NotePanel`, desktop inset overlay, mobile full-width Drawer, full view, actual SVG/CSS waveform, and immutable Final segment list with deletion.

- [ ] **Step 1: Write failing surface and transcript tests**

```tsx
it("places close and full-view controls at the overlay top-left", () => {
  renderNoteView("?view=side&tab=transcript");
  expect(screen.getByRole("button", { name: "노트 닫기" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "전체 화면으로 보기" })
  ).toHaveAttribute(
    "href",
    expect.stringContaining("view=full&tab=transcript")
  );
});

it("replaces a Partial with its persisted Final", () => {
  renderTranscript({
    partials: [{ itemId: "item-1", text: "결과를", startedAtMs: 1200 }],
    finals: [],
  });
  expect(screen.getByText("결과를")).toHaveAttribute("data-state", "partial");
  emitFinal({ itemId: "item-1", segment: persistedSegment });
  expect(screen.queryByText("결과를")).not.toHaveAttribute(
    "data-state",
    "partial"
  );
  expect(screen.getByText(persistedSegment.text)).toHaveAttribute(
    "data-state",
    "final"
  );
});
```

Add tests for Escape close/focus restoration through the shadcn Sheet/Dialog behavior, `side → full` URL preservation, tab normalization, session boundaries, timer freeze, waveform level, segment delete confirmation, and Details save feedback.

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/notes`

Expected: FAIL for inset overlay chrome, waveform, expanded transcript states, and explicit Details feedback.

- [ ] **Step 3: Implement the overlay and full-view geometry**

Desktop `side` remains a modal Sheet overlay but inset from viewport edges, rounded, bordered, and softly shadowed:

```tsx
className =
  "inset-y-3 right-3 h-[calc(100dvh-1.5rem)] w-[min(780px,calc(100vw-18rem))] overflow-hidden rounded-2xl border border-[var(--el-hairline)] bg-white shadow-[0_12px_36px_rgba(0,0,0,0.10)]";
```

Put close and full-view controls inside `NotePanel` at its top-left. Full view uses the same panel without modal chrome; mobile side uses a full-width/high Drawer. Preserve the underlying note-list scroll and rely on the primitive for focus trap, Escape, and focus restoration.

- [ ] **Step 4: Implement transcript presentation and reconciliation**

Render session boundaries and Final segments in chronological order, a visually distinct live Partial row, and an accessible wide meter/waveform based on actual `level`:

```tsx
<svg role="meter" aria-label="실시간 마이크 파형" viewBox="0 0 320 48">
  {bars.map((weight, index) => (
    <rect
      key={index}
      x={index * 8}
      y={24 - Math.max(2, level * weight * 22)}
      width="4"
      height={Math.max(4, level * weight * 44)}
      rx="2"
    />
  ))}
</svg>
```

On Final, reducer removes the matching `itemId`, upserts by `segmentId`, immediately renders it, then invalidates session/segment/note-list queries. Delete requires confirmation and invalidates the same queries. No segment edit action is rendered.

- [ ] **Step 5: Restrict Details to supported fields**

Show title, context, attached folders, creator, created time, and updated time. Mutations expose `저장 중`, `저장됨`, and a Korean error message. Do not render summaries, generated documents, action items, templates, or language controls.

- [ ] **Step 6: Verify Note behavior**

Run: `rtk pnpm test:run components/notes lib/transcription/transcript-reducer.test.ts`

Expected: overlay/full/mobile selection, URL preservation, focus behavior, level waveform, Partial/Final replacement, session grouping, delete, and Details tests pass.

- [ ] **Step 7: Run commit gates and commit**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: exit 0.

```bash
rtk git add components/notes
rtk git commit -m "feat: refine note overlay and live transcript"
```

### Task 11: Verify recovery, errors, contracts, and browser flows

**Files:**

- Modify: `components/transcription/recording-provider.test.tsx`
- Modify: `lib/transcription/socket.test.ts`
- Modify: `lib/mocks/transcription-scenario.test.ts`
- Modify: `README.md` only if its documented mock commands or supported MVP features are now incorrect.

**Interfaces:**

- Consumes all prior task outputs.
- Produces verified reconnect/error behavior and a clean implementation handoff.

- [ ] **Step 1: Add focused recovery and fatal-error tests**

```ts
it("rehydrates one active session from REST duration and a fresh ticket", async () => {
  renderProviderWithActiveSession({
    status: "PAUSED",
    recordedDurationMs: 12_400,
  });
  await waitFor(() => expect(createTicket).toHaveBeenCalledTimes(1));
  expect(current().elapsedMs).toBe(12_400);
  expect(createSession).not.toHaveBeenCalled();
});

it("keeps persisted Finals after a fatal provider error", () => {
  scenario.emitFinal("첫 번째 결정사항입니다.");
  scenario.fail({ code: "STT_PROVIDER_ERROR", fatal: true });
  expect(mockDb.listSegments(noteId).items).toEqual([
    expect.objectContaining({ text: "첫 번째 결정사항입니다." }),
  ]);
  expect(close).toHaveBeenCalledWith(4500, expect.any(String));
});
```

Cover expired ticket retry with a strict bounded count, no retry for forbidden/missing session/invalid state, FINALIZING duplicate-stop prevention, and consistent global/transcript error copy.

- [ ] **Step 2: Verify focused recovery behavior**

Run: `rtk pnpm test:run components/transcription lib/transcription lib/mocks/transcription-scenario.test.ts`

Expected: all recovery, close-code, timing, persistence, and error tests pass without unhandled promises or timers.

- [ ] **Step 3: Run every contract and build gate**

Run:

```bash
rtk pnpm orval
rtk pnpm asyncapi:validate
rtk pnpm test:run
rtk pnpm lint
rtk pnpm build
```

Expected: every command exits 0. Run `rtk git diff --exit-code lib/api/generated` immediately after `orval`; expected exit 0 proves generated artifacts were already current.

- [ ] **Step 4: Start the clean development server**

Run: `rtk pnpm dev:clean`

Expected: Next.js starts without route, hydration, MSW worker, or WebSocket handler errors. Keep the returned terminal session active for browser verification.

- [ ] **Step 5: Verify the desktop flow at 1440×900**

Use the browser verification skill to exercise:

```text
로그인 callback → explicit default Workspace
→ 새 Workspace 생성 → 전환 (default 불변)
→ Workspace 설정 → 이름/설명 저장 → 기본으로 설정
→ Note 생성 → 기록 시작 → 마이크 허용
→ 소리 입력으로 Partial 성장 → 약 1초 무음으로 Final
→ pause 동안 timer와 waveform 정지 → resume
→ workspace home 이동 중 global recording 유지
→ note side overlay → transcript/details → full view
→ stop → Final REST 재조회 → segment 삭제 확인
```

Expected: URL, focus, timer, meter, mock persistence, and visual hierarchy match the approved design; browser console has no errors.

- [ ] **Step 6: Verify mobile flow at 390×844**

Repeat workspace switch, settings, note open, recording/pause/resume, and stop. Expected: Sidebar is operable, settings is full screen, note side mode becomes a full-width Drawer, controls remain keyboard/touch accessible, and no horizontal overflow occurs.

- [ ] **Step 7: Inspect the final diff and commit**

Run: `rtk git status --short && rtk git diff --check && rtk git diff --stat`

Expected: only intended files are changed; `.superpowers/` remains untracked and is not committed; `git diff --check` emits no whitespace errors.

Run: `rtk pnpm lint && rtk pnpm build`

Expected: both final commit gates exit 0.

```bash
rtk git add README.md components/transcription/recording-provider.test.tsx lib/transcription/socket.test.ts lib/mocks/transcription-scenario.test.ts
rtk git commit -m "test: verify meeting note mvp recovery flows"
```

If `README.md` required no correction and the final task changed only tests already committed with their owning tasks, skip the final commit rather than creating an empty commit.
