# HeyMoa API·Realtime Product Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the Orval REST client, realtime transcription runtime, contract-backed mocks, and authenticated product surfaces with the current `openapi3.yml` and `asyncapi.yml` contracts.

**Architecture:** OpenAPI remains the generated REST boundary and AsyncAPI remains the handwritten WebSocket boundary. A focused protocol/socket/audio layer feeds one global RecordingProvider; stateful REST and WebSocket mocks share persisted transcript state, while workspace, note, recording, and settings components consume only generated hooks and the provider interface.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript 5, Orval 8, TanStack Query 5, Zod 4, MSW 2, Faker 10, Vitest 4, Tailwind CSS 4, Motion 12.

## Global Constraints

- Read relevant guides under `node_modules/next/dist/docs/` before changing App Router code; keep browser APIs and TanStack hooks in focused Client Components.
- Use `proxy.ts`; never create `middleware.ts`.
- All REST calls use Orval-generated functions or hooks from `lib/api/generated/`; never call API endpoints with direct `fetch()`.
- Never manually edit files under `lib/api/generated/`.
- New CSS references use the `--el-*` namespace.
- Display headings use `font-serif font-light` with negative tracking.
- CTA buttons use `rounded-full`; product cards use the project card geometry.
- Gradient orbs remain atmospheric decoration only.
- MSW success responses explicitly set `success: true` and deterministic data.
- Mock user identity remains `userId: "user-12345"`, `name: "테스트 유저"`, `email: "test@heymoa.com"`.
- Preserve the user's current `openapi3.yml` and `asyncapi.yml` contents as authoritative input.
- Prefix shell commands with `rtk`.

---

## File Structure

### Contract and generation boundary

- Modify `lib/api/openapi-contract.test.ts` — lock the bodyless session-start operation and current-user image contract.
- Modify `lib/api/transcription-contract.test.ts` — lock non-null transcript offsets and current end reasons.
- Modify `lib/api/contract-consistency.test.ts` — compare the new AsyncAPI final event with the REST transcript segment.
- Regenerate `lib/api/generated/**` — Orval-owned REST functions, models, MSW handlers, and Faker factories.
- Modify `lib/auth/types.ts` and `lib/auth/server.ts` — keep handwritten auth data and SSR mock aligned with `image`.

### Realtime boundary

- Modify `lib/transcription/protocol.ts` — exact Zod command/event unions for AsyncAPI 3.0.
- Modify `lib/transcription/transcript-reducer.ts` — utterance snapshot replacement and flat final upsert.
- Modify `lib/transcription/socket.ts` — connected handshake, guarded audio, commit/stop, and close lifecycle.
- Keep `lib/transcription/audio.ts` focused on PCM16 24 kHz mono frames; add contract-size guards.
- Modify colocated tests under `lib/transcription/*.test.ts` first.

### Recording orchestration

- Modify `components/transcription/recording-provider.tsx` — bodyless REST session creation and start/commit/stop lifecycle.
- Modify `components/transcription/recording-provider.test.tsx` — lifecycle and cleanup coverage.

### Mock runtime

- Modify `lib/mocks/db.ts` and `lib/mocks/db.test.ts` — deterministic profile image, session conflicts, transcript persistence.
- Modify `lib/mocks/rest-handlers.ts` and its test — bodyless session start and explicit envelopes.
- Modify `lib/mocks/transcription-scenario.ts` and its test — connected/partial/final/completed/error state machine.
- Modify `lib/mocks/websocket-handler.ts` — `/ws/transcription-sessions/:sessionId` link and close codes.
- Modify `lib/mocks/handlers.ts` only if registry ordering changes.

### Product surfaces

- Modify `components/settings/account-settings-form.tsx` and test — image plus initials fallback.
- Modify `components/transcription/global-recording-indicator.tsx` and test — commit/stop actions without pause.
- Modify `components/workspace/workspace-toolbar.tsx`, `workspace-page.tsx`, `workspace-note-list.tsx`, `note-list-row.tsx` and tests — contract-led workspace hierarchy and states.
- Modify `components/notes/note-panel.tsx`, `note-route-surface.tsx`, `transcript-view.tsx` and tests — transcript-first layout and new live event shapes.

---

### Task 1: Validate contracts and regenerate Orval output

**Files:**

- Modify: `lib/api/openapi-contract.test.ts`
- Modify: `lib/api/transcription-contract.test.ts`
- Modify: `lib/api/contract-consistency.test.ts`
- Regenerate: `lib/api/generated/**`
- Modify: `lib/auth/types.ts`
- Modify: `lib/auth/server.ts`
- Source: `openapi3.yml`
- Source: `asyncapi.yml`

**Interfaces:**

- Consumes: OpenAPI operation `startTranscriptionSession(noteId)` with no request body; `CurrentUserResponseData.image: string | null`; non-null transcript offsets.
- Produces: generated `startTranscriptionSession(noteId, options?)`, generated current-user and transcript models, generated MSW/Faker artifacts.

- [ ] **Step 1: Add failing contract assertions**

Add these assertions before regeneration:

```ts
// lib/api/openapi-contract.test.ts
const contract = document.toJS() as {
  paths: Record<string, Record<string, { requestBody?: unknown }>>;
  components: {
    schemas: {
      CurrentUserResponse: { properties: { data: { required: string[] } } };
      StartTranscriptionSessionResponse: {
        properties: {
          data: { properties: { endReason: { enum: string[] } } };
        };
      };
    };
  };
};

expect(
  contract.paths["/v1/notes/{noteId}/transcription-sessions"].post.requestBody
).toBeUndefined();
expect(
  contract.components.schemas.CurrentUserResponse.properties.data.required
).toContain("image");
expect(
  contract.components.schemas.StartTranscriptionSessionResponse.properties.data
    .properties.endReason.enum
).toEqual([
  "READY_TIMEOUT",
  "CLIENT_DISCONNECTED",
  "CLIENT_PROTOCOL_ERROR",
  "OPENAI_ERROR",
  "INTERNAL_ERROR",
]);

// lib/api/transcription-contract.test.ts
const segment: TranscriptResponseDataSegmentsItem = {
  segmentId: "0HZX2K7M9Q4AH",
  transcriptionSessionId: "0HZX2K7M9Q4AG",
  sequence: 1,
  text: "확정된 문장",
  startedAtMs: 0,
  endedAtMs: 1200,
};
expect(segment.startedAtMs).toBe(0);
expect(segment.endedAtMs).toBe(1200);
```

- [ ] **Step 2: Run contract tests to expose stale generated types**

Run: `rtk pnpm test:run lib/api/openapi-contract.test.ts lib/api/transcription-contract.test.ts lib/api/contract-consistency.test.ts`

Expected: OpenAPI structural assertions pass; REST/Async consistency fails because its mapping still describes the previous nested final event. The stale generated boundary is independently proven in Step 4 by the removed request model and generated diff.

- [ ] **Step 3: Validate both source contracts**

Run: `rtk pnpm exec orval --version && rtk pnpm asyncapi:validate`

Expected: Orval reports `8.16.0`; AsyncAPI validation exits `0` for version `3.0.0`.

- [ ] **Step 4: Regenerate all Orval-owned output**

Run: `rtk pnpm orval`

Expected: generation succeeds, removes `startTranscriptionSessionRequest*`, updates `currentUserResponseData.ts`, and rewrites tag-level `.ts`, `.msw.ts`, and `.faker.ts` files.

- [ ] **Step 5: Update the cross-contract final-segment assertion**

Replace the old nested-event comparison with the current flat final payload:

```ts
const restRequired = [
  ...rest.TranscriptResponse.properties.data.properties.segments.items.required,
]
  .filter((field) => field !== "transcriptionSessionId")
  .sort();
const socketRequired = [
  ...asyncapi.components.messages.FinalEvent.payload.required,
]
  .filter((field) => !["type", "utteranceId"].includes(field))
  .sort();

expect(socketRequired).toEqual(restRequired);
```

- [ ] **Step 6: Align handwritten auth data**

Use one nullable image field in both runtime type and SSR mock:

```ts
export type AuthUser = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
};

const mockUser: AuthUser = {
  userId: "user-12345",
  name: "테스트 유저",
  email: "test@heymoa.com",
  image: "https://images.heymoa.test/users/test-user.png",
};
```

- [ ] **Step 7: Verify generated and auth contracts**

Run: `rtk pnpm test:run lib/api lib/auth && rtk pnpm lint`

Expected: all selected tests pass and ESLint exits `0`.

- [ ] **Step 8: Commit the REST boundary**

```bash
git add openapi3.yml asyncapi.yml lib/api/generated lib/api/*.test.ts lib/auth/types.ts lib/auth/server.ts
git commit -m "feat(api): sync generated clients with current contracts"
```

### Task 2: Replace the handwritten realtime protocol and reducer

**Files:**

- Modify: `lib/transcription/protocol.ts`
- Modify: `lib/transcription/protocol.test.ts`
- Modify: `lib/transcription/protocol.examples.test.ts`
- Modify: `lib/transcription/transcript-reducer.ts`
- Modify: `lib/transcription/transcript-reducer.test.ts`

**Interfaces:**

- Produces: `ClientCommand`, `ServerEvent`, `RealtimeFinalSegment`, `parseClientCommand(raw)`, `parseServerEvent(raw)`, `TranscriptState` keyed by `utteranceId`.
- Consumes: exact JSON shapes from `asyncapi.yml`.

- [ ] **Step 1: Write failing protocol examples**

```ts
expect(parseClientCommand('{"type":"commit"}')).toEqual({ type: "commit" });
expect(parseClientCommand('{"type":"stop"}')).toEqual({ type: "stop" });
expect(() => parseClientCommand('{"type":"SESSION_PAUSE"}')).toThrow();
expect(
  parseServerEvent(
    JSON.stringify({
      type: "final",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "확정된 문장",
      startedAtMs: 0,
      endedAtMs: 1200,
    })
  )
).toMatchObject({ type: "final", sequence: 1 });
```

- [ ] **Step 2: Run protocol tests and verify they fail**

Run: `rtk pnpm test:run lib/transcription/protocol.test.ts lib/transcription/protocol.examples.test.ts`

Expected: failures reference rejected lowercase command/event types.

- [ ] **Step 3: Implement the exact Zod unions**

```ts
export const clientCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("commit") }),
  z.strictObject({ type: z.literal("stop") }),
]);

const finalEventSchema = z.strictObject({
  type: z.literal("final"),
  segmentId: tsidSchema,
  utteranceId: tsidSchema,
  sequence: z.number().int().min(1),
  text: z.string().min(1),
  startedAtMs: z.number().int().min(0),
  endedAtMs: z.number().int().min(0),
});

export const serverEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("connected"), sessionId: tsidSchema }),
  z.strictObject({
    type: z.literal("partial"),
    utteranceId: tsidSchema,
    text: z.string().min(1),
  }),
  finalEventSchema,
  z.strictObject({ type: z.literal("completed"), sessionId: tsidSchema }),
  z.strictObject({
    type: z.literal("error"),
    code: z.enum([
      "INVALID_CLIENT_MESSAGE",
      "INVALID_AUDIO_FRAME",
      "OPENAI_CONNECTION_FAILED",
      "OPENAI_TRANSCRIPTION_FAILED",
      "INTERNAL_ERROR",
    ]),
    message: z.string().min(1),
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type RealtimeFinalSegment = z.infer<typeof finalEventSchema>;
```

- [ ] **Step 4: Write failing reducer tests**

```ts
const partial = transcriptReducer(initialTranscriptState, {
  type: "partial",
  utteranceId: "0HZX2K7M9Q4AC",
  text: "첫 snapshot",
});
const replaced = transcriptReducer(partial, {
  type: "partial",
  utteranceId: "0HZX2K7M9Q4AC",
  text: "누적 snapshot",
});
expect(replaced.partialByUtteranceId["0HZX2K7M9Q4AC"]).toBe("누적 snapshot");
```

- [ ] **Step 5: Implement reducer state around utterance IDs**

```ts
export type TranscriptState = {
  partialByUtteranceId: Record<string, string>;
  finalSegments: RealtimeFinalSegment[];
  completed: boolean;
};

if (event.type === "final") {
  const partialByUtteranceId = { ...state.partialByUtteranceId };
  delete partialByUtteranceId[event.utteranceId];
  const finalSegments = state.finalSegments
    .filter((segment) => segment.segmentId !== event.segmentId)
    .concat(event)
    .sort((a, b) => a.sequence - b.sequence);
  return { ...state, partialByUtteranceId, finalSegments };
}
if (event.type === "completed") return { ...state, completed: true };
```

- [ ] **Step 6: Verify and commit the protocol boundary**

Run: `rtk pnpm test:run lib/transcription/protocol.test.ts lib/transcription/protocol.examples.test.ts lib/transcription/transcript-reducer.test.ts`

Expected: all selected tests pass.

```bash
git add lib/transcription/protocol.ts lib/transcription/protocol*.test.ts lib/transcription/transcript-reducer.ts lib/transcription/transcript-reducer.test.ts
git commit -m "feat(transcription): align protocol with AsyncAPI"
```

### Task 3: Enforce the socket and PCM transport contract

**Files:**

- Modify: `lib/transcription/socket.ts`
- Modify: `lib/transcription/socket.test.ts`
- Modify: `lib/transcription/audio.ts`
- Modify: `lib/transcription/audio.test.ts`

**Interfaces:**

- Consumes: `ServerEvent`, `ClientCommand` from Task 2.
- Produces: `TranscriptionSocket.connect()`, `sendAudio(chunk)`, `commit()`, `stop()`, `close()` and contract-valid PCM frames.

- [ ] **Step 1: Write failing socket lifecycle tests**

```ts
const connected = socket.connect();
transport.emitMessage(
  JSON.stringify({
    type: "connected",
    sessionId: "0HZX2K7M9Q4AB",
  })
);
await expect(connected).resolves.toBeUndefined();

socket.commit();
socket.stop();
expect(transport.sent).toContain('{"type":"commit"}');
expect(transport.sent).toContain('{"type":"stop"}');
```

Also assert `sendAudio(new ArrayBuffer(2))` sends nothing before `connected`, and a malformed server event closes with client close code `1008`.

- [ ] **Step 2: Run transport tests and verify they fail**

Run: `rtk pnpm test:run lib/transcription/socket.test.ts lib/transcription/audio.test.ts`

Expected: socket tests fail on old `SESSION_READY` and uppercase commands.

- [ ] **Step 3: Implement a connected-state socket**

```ts
private connected = false;

if (event.type === "connected" && !this.connected) {
  this.connected = true;
  resolve();
}
if (event.type === "completed") socket.close(1000, "completed");

sendAudio(chunk: ArrayBuffer) {
  if (!this.connected || chunk.byteLength < 2 || chunk.byteLength > 1_048_576 || chunk.byteLength % 2 !== 0) return;
  if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(chunk);
}

commit() { this.sendCommand({ type: "commit" }); }
stop() { this.sendCommand({ type: "stop" }); }
```

- [ ] **Step 4: Lock audio defaults and maximum frame behavior**

Add assertions that default output is 24 kHz mono PCM16 and every emitted batch is non-empty, even-sized, and at most 1 MiB. Keep the existing 40 ms default batch because it produces 1,920-byte frames at 24 kHz.

```ts
expect(chunk.byteLength).toBe(24_000 * 0.04 * 2);
expect(chunk.byteLength % 2).toBe(0);
expect(chunk.byteLength).toBeLessThanOrEqual(1_048_576);
```

- [ ] **Step 5: Verify and commit transport**

Run: `rtk pnpm test:run lib/transcription/audio.test.ts lib/transcription/socket.test.ts`

Expected: all transport tests pass.

```bash
git add lib/transcription/audio.ts lib/transcription/audio.test.ts lib/transcription/socket.ts lib/transcription/socket.test.ts
git commit -m "feat(transcription): implement connected PCM transport"
```

### Task 4: Rebuild RecordingProvider around start, commit, and stop

**Files:**

- Modify: `components/transcription/recording-provider.tsx`
- Modify: `components/transcription/recording-provider.test.tsx`

**Interfaces:**

- Consumes: generated bodyless session-start hook; `TranscriptionSocket` from Task 3.
- Produces: `RecordingContextValue` with `phase`, `start(noteId)`, `commit()`, `stop()`; no pause/resume API.

- [ ] **Step 1: Write failing provider lifecycle tests**

```ts
expect(api.startSession).toHaveBeenCalledWith("0HZX2K7M9Q4AF");
expect(screen.getByTestId("phase")).toHaveTextContent("connecting");

act(() =>
  runtime.socket.emit({
    type: "connected",
    sessionId: "0HZX2K7M9Q4AG",
  })
);
expect(screen.getByTestId("phase")).toHaveTextContent("recording");

await user.click(screen.getByRole("button", { name: "구간 확정" }));
expect(runtime.socket.commit).toHaveBeenCalledOnce();
```

Assert stop calls `audio.stop()` before `socket.stop()`, waits for `completed`, invalidates the transcript query, and cleans resources after close `1011`.

- [ ] **Step 2: Run the provider test and verify it fails**

Run: `rtk pnpm test:run components/transcription/recording-provider.test.tsx`

Expected: failures reference the old audio-format mutation payload and pause/resume context methods.

- [ ] **Step 3: Replace context state and API**

```ts
export type RecordingPhase =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "recording"
  | "stopping"
  | "completed"
  | "failed";

type RecordingContextValue = {
  session: LocalRecordingSession | null;
  phase: RecordingPhase;
  transcript: TranscriptState;
  elapsedMs: number;
  level: number;
  levelHistory: number[];
  error: string | null;
  start: (noteId: string) => Promise<void>;
  commit: () => void;
  stop: () => Promise<void>;
};
```

- [ ] **Step 4: Use the generated bodyless mutation and new URL**

```ts
const response = await startSessionMutation.mutateAsync({ noteId });
const socketUrl = `${wsBaseUrl}/ws/transcription-sessions/${connectionSession.sessionId}`;
```

Set `phase` to `recording` only after `socket.connect()` resolves on `connected`. Start audio afterward so no frame can precede the handshake.

- [ ] **Step 5: Implement terminal handling and bounded stop**

```ts
const commit = useCallback(() => socketRef.current?.commit(), []);

const stop = useCallback(async () => {
  setPhase("stopping");
  await audioRef.current?.stop();
  clearLevel();
  await Promise.race([
    new Promise<void>((resolve) => {
      stopResolveRef.current = resolve;
      socketRef.current?.stop();
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, 11_000)),
  ]);
  socketRef.current?.close();
  if (sessionRef.current)
    invalidateTranscriptQueries(sessionRef.current.noteId);
}, [clearLevel, invalidateTranscriptQueries]);
```

Map `error` events and close `1008`/`1011` to `failed`, preserve the server message, stop audio, and invalidate the note transcript.

- [ ] **Step 6: Verify and commit provider orchestration**

Run: `rtk pnpm test:run components/transcription/recording-provider.test.tsx lib/transcription`

Expected: all selected tests pass.

```bash
git add components/transcription/recording-provider.tsx components/transcription/recording-provider.test.tsx
git commit -m "feat(recording): adopt bodyless realtime session lifecycle"
```

### Task 5: Synchronize stateful REST mocks and deterministic Faker fixtures

**Files:**

- Modify: `lib/mocks/db.ts`
- Modify: `lib/mocks/db.test.ts`
- Modify: `lib/mocks/rest-handlers.ts`
- Modify: `lib/mocks/rest-handlers.test.ts`
- Modify: `lib/mocks/handlers.ts`

**Interfaces:**

- Consumes: regenerated model, MSW, and Faker exports from Task 1.
- Produces: deterministic CRUD/session/transcript REST behavior with explicit success envelopes.

- [ ] **Step 1: Write failing REST mock tests**

```ts
expect(mockDb.user.image).toBe(
  "https://images.heymoa.test/users/test-user.png"
);

const response = await fetch(
  `http://localhost/v1/notes/${note.noteId}/transcription-sessions`,
  { method: "POST" }
);
expect(response.status).toBe(201);
expect(await response.json()).toMatchObject({ success: true, error: null });

const conflict = await fetch(
  `http://localhost/v1/notes/${note.noteId}/transcription-sessions`,
  { method: "POST" }
);
expect(conflict.status).toBe(409);
```

- [ ] **Step 2: Run mock tests and verify they fail**

Run: `rtk pnpm test:run lib/mocks/db.test.ts lib/mocks/rest-handlers.test.ts`

Expected: the bodyless session request or new image assertion fails against stale mock behavior.

- [ ] **Step 3: Seed deterministic contract states**

Use Faker only for varied content fields and fix identity/status fields:

```ts
faker.seed(20260715);
const user = {
  userId: "user-12345",
  name: "테스트 유저",
  email: "test@heymoa.com",
  image: "https://images.heymoa.test/users/test-user.png",
};
```

Seed exactly two workspaces, four projects (two in each workspace), four notes (one empty, one completed with three segments, one available for a new session, and one unrelated note), and no active session at reset. Store every transcript offset as a non-null integer; the first successful session-start request creates the single active session used by the conflict test.

- [ ] **Step 4: Remove request-body parsing from session creation**

```ts
http.post("*/v1/notes/:noteId/transcription-sessions", ({ params }) => {
  const noteId = String(params.noteId);
  const session = mockDb.createSession(noteId);
  return HttpResponse.json(
    { success: true, data: session, error: null },
    { status: 201 }
  );
});
```

Catch the active-session domain error and return the contract's explicit 409 envelope with code `ACTIVE_TRANSCRIPTION_SESSION`.

- [ ] **Step 5: Audit every registered handler envelope**

Run: `rtk rg -n 'faker\.datatype\.boolean|success:\s*faker|success:\s*false' lib/mocks lib/api/generated/*.msw.ts lib/api/generated/*/*.msw.ts`

Expected: generated files may contain factory randomness; manually registered success handlers under `lib/mocks/` contain no random success values, and `success: false` appears only in deliberate error envelopes.

- [ ] **Step 6: Verify and commit REST mocks**

Run: `rtk pnpm test:run lib/mocks/db.test.ts lib/mocks/rest-handlers.test.ts && rtk pnpm lint`

Expected: selected tests and lint pass.

```bash
git add lib/mocks/db.ts lib/mocks/db.test.ts lib/mocks/rest-handlers.ts lib/mocks/rest-handlers.test.ts lib/mocks/handlers.ts
git commit -m "feat(mocks): sync deterministic REST scenarios"
```

### Task 6: Replace the MSW WebSocket scenario

**Files:**

- Modify: `lib/mocks/transcription-scenario.ts`
- Modify: `lib/mocks/transcription-scenario.test.ts`
- Modify: `lib/mocks/websocket-handler.ts`

**Interfaces:**

- Consumes: command/event unions from Task 2 and transcript persistence from Task 5.
- Produces: `MockTranscriptionScenario.open()`, `receiveFrame(frame)`, and `dispose()` with connected, explicit commit, 15-second auto-commit, stop-drain, 1008 protocol failure, and 1011 upstream failure behavior.

- [ ] **Step 1: Write failing scenario tests**

```ts
const send = vi.fn();
const requestClose = vi.fn();
const scenario = createMockTranscriptionScenario({
  sessionId: session.sessionId,
  send,
  requestClose,
  script: ["자동 확정 문장"],
});

scenario.open();
expect(send).toHaveBeenCalledWith({
  type: "connected",
  sessionId: session.sessionId,
});

const fifteenSecondsOfSpeech = new Int16Array(24_000 * 15);
fifteenSecondsOfSpeech.fill(12_000);
await scenario.receiveFrame(fifteenSecondsOfSpeech.buffer);
expect(send).toHaveBeenCalledWith(
  expect.objectContaining({ type: "final", sequence: 1 })
);

await scenario.receiveFrame('{"type":"stop"}');
expect(send).toHaveBeenLastCalledWith({
  type: "completed",
  sessionId: session.sessionId,
});
```

Also test invalid odd-byte audio → `INVALID_AUDIO_FRAME`/1008 and configured OpenAI failure → `OPENAI_TRANSCRIPTION_FAILED`/1011.
Send two voiced chunks before commit and assert the two `partial` calls share one `utteranceId`, with the second text containing the first snapshot.

- [ ] **Step 2: Run scenario tests and verify they fail**

Run: `rtk pnpm test:run lib/mocks/transcription-scenario.test.ts`

Expected: failures reference removed SESSION_STATUS/pause/resume behavior.

- [ ] **Step 3: Implement the minimal scenario states**

```ts
type ScenarioPhase = "connecting" | "recording" | "stopping" | "closed";

open() {
  if (this.phase !== "connecting") return;
  this.phase = "recording";
  this.send({ type: "connected", sessionId: this.sessionId });
}

private receiveCommand(command: ClientCommand) {
  if (this.phase !== "recording") return this.protocolError();
  if (command.type === "commit") this.commitBufferedAudio();
  if (command.type === "stop") {
    this.commitBufferedAudio();
    this.phase = "stopping";
    this.send({ type: "completed", sessionId: this.sessionId });
    this.requestClose(1000, "completed");
    this.phase = "closed";
  }
}
```

Track `bufferedBytes`; auto-commit at `24_000 * 2 * 15`. For each final, call `mockDb.appendTranscriptSegment()` with the same segment ID, sequence, text, and offsets emitted over the socket.

- [ ] **Step 4: Bind the current WebSocket path and close codes**

```ts
const transcriptionLink = ws.link(/\/ws\/transcription-sessions\/[^/?]+$/);
```

Extract `sessionId` from the final pathname segment, create the scenario with `send: (event) => client.send(JSON.stringify(event))` and `requestClose: (code, reason) => client.close(code, reason)`, then call `scenario.open()`. Forward every client message to `scenario.receiveFrame(event.data)`. The scenario sends `error` before requesting close `1008` or `1011`, and sends `completed` before requesting close `1000`.

- [ ] **Step 5: Verify and commit WebSocket mocks**

Run: `rtk pnpm test:run lib/mocks/transcription-scenario.test.ts lib/mocks/rest-handlers.test.ts lib/transcription`

Expected: scenario, shared persistence, and protocol tests all pass.

```bash
git add lib/mocks/transcription-scenario.ts lib/mocks/transcription-scenario.test.ts lib/mocks/websocket-handler.ts
git commit -m "feat(mocks): model current realtime transcription protocol"
```

### Task 7: Update account and global recording controls

**Files:**

- Modify: `components/settings/account-settings-form.tsx`
- Modify: `components/settings/account-settings-form.test.tsx`
- Modify: `components/transcription/global-recording-indicator.tsx`
- Modify: `components/transcription/global-recording-indicator.test.tsx`

**Interfaces:**

- Consumes: `CurrentUserResponseData.image`; RecordingProvider `phase`, `commit`, `stop`.
- Produces: accessible profile image fallback and route-persistent recording controls.

- [ ] **Step 1: Write failing UI tests**

```ts
expect(screen.getByRole("img", { name: "테스트 유저 프로필" })).toHaveAttribute(
  "src",
  expect.stringContaining("test-user.png")
);
expect(screen.getByRole("button", { name: "구간 확정" })).toBeEnabled();
expect(screen.getByRole("button", { name: "녹음 종료" })).toBeEnabled();
expect(
  screen.queryByRole("button", { name: /일시 정지|재개/ })
).not.toBeInTheDocument();
```

- [ ] **Step 2: Run UI tests and verify they fail**

Run: `rtk pnpm test:run components/settings/account-settings-form.test.tsx components/transcription/global-recording-indicator.test.tsx`

Expected: avatar image and commit button are absent; pause button is still present.

- [ ] **Step 3: Render image with initials fallback**

```tsx
<Avatar className="size-12">
  {user?.image ? (
    <AvatarImage src={user.image} alt={`${user.name} 프로필`} />
  ) : null}
  <AvatarFallback>{user?.name.slice(0, 1) ?? "나"}</AvatarFallback>
</Avatar>
```

- [ ] **Step 4: Replace global pause with commit**

```tsx
<Button type="button" variant="ghost" size="sm" onClick={commit} className="rounded-full">
  <Scissors className="size-3.5" /> 구간 확정
</Button>
<Button type="button" variant="ghost" size="icon-sm" aria-label="녹음 종료" onClick={() => void stop()} className="rounded-full">
  <Square className="size-3.5" />
</Button>
```

Derive labels from `phase`: connecting → `연결 중`, recording → `녹음 중`, stopping → `마무리 중`, failed → `연결 오류`.

- [ ] **Step 5: Verify and commit global controls**

Run: `rtk pnpm test:run components/settings/account-settings-form.test.tsx components/transcription/global-recording-indicator.test.tsx`

Expected: both component suites pass.

```bash
git add components/settings/account-settings-form.tsx components/settings/account-settings-form.test.tsx components/transcription/global-recording-indicator.tsx components/transcription/global-recording-indicator.test.tsx
git commit -m "feat(ui): surface profile image and commit controls"
```

### Task 8: Recompose workspace and note surfaces around the contract

**Files:**

- Modify: `components/workspace/workspace-page.tsx`
- Create: `components/workspace/workspace-page.test.tsx`
- Modify: `components/workspace/workspace-toolbar.tsx`
- Modify: `components/workspace/workspace-toolbar.test.tsx`
- Modify: `components/workspace/workspace-note-list.tsx`
- Modify: `components/workspace/workspace-note-list.test.tsx`
- Modify: `components/workspace/note-list-row.tsx`
- Modify: `components/notes/note-panel.tsx`
- Modify: `components/notes/note-panel.test.tsx`
- Modify: `components/notes/note-route-surface.tsx`
- Modify: `components/notes/transcript-view.tsx`
- Modify: `components/notes/transcript-view.test.tsx`

**Interfaces:**

- Consumes: generated workspace/project/note/transcript hooks and RecordingProvider from Task 4.
- Produces: project-aware workspace header, transcript-first note layout, utterance partial replacement, and final merge by segment ID.

- [ ] **Step 1: Write failing workspace behavior tests**

```ts
expect(screen.getByText("Meeting notes")).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "모바일 앱" })).toBeInTheDocument();
expect(screen.getByText("2개의 회의 기록")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "새 회의" })).toHaveClass(
  "rounded-full"
);
```

For an empty project assert the explanation and the same `새 회의` action are rendered; for query failure assert `다시 시도` refetches.

- [ ] **Step 2: Write failing transcript behavior tests**

```ts
expect(screen.getByText("누적 snapshot")).toBeInTheDocument();
expect(screen.queryByText("첫 snapshot")).not.toBeInTheDocument();
expect(
  screen.getAllByTestId("final-segment").map((row) => row.dataset.sequence)
).toEqual(["1", "2"]);
expect(
  screen.queryByRole("button", { name: /일시 정지|재개/ })
).not.toBeInTheDocument();
```

- [ ] **Step 3: Run the affected UI suites and verify they fail**

Run: `rtk pnpm test:run components/workspace components/notes`

Expected: failures reference old toolbar labels, old provider methods, and `partialByItemId`.

- [ ] **Step 4: Recompose the workspace header and list states**

Move the workspace-route create action from the generic toolbar into `WorkspacePage`. Query the selected project's notes there, derive `projectName` and `noteCount`, and use this editorial header with a pill CTA. Keep note-route recording controls in `WorkspaceToolbar`:

```tsx
<header className="mb-8 flex flex-col gap-5 border-b border-[var(--el-hairline)] pb-7 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--el-muted)]">
      Meeting notes
    </p>
    <h2 className="mt-2 font-serif text-4xl font-light tracking-[-0.035em] text-[var(--el-ink)]">
      {projectName}
    </h2>
    <p className="mt-2 text-sm text-[var(--el-muted)]">
      {noteCount}개의 회의 기록
    </p>
  </div>
  <Button className="rounded-full" onClick={() => void handleCreateMeeting()}>
    <Mic /> 새 회의
  </Button>
</header>
```

`handleCreateMeeting()` uses the existing `useCreateNote` mutation with `{ projectId: targetProjectId, data: { title: "실시간 기록 노트" } }`, navigates to the returned note route, and calls `recording.start(noteId)`. Pass the already resolved notes into `WorkspaceNoteList` so the header and list do not issue duplicate note queries.

Keep skeleton, error alert, and empty state visually distinct. Note rows show title and updated time. Add a `기록 중` badge only when the active RecordingProvider session has the same `noteId`; do not infer a completed-transcript status because `NoteListResponseDataNotesItem` has no such field.

- [ ] **Step 5: Replace workspace recording actions**

Remove Pause/Play imports and context calls. While recording, render `구간 확정`, `녹음 종료`, elapsed time, and input meter. While idle, render `새 회의` and `새 노트` using the existing `useCreateNote` hook.

```tsx
<Button variant="outline" className="rounded-full" onClick={commit}>구간 확정</Button>
<Button variant="outline" className="rounded-full" onClick={() => void stop()}>녹음 종료</Button>
```

- [ ] **Step 6: Make transcript data model-independent at render time**

Normalize persisted and live final data into a local view type:

```ts
type TranscriptRow = {
  segmentId: string;
  sequence: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
};

const rows = new Map<string, TranscriptRow>();
persisted.forEach((segment) => rows.set(segment.segmentId, segment));
if (liveForNote)
  recording.transcript.finalSegments.forEach((segment) =>
    rows.set(segment.segmentId, segment)
  );
const orderedSegments = [...rows.values()].sort(
  (a, b) => a.sequence - b.sequence
);
```

Render partial rows from `partialByUtteranceId`, with `전사 중` badge and no fabricated start offset. Render final rows with `data-testid="final-segment"`, `data-sequence`, and formatted `startedAtMs`.

- [ ] **Step 7: Make the note layout transcript-first**

On desktop, place `TranscriptView` in the wider main column and note details in the narrower secondary panel. On mobile, keep tabs but order `원본 전사` before `회의 정보` and normalize an absent/invalid tab query to `transcript`.

```tsx
<div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
  <TranscriptView noteId={noteId} />
  <aside className="border-l border-[var(--el-hairline)]">
    <NoteDetails noteId={noteId} />
  </aside>
</div>
```

- [ ] **Step 8: Verify and commit product surfaces**

Run: `rtk pnpm test:run components/workspace components/notes components/transcription components/settings`

Expected: all affected component suites pass.

```bash
git add components/workspace components/notes components/transcription/global-recording-indicator.tsx components/settings/account-settings-form.tsx
git commit -m "feat(ui): recompose contract-backed meeting surfaces"
```

### Task 9: Run complete verification and audit generated/manual boundaries

**Files:**

- Modify only files required by failures attributable to Tasks 1–8.
- Verify: all source, generated, mock, and UI files named above.

**Interfaces:**

- Consumes: every deliverable from Tasks 1–8.
- Produces: repository-wide evidence that the current contracts, runtime, mocks, and product surfaces agree.

- [ ] **Step 1: Search for removed protocol concepts**

Run: `rtk rg -n 'SESSION_PAUSE|SESSION_RESUME|SESSION_READY|SESSION_STATUS|TRANSCRIPT_PARTIAL|TRANSCRIPT_FINAL|SESSION_COMPLETED|mock-ticket|connection-ticket|/v1/transcription-sessions/.*/stream|partialByItemId|pause\(|resume\(' app components lib --glob '!lib/api/generated/**' || true`

Expected: no runtime matches; historical design/plan documents are outside the searched paths.

- [ ] **Step 2: Search for forbidden REST and mock patterns**

Run: `rtk rg -n 'fetch\(.*\/v1\/' app components lib --glob '!lib/api/fetcher.ts' --glob '!lib/mocks/**' || true`

Run: `rtk rg -n 'success:\s*faker|faker\.datatype\.boolean' lib/mocks || true`

Expected: both searches return no matches.

- [ ] **Step 3: Validate generated artifacts**

Run: `rtk pnpm orval && rtk git diff --exit-code -- lib/api/generated`

Expected: regeneration succeeds and produces no generated diff, proving the committed output is reproducible.

- [ ] **Step 4: Run the complete automated test suite**

Run: `rtk pnpm test:run`

Expected: every Vitest suite passes with zero failed tests.

- [ ] **Step 5: Run project-required verification**

Run: `rtk pnpm lint && rtk pnpm build`

Expected: ESLint exits `0`; Next.js 16 production build completes successfully.

- [ ] **Step 6: Inspect the final diff and repository status**

Run: `rtk git diff --check && rtk git status --short && rtk git diff --stat HEAD~8..HEAD`

Expected: no whitespace errors; only intended contract, generated, realtime, mock, UI, test, design, and plan files are changed or committed.
