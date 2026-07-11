# Workspace and Note App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the meeting-note MVP's prototype screens with a responsive workspace app shell that uses shadcn components, a desktop Note Sheet, a mobile Note Drawer, a full-page Note view, and global recording controls.

**Architecture:** `/w/**` gets an independent client-side `WorkspaceAppShell` that owns workspace navigation and note-list presentation while existing Orval hooks remain the only REST data layer. `NoteRouteSurface` interprets the canonical URL and renders one shared `NotePanel` inside a desktop Sheet, mobile Drawer, or full-page container; `RecordingProvider` remains above routing so recording survives all surface changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui with Base UI, TanStack Query, Orval-generated hooks, MSW, Vitest, Testing Library, Lucide.

## Global Constraints

- Preserve `/w/{workspaceId}/notes/{noteId}?view=side|full&tab=transcript|details`.
- Use only Workspace, Folder, Note, TranscriptionSession, and TranscriptSegment APIs already present in `openapi3.yml`.
- Do not add Workspace/member management, participant, private/team visibility, search API, templates, AI documents, summaries, chatbot, audio storage, or TranscriptSegment editing.
- Keep exactly one active TranscriptionSession connection; pause and resume stay in the same session.
- Closing a Sheet or Drawer must never stop an active recording.
- Do not edit `lib/api/generated/**` manually.
- Prefix every shell command with `rtk`.
- Run `pnpm lint && pnpm build` before every commit.

---

## File Structure

### App shell

- Create `components/workspace/workspace-app-shell.tsx`: persistent responsive shell and shared data ownership.
- Create `components/workspace/workspace-sidebar.tsx`: workspace/user navigation and Folder CRUD UI.
- Create `components/workspace/workspace-toolbar.tsx`: location, language, create-note, and global recording controls.
- Create `components/workspace/workspace-note-list.tsx`: date groups, rows, loading, empty, and error states.
- Create `components/workspace/note-list-row.tsx`: one accessible Note summary and row actions.
- Replace `components/workspace/workspace-page.tsx`: thin composition wrapper or remove after callers migrate.

### Note surfaces

- Create `components/notes/note-route-surface.tsx`: query state and responsive Sheet/Drawer/full selection.
- Create `components/notes/note-panel.tsx`: shared Note header and Tabs content.
- Modify `components/notes/note-view.tsx`: retain query normalization export and delegate rendering.
- Modify `components/notes/note-details.tsx`: shadcn form controls, folder multi-select, explicit feedback.
- Modify `components/notes/transcript-view.tsx`: session selector, Final/Partial visuals, recording bar, deletion dialog.

### Shared UI and chrome

- Add shadcn source files under `components/ui/`: `alert`, `alert-dialog`, `badge`, `dialog`, `drawer`, `input`, `label`, `popover`, `scroll-area`, `select`, `sheet`, `sidebar`, `skeleton`, `tabs`, `textarea`, `tooltip`, and `command`.
- Modify `components/NavbarGate.tsx`: hide marketing Navbar on `/w/**`.
- Keep `components/FooterGate.tsx`: verify it still hides Footer on `/w/**`.
- Modify `components/transcription/global-recording-indicator.tsx`: do not render a second floating controller inside `/w/**` because the Workspace Toolbar owns it.

### Tests

- Create `components/workspace/workspace-app-shell.test.tsx`.
- Create `components/workspace/workspace-sidebar.test.tsx`.
- Create `components/workspace/workspace-toolbar.test.tsx`.
- Create `components/workspace/workspace-note-list.test.tsx`.
- Extend `components/notes/note-view.test.tsx`.
- Create `components/notes/note-panel.test.tsx`.

---

### Task 1: Separate marketing and workspace chrome

**Files:**

- Modify: `components/NavbarGate.tsx`
- Modify: `components/FooterGate.tsx`
- Modify: `components/transcription/global-recording-indicator.tsx`
- Create: `components/layout/app-route.test.tsx`
- Create: `lib/routes/app-route.ts`

**Interfaces:**

- Produces: `isWorkspaceRoute(pathname: string): boolean`.
- Consumes: Next.js `usePathname()` and existing RecordingProvider context.

- [ ] **Step 1: Write the failing route classification tests**

```ts
import { describe, expect, it } from "vitest";
import { isWorkspaceRoute } from "@/lib/routes/app-route";

describe("isWorkspaceRoute", () => {
  it.each(["/w/01K0000000000", "/w/01K0000000000/notes/01K0000000002"])(
    "classifies %s as an app route",
    (pathname) => expect(isWorkspaceRoute(pathname)).toBe(true)
  );

  it.each(["/", "/settings", "/privacy"])(
    "keeps marketing chrome for %s",
    (pathname) => expect(isWorkspaceRoute(pathname)).toBe(false)
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/layout/app-route.test.tsx`

Expected: FAIL because `lib/routes/app-route.ts` does not exist.

- [ ] **Step 3: Implement the route predicate and consume it in all gates**

```ts
export function isWorkspaceRoute(pathname: string) {
  return pathname === "/w" || pathname.startsWith("/w/");
}
```

`NavbarGate` and `FooterGate` return `null` for workspace routes. `GlobalRecordingIndicator` also returns `null` for workspace routes but remains unchanged elsewhere.

- [ ] **Step 4: Verify GREEN and repository checks**

Run: `rtk pnpm test:run components/layout/app-route.test.tsx`

Expected: 2 parameterized groups pass.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0 and both `/w` dynamic routes remain listed.

- [ ] **Step 5: Commit**

```bash
git add components/NavbarGate.tsx components/FooterGate.tsx components/transcription/global-recording-indicator.tsx components/layout/app-route.test.tsx lib/routes/app-route.ts
git commit -m "refactor: separate workspace app chrome"
```

### Task 2: Install shadcn primitives and create the responsive shell

**Files:**

- Create: `components/workspace/workspace-app-shell.tsx`
- Create: `components/workspace/workspace-app-shell.test.tsx`
- Modify: `app/w/[workspaceId]/page.tsx`
- Modify: `app/w/[workspaceId]/notes/[noteId]/page.tsx`
- Add: `components/ui/{alert,alert-dialog,badge,command,dialog,drawer,input,label,popover,scroll-area,select,sheet,sidebar,skeleton,tabs,textarea,tooltip}.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces: `WorkspaceAppShell({ workspaceId, children? })` and `WorkspaceShellContext` with `selectedFolderId`, `setSelectedFolderId`, `language`, and `setLanguage`.
- Consumes: generated Workspace, Folder, and Note hooks.

- [ ] **Step 1: Add the shadcn sources non-interactively**

Run:

```bash
rtk pnpm exec shadcn add alert alert-dialog badge command dialog drawer input label popover scroll-area select sheet sidebar skeleton tabs textarea tooltip --yes
```

Expected: source files appear in `components/ui` and dependencies are recorded without overwriting customized `button`, `card`, `avatar`, `separator`, or `dropdown-menu`.

- [ ] **Step 2: Write the failing shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";

vi.mock("@/lib/api/generated/workspace/workspace", () => ({
  useGetWorkspace: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: { workspaceId: "01K0000000000", name: "김민수의 워크스페이스" },
      },
    },
  }),
}));

describe("WorkspaceAppShell", () => {
  it("renders one app navigation and a main content region", () => {
    render(
      <WorkspaceAppShell workspaceId="01K0000000000">
        <p>노트 목록</p>
      </WorkspaceAppShell>
    );
    expect(
      screen.getByRole("navigation", { name: "워크스페이스" })
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("노트 목록");
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `rtk pnpm test:run components/workspace/workspace-app-shell.test.tsx`

Expected: FAIL because `WorkspaceAppShell` does not exist.

- [ ] **Step 4: Implement the shell and route composition**

Use shadcn `SidebarProvider`, `Sidebar`, `SidebarInset`, and `TooltipProvider`. The page route renders the shell once; the Note route uses the same shell and places `NoteRouteSurface` as an overlay child so client navigation preserves `RecordingProvider`.

```tsx
type WorkspaceShellState = {
  selectedFolderId: string | null;
  setSelectedFolderId: (folderId: string | null) => void;
  language: string;
  setLanguage: (language: string) => void;
};
```

The main region uses `min-h-svh`, fixed desktop Sidebar, `SidebarInset`, and one scroll owner. Do not add any marketing Navbar spacer.

- [ ] **Step 5: Verify GREEN, lint, and build**

Run: `rtk pnpm test:run components/workspace/workspace-app-shell.test.tsx`

Expected: PASS.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/w components/workspace/workspace-app-shell.tsx components/workspace/workspace-app-shell.test.tsx components/ui package.json pnpm-lock.yaml
git commit -m "feat: add responsive workspace app shell"
```

### Task 3: Build Workspace Sidebar and Folder CRUD dialogs

**Files:**

- Create: `components/workspace/workspace-sidebar.tsx`
- Create: `components/workspace/workspace-sidebar.test.tsx`
- Modify: `components/workspace/workspace-app-shell.tsx`
- Modify: `components/workspace/workspace-page.tsx`

**Interfaces:**

- Produces: `WorkspaceSidebar({ workspaceId, workspace, folders, selectedFolderId, onSelectFolder })`.
- Consumes: `useCreateFolder`, `useUpdateFolder`, `useDeleteFolder`, Auth context user, query invalidation keys.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it("selects a folder and opens an accessible rename dialog", async () => {
  const user = userEvent.setup();
  const onSelectFolder = vi.fn();
  render(
    <WorkspaceSidebar {...fixtureProps} onSelectFolder={onSelectFolder} />
  );

  await user.click(screen.getByRole("button", { name: "주간" }));
  expect(onSelectFolder).toHaveBeenCalledWith("01K0000000001");

  await user.click(screen.getByRole("button", { name: "주간 폴더 메뉴" }));
  await user.click(screen.getByRole("menuitem", { name: "이름 변경" }));
  expect(
    screen.getByRole("dialog", { name: "폴더 이름 변경" })
  ).toBeInTheDocument();
});

it("requires AlertDialog confirmation before deleting", async () => {
  const user = userEvent.setup();
  render(<WorkspaceSidebar {...fixtureProps} />);
  await user.click(screen.getByRole("button", { name: "주간 폴더 메뉴" }));
  await user.click(screen.getByRole("menuitem", { name: "삭제" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("주간");
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/workspace/workspace-sidebar.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement Sidebar composition**

Use `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuAction`, and `SidebarFooter`. Use `DropdownMenu` for user/folder menus, `Dialog` with `Input` for create/rename, and `AlertDialog` for deletion. Render only the existing settings link in the user menu.

Invalidate `getListWorkspaceFoldersQueryKey(workspaceId)` after every Folder mutation and `getListWorkspaceNotesQueryKey(workspaceId)` after deletion. If the deleted folder is selected, call `onSelectFolder(null)`.

- [ ] **Step 4: Verify GREEN and checks**

Run: `rtk pnpm test:run components/workspace/workspace-sidebar.test.tsx`

Expected: both interaction tests pass.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/workspace/workspace-sidebar.tsx components/workspace/workspace-sidebar.test.tsx components/workspace/workspace-app-shell.tsx components/workspace/workspace-page.tsx
git commit -m "feat: add workspace sidebar navigation"
```

### Task 4: Build Toolbar and integrate global recording controls

**Files:**

- Create: `components/workspace/workspace-toolbar.tsx`
- Create: `components/workspace/workspace-toolbar.test.tsx`
- Modify: `components/workspace/workspace-app-shell.tsx`
- Modify: `components/transcription/recording-provider.tsx`
- Modify: `components/transcription/recording-provider.test.tsx`

**Interfaces:**

- Produces: `WorkspaceToolbar({ workspaceId, currentLabel, activeNoteId, onCreateNote })`.
- Extends `RecordingContextValue` with the existing `session`, `elapsedMs`, `error`, `start`, `pause`, `resume`, and `stop`; no second recording store is introduced.

- [ ] **Step 1: Write failing Toolbar state tests**

```tsx
it("shows the start action when idle", () => {
  mockUseRecording.mockReturnValue(idleRecording);
  render(<WorkspaceToolbar {...props} />);
  expect(
    screen.getByRole("button", { name: "실시간 기록 시작" })
  ).toBeEnabled();
});

it("shows pause and stop for the global streaming session", () => {
  mockUseRecording.mockReturnValue({
    ...idleRecording,
    session: streamingSession,
    elapsedMs: 12_000,
  });
  render(<WorkspaceToolbar {...props} />);
  expect(screen.getByText("Recording")).toBeInTheDocument();
  expect(screen.getByText("00:12")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "녹음 일시 정지" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "녹음 종료" })).toBeEnabled();
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/workspace/workspace-toolbar.test.tsx`

Expected: FAIL because the Toolbar does not exist.

- [ ] **Step 3: Implement recording-aware Toolbar**

Use shadcn `Select` for `ko`, `en`, and `auto`, `Badge` for state, and Buttons for controls. Starting from the workspace creates an untitled Note when `activeNoteId` is absent, navigates to its side transcript URL, then calls `start(noteId, language)`. If another Note is active, replace the start action with `현재 녹음으로 이동`.

Do not stop recording on route changes. Display `error` in an `Alert` below the Toolbar without hiding the controls.

- [ ] **Step 4: Verify GREEN and provider regressions**

Run: `rtk pnpm test:run components/workspace/workspace-toolbar.test.tsx components/transcription/recording-provider.test.tsx`

Expected: Toolbar tests and all existing provider lifecycle tests pass.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/workspace/workspace-toolbar.tsx components/workspace/workspace-toolbar.test.tsx components/workspace/workspace-app-shell.tsx components/transcription/recording-provider.tsx components/transcription/recording-provider.test.tsx
git commit -m "feat: add workspace recording toolbar"
```

### Task 5: Replace Note cards with the date-grouped row list

**Files:**

- Create: `components/workspace/workspace-note-list.tsx`
- Create: `components/workspace/note-list-row.tsx`
- Create: `components/workspace/workspace-note-list.test.tsx`
- Modify: `components/workspace/workspace-page.tsx`

**Interfaces:**

- Produces: `groupNotesByDate(notes, locale): Array<{ key: string; label: string; notes: NoteSummaryResponse[] }>` and `WorkspaceNoteList`.
- Consumes: `useListWorkspaceNotes`, current Folder filter, delete mutation, router.

- [ ] **Step 1: Write failing grouping and row tests**

```tsx
expect(
  groupNotesByDate(notes, "ko-KR").map((group) =>
    group.notes.map((note) => note.noteId)
  )
).toEqual([["newer", "same-day-older"], ["older"]]);

render(<WorkspaceNoteList workspaceId="01K0000000000" folderId={null} />);
expect(screen.getByRole("link", { name: /주간 제품 회의/ })).toHaveAttribute(
  "href",
  "/w/01K0000000000/notes/01K0000000002?view=side&tab=transcript"
);
expect(screen.getByText("주간")).toBeInTheDocument();
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/workspace/workspace-note-list.test.tsx`

Expected: FAIL because the new list and grouping function do not exist.

- [ ] **Step 3: Implement the list states and row actions**

Each row renders duration, title, Folder Badges, time, creator, and a DropdownMenu. The whole primary content is a side-view Link; the menu offers full view and an AlertDialog-protected delete action. Use row-shaped Skeletons, an `Alert` with query `refetch`, and a filtered Empty State.

Do not implement client-side text search. Keep server Folder filtering through the generated hook.

- [ ] **Step 4: Verify GREEN and checks**

Run: `rtk pnpm test:run components/workspace/workspace-note-list.test.tsx`

Expected: grouping and rendered-link tests pass.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/workspace/workspace-note-list.tsx components/workspace/note-list-row.tsx components/workspace/workspace-note-list.test.tsx components/workspace/workspace-page.tsx
git commit -m "feat: add date grouped workspace note list"
```

### Task 6: Implement responsive Note Sheet, Drawer, and full surface

**Files:**

- Create: `components/notes/note-route-surface.tsx`
- Create: `hooks/use-media-query.ts`
- Create: `hooks/use-media-query.test.tsx`
- Modify: `components/notes/note-view.tsx`
- Extend: `components/notes/note-view.test.tsx`

**Interfaces:**

- Produces: `NoteRouteSurface`, `useMediaQuery(query)`, and the existing `normalizeNoteViewQuery()`.
- Consumes: `NotePanel`, shadcn Sheet and Drawer, Next router/search params.

- [ ] **Step 1: Extend failing URL and surface selection tests**

```tsx
it("uses a desktop Sheet for side view", () => {
  mockMatchMedia(true);
  render(
    <NoteRouteSurface {...props} query={{ view: "side", tab: "transcript" }} />
  );
  expect(screen.getByRole("dialog", { name: "노트" })).toHaveAttribute(
    "data-surface",
    "sheet"
  );
});

it("uses a mobile Drawer for the same canonical side URL", () => {
  mockMatchMedia(false);
  render(
    <NoteRouteSurface {...props} query={{ view: "side", tab: "transcript" }} />
  );
  expect(screen.getByRole("dialog", { name: "노트" })).toHaveAttribute(
    "data-surface",
    "drawer"
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/notes/note-view.test.tsx hooks/use-media-query.test.tsx`

Expected: FAIL because `NoteRouteSurface` and `useMediaQuery` do not exist.

- [ ] **Step 3: Implement responsive surface selection**

Use `(min-width: 768px)` for desktop. `view=side` renders controlled Sheet or Drawer with `open={true}`. `onOpenChange(false)` navigates to `/w/{workspaceId}` and does not call any recording action. Sheet uses `sm:max-w-[780px]`; Drawer uses a maximum height and rounded top edge. `view=full` renders a full content region without a dialog primitive.

Remove the duplicated embedded `WorkspacePage`, dimming overlay, and fixed hand-built `<aside>` from `NoteView`.

- [ ] **Step 4: Verify GREEN and route checks**

Run: `rtk pnpm test:run components/notes/note-view.test.tsx hooks/use-media-query.test.tsx`

Expected: query and responsive surface tests pass.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/notes/note-route-surface.tsx components/notes/note-view.tsx components/notes/note-view.test.tsx hooks/use-media-query.ts hooks/use-media-query.test.tsx
git commit -m "feat: add responsive note surfaces"
```

### Task 7: Recompose NotePanel, Details, and Transcript with shadcn

**Files:**

- Create: `components/notes/note-panel.tsx`
- Create: `components/notes/note-panel.test.tsx`
- Modify: `components/notes/note-details.tsx`
- Modify: `components/notes/transcript-view.tsx`
- Modify: `components/notes/note-route-surface.tsx`

**Interfaces:**

- Produces: `NotePanel({ workspaceId, noteId, tab, onTabChange, onClose, onExpand? })`.
- Consumes: generated Note/Folder/Session/Segment hooks and `useRecording()`.

- [ ] **Step 1: Write failing panel behavior tests**

```tsx
it("changes only the tab when selecting 노트 정보", async () => {
  const user = userEvent.setup();
  const onTabChange = vi.fn();
  render(<NotePanel {...props} tab="transcript" onTabChange={onTabChange} />);
  await user.click(screen.getByRole("tab", { name: "노트 정보" }));
  expect(onTabChange).toHaveBeenCalledWith("details");
});

it("confirms Note deletion with an AlertDialog", async () => {
  const user = userEvent.setup();
  render(<NotePanel {...props} />);
  await user.click(screen.getByRole("button", { name: "노트 메뉴" }));
  await user.click(screen.getByRole("menuitem", { name: "노트 삭제" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    "전사 기록도 함께 삭제"
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pnpm test:run components/notes/note-panel.test.tsx`

Expected: FAIL because `NotePanel` does not exist.

- [ ] **Step 3: Implement the shared Note header and Tabs**

Use `Tabs`, `TabsList`, `TabsTrigger`, and controlled `value`. Header renders title, Folder Badges, optional expand Button, DropdownMenu, and close Button. Delete uses AlertDialog and invalidates the Workspace Note list before closing.

- [ ] **Step 4: Replace Details raw controls**

Use `Label`, `Input`, `Textarea`, `Popover`, and `Command` for Folder multi-select. Keep title and context in local form state keyed by `noteId`; save through `useUpdateNote`. Attach/detach mutations run only for changed Folder IDs. On error, preserve form state and render `Alert`; on success render a short `저장됨` status.

- [ ] **Step 5: Replace Transcript controls and states**

Use a `Select` for Sessions, a `ScrollArea` for segments, `Badge` for status, and AlertDialog for segment deletion. Render Partial as a dashed `전사 중` block. Merge REST Final segments and provider Final segments by `segmentId`, sort by `sequence`, and never renumber after deletion.

- [ ] **Step 6: Verify GREEN and all focused tests**

Run: `rtk pnpm test:run components/notes components/transcription lib/transcription`

Expected: all Note, provider, reducer, socket, and audio tests pass.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add components/notes/note-panel.tsx components/notes/note-panel.test.tsx components/notes/note-details.tsx components/notes/transcript-view.tsx components/notes/note-route-surface.tsx
git commit -m "feat: recompose note workspace with shadcn"
```

### Task 8: Polish responsive states and verify the complete workflow

**Files:**

- Modify: `components/workspace/*.tsx`
- Modify: `components/notes/*.tsx`
- Modify: `app/globals.css`
- Modify: `README.md`

**Interfaces:**

- Consumes: the completed app shell, Note surfaces, generated REST mocks, and WebSocket mock.
- Produces: a visually coherent, documented, verified MVP.

- [ ] **Step 1: Run the focused React quality review**

Review every changed TSX file for one scroll owner, stable list keys, accessible icon-button names, semantic headings, form labels, no state synchronization effect, and no duplicated API requests. Fix only findings within this feature.

- [ ] **Step 2: Document the workspace mock entry URL**

Add to `README.md`:

```text
Default mock Workspace: http://localhost:3000/w/01K0000000000
Desktop side Note: ?view=side&tab=transcript
Full Note: ?view=full&tab=details
```

- [ ] **Step 3: Run the complete automated suite**

Run: `rtk pnpm test:run`

Expected: all tests pass with zero failures.

Run: `rtk pnpm asyncapi:validate`

Expected: `File asyncapi.yml is valid` and exit 0.

Run: `rtk pnpm orval`

Expected: exit 0 and no generated diff.

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0 with both Workspace routes.

Run: `rtk git diff --check`

Expected: no output.

- [ ] **Step 4: Run desktop browser acceptance**

Run: `rtk env NEXT_PUBLIC_API_MOCKING=enabled pnpm dev`

Verify at `http://localhost:3000/w/01K0000000000`:

1. Marketing Navbar and Footer are absent; one Workspace Sidebar and Toolbar are present.
2. Folder create, rename, filter, and AlertDialog deletion work.
3. Notes are date-grouped rows with duration, Folder Badges, time, and creator.
4. A row opens the Note Sheet and preserves the canonical URL.
5. Tabs change only `tab`; expand changes only `view`.
6. Recording start produces Partial and Final; closing the Sheet leaves Toolbar recording controls active.
7. Pause/resume keeps the Session ID; stop removes the global active state after COMPLETED.
8. Segment deletion removes only that segment and leaves remaining sequence/times unchanged.
9. Browser console has zero errors.

- [ ] **Step 5: Run mobile browser acceptance**

Set a 390x844 viewport and verify the same side URL opens a bottom Drawer, Sidebar opens from the App Bar, recording controls remain reachable, and no horizontal overflow exists.

- [ ] **Step 6: Commit documentation and polish**

Run: `rtk pnpm lint`

Expected: exit 0.

Run: `rtk pnpm build`

Expected: exit 0.

```bash
git add components/workspace components/notes app/globals.css README.md
git commit -m "docs: verify workspace app shell workflow"
```

Skip the commit if browser verification and documentation produced no tracked changes.
