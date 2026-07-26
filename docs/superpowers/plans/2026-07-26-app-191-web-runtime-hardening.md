# heymoa-web 런타임 견고성 + 컨벤션 정비 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단순 조회 위젯 9개를 공용 `<DataBoundary>`(Suspense + ErrorBoundary)로 감싸 로딩은 skeleton·실패는 인라인 재시도로 통일하고, 흩어진 팀 컨벤션을 AGENTS.md에 명문화한다.

**Architecture:** Orval을 재생성해 `useSuspenseQuery` 변형 훅을 추가하고, TanStack Query 공식 패턴(`QueryErrorResetBoundary` + `react-error-boundary`)을 `<DataBoundary>` 하나로 캡슐화한다. 실패를 UI 상태로 다루거나 폴링·조건부인 쿼리(11개)는 전환하지 않고 `useQuery`를 유지한다.

**Tech Stack:** Next.js 16(App Router), React 19, TanStack Query v5, Orval(react-query client), react-error-boundary, Tailwind, vitest + @testing-library/react.

## Global Constraints

- **의존성:** `react-error-boundary` 추가(react-query 공식 Suspense 패턴). react-query v5의 `QueryErrorResetBoundary`는 내장 — 별도 설치 없음.
- **Orval override.query:** `useQuery: true, useSuspenseQuery: true, useMutation: true, usePrefetch: true`. 기존 `mutator`(`./lib/api/fetcher.ts`, `apiFetch`)·`mock` 설정은 유지. `useQuery` 훅은 계속 생성(유지 대상이 씀).
- **전환 대상은 정확히 이 9개 파일뿐:** `components/notes/note-details.tsx`, `components/notes/note-view.tsx`, `components/notes/note-archive.tsx`, `components/workspace/workspace-app-shell.tsx`, `components/workspace/workspace-sidebar.tsx`, `components/settings/account-settings-form.tsx`, `components/settings/workspace-settings-form.tsx`, `components/settings/workspace-integrations-settings.tsx`, `components/notification/notification-bell.tsx`.
- **전환 금지(useQuery 유지):** 폴링(`refetchInterval`)·조건부(`enabled`)·404를 정상 UI로 다루는 쿼리. 해당 11개 파일(`personal-chat`, `Navbar`, `note-panel`, `note-summary`, `shared-chat-panel`, `transcript-view`, `members-settings`, `global-recording-indicator`, `recording-provider`, `workspace-page`, `workspace-toolbar`)은 **건드리지 않는다**.
- **로딩:** 페이지·리스트·데이터 위젯 = skeleton, 버튼·mutation 진행 = 인라인 spinner.
- **DESIGN.md 제품 면:** 셸/위젯은 각짐(radius 0)·그림자 없음·hairline 구분. 부양은 `shadow-e2`, 오버레이는 `shadow-e3`. raw `shadow-[...]` 금지. skeleton 컨테이너에 `aria-label="…불러오는 중"`.
- **mutation 실패는 토스트 유지:** `lib/query/query-client.ts`의 `suppressErrorToast` 규칙을 바꾸지 않는다. DataBoundary는 조회 실패에만 관여한다.
- **테스트:** Orval 훅을 `vi.mock`으로 모킹하는 기존 방식 유지. suspense 훅은 로딩/에러를 부모 경계가 처리하므로, 컴포넌트 테스트는 훅이 항상 데이터를 반환하도록 모킹하고, 로딩/에러 fallback은 `DataBoundary` 단위 테스트가 검증한다.
- **커밋 제목:** `[APP-N] 제목` (N은 이 이슈의 Linear 번호). conventional prefix 금지.
- **게이트(태스크마다):** `pnpm test:run && pnpm lint && pnpm format:check && pnpm build`.

## File Structure

**신규:**

- `components/ui/inline-retry.tsx` — 조회 실패 시 문구 + "다시 시도" 버튼. `DataBoundary`의 기본 에러 fallback.
- `components/ui/data-boundary.tsx` — `QueryErrorResetBoundary` + `ErrorBoundary` + `Suspense`를 감싼 공용 경계.
- `components/ui/inline-retry.test.tsx`, `components/ui/data-boundary.test.tsx`.

**수정:**

- `orval.config.ts` — `override.query` 추가.
- `lib/api/generated/**` — 재생성(수기 편집 금지).
- 전환 9개 컴포넌트 + 각 `.test.tsx`.
- `app/w/[workspaceId]/loading.tsx` — 빈 `return null`을 skeleton으로.
- `components/workspace/workspace-route-layout.tsx` — 셸 위젯을 DataBoundary로 감쌈(Task 4에서 정확한 위치 확정).
- `AGENTS.md` — 컨벤션 섹션.

---

### Task 1: 의존성 + Orval suspense 훅 재생성

**Files:**

- Modify: `orval.config.ts`
- Modify: `package.json`(react-error-boundary 추가)
- Regenerate: `lib/api/generated/**`

**Interfaces:**

- Produces: `useGetNoteSuspense`, `useGetWorkspaceSuspense`, `useGetProjectsSuspense`, `useGetWorkspacesSuspense`, `useGetCurrentUserSuspense`, `useGetWorkspaceQuery`(기존)… — 각 조회 훅의 `…Suspense` 변형. 시그니처는 기존 `useGetX(...args, options?)`와 동일하되 `useSuspenseQuery` 기반이라 반환에 `data`가 항상 존재(로딩/에러는 throw).

- [ ] **Step 1: react-error-boundary 설치**

Run: `pnpm add react-error-boundary`
Expected: `package.json` dependencies에 `react-error-boundary` 추가, lockfile 갱신.

- [ ] **Step 2: orval.config.ts에 query override 추가**

`output` 객체에 아래 `override.query`를 병합(기존 `override.mutator`는 유지):

```ts
override: {
  query: {
    useQuery: true,
    useSuspenseQuery: true,
    useMutation: true,
    usePrefetch: true,
  },
  mutator: {
    path: "./lib/api/fetcher.ts",
    name: "apiFetch",
  },
},
```

- [ ] **Step 3: 재생성**

Run: `pnpm orval`
Expected: 성공. 생성물에 suspense 훅이 생김 — 확인:
Run: `grep -rl "useSuspenseQuery" lib/api/generated | head`
Expected: 최소 여러 파일 매치(예: `lib/api/generated/notes/notes.ts`).

- [ ] **Step 4: 타입·빌드 통과 확인**

Run: `pnpm lint && pnpm build`
Expected: 통과. 생성물 diff는 훅 추가뿐이고 기존 `useQuery` 훅·mock은 그대로.

- [ ] **Step 5: format + 커밋**

Run: `pnpm format`

```bash
git add orval.config.ts package.json pnpm-lock.yaml lib/api/generated
git commit -m "[APP-N] Orval suspense 훅 생성 + react-error-boundary 추가"
```

---

### Task 2: DataBoundary + InlineRetry 공용 컴포넌트

**Files:**

- Create: `components/ui/inline-retry.tsx`
- Create: `components/ui/inline-retry.test.tsx`
- Create: `components/ui/data-boundary.tsx`
- Create: `components/ui/data-boundary.test.tsx`

**Interfaces:**

- Produces:
  - `InlineRetry({ onRetry, label? }: { onRetry: () => void; label?: string })` — 기본 label `"불러오지 못했습니다"`.
  - `DataBoundary({ fallback, children, errorLabel? }: { fallback: React.ReactNode; children: React.ReactNode; errorLabel?: string })` — `fallback`은 로딩 skeleton, 에러는 `InlineRetry`(label=`errorLabel`).

- [ ] **Step 1: InlineRetry 실패 테스트**

Create `components/ui/inline-retry.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineRetry } from "@/components/ui/inline-retry";

afterEach(cleanup);

describe("InlineRetry", () => {
  it("기본 문구를 보여주고 다시 시도로 onRetry를 부른다", () => {
    const onRetry = vi.fn();
    render(<InlineRetry onRetry={onRetry} />);

    expect(screen.getByText("불러오지 못했습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("label을 덮어쓴다", () => {
    render(
      <InlineRetry onRetry={() => {}} label="알림을 불러오지 못했습니다" />
    );
    expect(screen.getByText("알림을 불러오지 못했습니다")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test:run components/ui/inline-retry.test.tsx`
Expected: FAIL — `InlineRetry` 모듈 없음.

- [ ] **Step 3: InlineRetry 구현**

Create `components/ui/inline-retry.tsx`:

```tsx
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 조회 실패 인라인 표시. 페이지 전체 error.tsx보다 좁은, 위젯 단위 실패용. */
export function InlineRetry({
  onRetry,
  label = "불러오지 못했습니다",
}: {
  onRetry: () => void;
  label?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-6 py-8 text-center"
    >
      <AlertTriangle className="size-5 text-[var(--el-error)]" />
      <p className="text-sm text-[var(--el-muted)]">{label}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw className="size-4" />
        다시 시도
      </Button>
    </div>
  );
}
```

주의: `Button`의 실제 variant/size prop 값은 `components/ui/button.tsx`를 열어 확인하고 맞춘다(`variant="outline"`/`size="sm"`가 없으면 존재하는 값으로). raw `shadow-[...]`·`rounded-*` 금지(제품 면 각짐).

- [ ] **Step 4: 통과 확인**

Run: `pnpm test:run components/ui/inline-retry.test.tsx`
Expected: PASS.

- [ ] **Step 5: DataBoundary 실패 테스트**

Create `components/ui/data-boundary.test.tsx`:

```tsx
import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataBoundary } from "@/components/ui/data-boundary";

afterEach(cleanup);

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

// 첫 호출은 reject, 리셋 후 재호출은 성공 — resetErrorBoundary가 재요청을 유발함을 검증.
function makeFlakyChild() {
  let attempt = 0;
  return function Child() {
    const { data } = useSuspenseQuery({
      queryKey: ["flaky"],
      queryFn: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("boom");
        return "성공 데이터";
      },
    });
    return <div>{data}</div>;
  };
}

describe("DataBoundary", () => {
  it("로딩 중 fallback을, 실패 시 InlineRetry를, 재시도 후 데이터를 보여준다", async () => {
    const Child = makeFlakyChild();
    wrap(
      <DataBoundary
        fallback={<div>로딩중</div>}
        errorLabel="목록을 불러오지 못했습니다"
      >
        <Child />
      </DataBoundary>
    );

    expect(screen.getByText("로딩중")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("목록을 불러오지 못했습니다")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.getByText("성공 데이터")).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `pnpm test:run components/ui/data-boundary.test.tsx`
Expected: FAIL — `DataBoundary` 모듈 없음.

- [ ] **Step 7: DataBoundary 구현**

Create `components/ui/data-boundary.tsx`:

```tsx
"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { InlineRetry } from "@/components/ui/inline-retry";

/**
 * 조회 위젯의 공용 경계. 로딩은 fallback(skeleton), 실패는 InlineRetry("다시 시도"→재요청).
 * TanStack Query 공식 Suspense 패턴: QueryErrorResetBoundary.reset을 ErrorBoundary.onReset에 연결.
 * useSuspenseQuery를 쓰는 자식에만 의미가 있다. mutation 실패는 여기 오지 않는다(토스트 담당).
 */
export function DataBoundary({
  fallback,
  children,
  errorLabel,
}: {
  fallback: React.ReactNode;
  children: React.ReactNode;
  errorLabel?: string;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <InlineRetry onRetry={resetErrorBoundary} label={errorLabel} />
          )}
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

- [ ] **Step 8: 통과 확인**

Run: `pnpm test:run components/ui/data-boundary.test.tsx components/ui/inline-retry.test.tsx`
Expected: PASS (양쪽).

- [ ] **Step 9: format + 커밋**

Run: `pnpm format`

```bash
git add components/ui/data-boundary.tsx components/ui/data-boundary.test.tsx components/ui/inline-retry.tsx components/ui/inline-retry.test.tsx
git commit -m "[APP-N] 공용 DataBoundary + InlineRetry 경계 컴포넌트"
```

---

### Task 3: notes 위젯 전환 (note-details · note-view · note-archive)

**Files:**

- Modify: `components/notes/note-details.tsx` (+ `.test.tsx`)
- Modify: `components/notes/note-view.tsx` (+ `.test.tsx` 있으면)
- Modify: `components/notes/note-archive.tsx` (+ `.test.tsx`)

**Interfaces:**

- Consumes: `DataBoundary`(Task 2), `useGetNoteSuspense`·`useGetNoteTranscriptSuspense`·`useGetNoteSharedChatMessagesSuspense`(Task 1).

전환 공통 절차(각 파일):

1. 조회 훅 `useGetX(...)` → `useGetXSuspense(...)`로 교체. 반환에서 `isLoading`/`isError` 분기와 그에 딸린 수기 skeleton·에러 JSX를 제거하고, `data`를 직접 사용(항상 존재).
2. 이 위젯을 렌더하는 부모에서 `<DataBoundary fallback={<위젯Skeleton/>} errorLabel="…">`로 감싼다. 위젯이 스스로 skeleton을 그리던 것을 경계로 이동.
3. skeleton은 기존 수기 로딩 JSX를 재사용해 `<XSkeleton/>` 컴포넌트로 추출(같은 파일 하단 또는 `components/notes/`에).
4. 테스트: suspense 훅 모킹은 `data`를 항상 반환하도록 바꾸고, `isLoading` 케이스 테스트는 삭제(경계 책임). 에러 케이스도 삭제 또는 DataBoundary로 감싼 통합 테스트로 대체.

- [ ] **Step 1: note-details 대표 전환 — before 확인**

`components/notes/note-details.tsx`의 현재 형태는 대략:

```tsx
const noteQuery = useGetNote(noteId);
const note = /* 봉투 파싱 */;
if (!note) return <NoteDetailsSkeleton />; // 로딩·실패 구분 없이 스켈레톤 무한 대기(현 버그성)
return <div>…note…</div>;
```

- [ ] **Step 2: note-details를 suspense 훅으로**

`useGetNote(noteId)` → `useGetNoteSuspense(noteId)`. `if (!note) return <Skeleton/>` 제거. 봉투 파싱(`response.status === 200 && response.data.success ? response.data.data : …`)은 유지하되 `data`는 항상 존재하므로 로딩 가드 삭제. 파일 하단에 `export function NoteDetailsSkeleton()`로 기존 스켈레톤 JSX를 추출.

- [ ] **Step 3: note-details를 렌더하는 부모를 DataBoundary로 감싸기**

`note-details`를 렌더하는 지점(같은 `components/notes/` 내 컨테이너 또는 `note-view`)에서:

```tsx
<DataBoundary
  fallback={<NoteDetailsSkeleton />}
  errorLabel="노트를 불러오지 못했습니다"
>
  <NoteDetails noteId={noteId} />
</DataBoundary>
```

정확한 부모는 `grep -rn "NoteDetails" components app`으로 찾아 확정.

- [ ] **Step 4: note-details 테스트 갱신**

`useGetNote` 모킹을 `useGetNoteSuspense`로 바꾸고 항상 `{ status: 200, data: { success: true, data: note } }` 반환. `!note`(로딩) 케이스 테스트 제거. 데이터 렌더 케이스만 유지.

Run: `pnpm test:run components/notes/note-details.test.tsx`
Expected: PASS.

- [ ] **Step 5: note-view 전환**

`useGetNote` → `useGetNoteSuspense`. `note-view`는 phase 파생용(렌더는 하위 위임)이라 로딩 가드만 제거하면 된다. `note-view`를 렌더하는 라우트/부모를 DataBoundary(fallback=적절한 노트 라우트 skeleton, 없으면 `NoteDetailsSkeleton` 재사용)로 감싼다. 테스트 있으면 동일 방식 갱신.

- [ ] **Step 6: note-archive 전환**

`useGetNoteTranscript`·`useGetNoteSharedChatMessages` → 각 `…Suspense`. 기존 `isError→alert+재시도` JSX 제거(경계가 대체). 두 쿼리를 한 위젯이 쓰므로 `note-archive` 전체를 하나의 DataBoundary로 감싼다(fallback은 아카이브 skeleton, 기존 로딩 JSX 추출). 테스트 갱신.

Run: `pnpm test:run components/notes/note-archive.test.tsx`
Expected: PASS.

- [ ] **Step 7: 전체 게이트 + 커밋**

Run: `pnpm test:run && pnpm lint && pnpm format:check && pnpm build`
Expected: 통과(기존 402 + 신규 무회귀). 실패 시 수정 후 재실행.

```bash
git add components/notes/note-details.tsx components/notes/note-details.test.tsx components/notes/note-view.tsx components/notes/note-archive.tsx components/notes/note-archive.test.tsx
git commit -m "[APP-N] notes 위젯 3종 DataBoundary 전환"
```

---

### Task 4: workspace 셸 전환 (workspace-app-shell · workspace-sidebar)

**Files:**

- Modify: `components/workspace/workspace-app-shell.tsx`
- Modify: `components/workspace/workspace-sidebar.tsx`
- Modify: `components/workspace/workspace-route-layout.tsx` (경계 배치)
- Modify: 관련 `.test.tsx`

**Interfaces:**

- Consumes: `DataBoundary`, `useGetWorkspaceSuspense`·`useGetProjectsSuspense`·`useGetWorkspacesSuspense`. 기존 skeleton: `WorkspaceRouteSkeleton`(`components/workspace/workspace-route-skeleton.tsx`).
- 배경: `lib/workspace/prefetch.ts`의 `prefetchWorkspaceShell`이 workspaces·workspace·projects를 서버 프리페치 → HydrationBoundary 주입. 실서버에선 suspense 훅이 즉시 resolve(fallback 안 뜸), mock 모드에선 클라 fetch로 fallback이 뜬다. 그래서 경계는 양쪽 다 필요.

- [ ] **Step 1: 셸 렌더 트리 확인**

Run: `grep -rn "WorkspaceAppShell\|WorkspaceSidebar\|WorkspaceRouteLayout" components app | grep -v test`
Expected: `workspace-route-layout.tsx`가 셸을 렌더하는 지점 파악. 이 위치가 DataBoundary 삽입점.

- [ ] **Step 2: 셸 훅을 suspense로**

`workspace-app-shell.tsx`: `useGetWorkspace`·`useGetProjects` → `…Suspense`. 로딩·에러 가드 제거, `data` 직접 사용. `workspace-sidebar.tsx`: `useGetWorkspaces` → `useGetWorkspacesSuspense`, "실패 시 조용히 빈 배열" 처리 제거(경계가 대체).

- [ ] **Step 3: route-layout에서 셸을 DataBoundary로 감싸기**

`workspace-route-layout.tsx`에서 셸 트리를 `WorkspaceRouteSkeleton`을 fallback으로 하는 DataBoundary로 감싼다(사이드바+메인을 한 skeleton이 그리므로 하나의 경계):

```tsx
<DataBoundary
  fallback={<WorkspaceRouteSkeleton />}
  errorLabel="워크스페이스를 불러오지 못했습니다"
>
  {/* app-shell / sidebar 트리 */}
</DataBoundary>
```

- [ ] **Step 4: 테스트 갱신**

`workspace-app-shell.test.tsx`·`workspace-sidebar.test.tsx`의 훅 모킹을 suspense 변형으로 바꾸고 `data` 항상 반환. 로딩/빈배열 케이스 제거.

Run: `pnpm test:run components/workspace`
Expected: PASS.

- [ ] **Step 5: mock 모드 수동 확인**

Run: `NEXT_PUBLIC_API_MOCKING=enabled pnpm build` 후(또는 dev), 브라우저 프리뷰로 `/w/{ws}` 진입 시 `WorkspaceRouteSkeleton` → 데이터 렌더 전환을 확인. (프리뷰 검증은 executing 단계에서 실제 실행.)

- [ ] **Step 6: 게이트 + 커밋**

Run: `pnpm test:run && pnpm lint && pnpm format:check && pnpm build`

```bash
git add components/workspace/workspace-app-shell.tsx components/workspace/workspace-sidebar.tsx components/workspace/workspace-route-layout.tsx components/workspace/*.test.tsx
git commit -m "[APP-N] workspace 셸 DataBoundary 전환"
```

---

### Task 5: settings 위젯 전환 (account · workspace · integrations)

**Files:**

- Modify: `components/settings/account-settings-form.tsx` (+ test)
- Modify: `components/settings/workspace-settings-form.tsx` (+ test)
- Modify: `components/settings/workspace-integrations-settings.tsx` (+ test)

**Interfaces:**

- Consumes: `DataBoundary`, `useGetCurrentUserSuspense`·`useGetWorkspaceSuspense`·`useGetWorkspaceIntegrationsSuspense`.
- 주의: `workspace-integrations-settings`는 `useGetWorkspaceMembers`도 쓰지만 그건 `members-settings`와 함께 유지 판정(enabled). integrations 훅만 전환하고, members 훅이 이 파일에서 `enabled` 없이 단순 조회면 함께 전환, `enabled`면 유지 — 파일을 열어 확인 후 결정.

- [ ] **Step 1: 각 폼을 suspense 훅으로**

세 파일에서 조회 훅 → `…Suspense`. 이들은 대부분 "에러 UI 자체가 없음"이라 로딩 가드만 제거하면 된다. 각 폼을 감싸는 부모(설정 다이얼로그의 탭 컨텐츠)에서 DataBoundary로 감싼다. fallback skeleton은 폼 필드 모양의 간단한 skeleton(기존 로딩 표현 재사용, 없으면 `<Skeleton>` 몇 줄).

- [ ] **Step 2: 경계 배치**

설정 탭이 각 폼을 렌더하는 지점을 `grep -rn "AccountSettingsForm\|WorkspaceSettingsForm\|WorkspaceIntegrationsSettings" components`로 찾아, 탭별로 DataBoundary 삽입.

- [ ] **Step 3: 테스트 갱신 + 통과**

세 `.test.tsx`의 훅 모킹을 suspense로. Run: `pnpm test:run components/settings`
Expected: PASS.

- [ ] **Step 4: 게이트 + 커밋**

Run: `pnpm test:run && pnpm lint && pnpm format:check && pnpm build`

```bash
git add components/settings/account-settings-form.tsx components/settings/workspace-settings-form.tsx components/settings/workspace-integrations-settings.tsx components/settings/*.test.tsx
git commit -m "[APP-N] settings 폼 3종 DataBoundary 전환"
```

---

### Task 6: notification-bell 전환 (드롭다운 로컬 경계)

**Files:**

- Modify: `components/notification/notification-bell.tsx` (+ test)

**Interfaces:**

- Consumes: `DataBoundary`, `useGetNotificationsSuspense`.
- 주의: 벨은 워크스페이스 툴바에 **항상 마운트**된다. 벨 아이콘·배지는 즉시 보여야 하고, 목록 로딩만 Suspense여야 툴바가 통째로 멎지 않는다. 그래서 경계는 **드롭다운 내부 목록만** 감싼다 — 벨 버튼과 unreadCount 배지는 경계 밖.

- [ ] **Step 1: 목록만 분리**

벨 컴포넌트에서 알림 목록 렌더 부분을 내부 컴포넌트(`NotificationList`)로 분리하고 `useGetNotifications` → `useGetNotificationsSuspense`를 그 안으로 이동. 배지 카운트가 같은 쿼리를 쓰면, 배지는 `useGetNotifications`(비-suspense, 기존) 유지하거나 열린 뒤에만 목록을 로드하도록 분리 — 파일을 열어 카운트/목록 데이터 흐름 확인 후 결정.

- [ ] **Step 2: 드롭다운 목록을 DataBoundary로**

드롭다운 컨텐츠에서:

```tsx
<DataBoundary
  fallback={<NotificationListSkeleton />}
  errorLabel="알림을 불러오지 못했습니다"
>
  <NotificationList />
</DataBoundary>
```

- [ ] **Step 3: 테스트 갱신 + 통과**

Run: `pnpm test:run components/notification/notification-bell.test.tsx`
Expected: PASS. 벨 아이콘·배지는 로딩과 무관하게 렌더됨을 확인하는 케이스 추가.

- [ ] **Step 4: 게이트 + 커밋**

Run: `pnpm test:run && pnpm lint && pnpm format:check && pnpm build`

```bash
git add components/notification/notification-bell.tsx components/notification/notification-bell.test.tsx
git commit -m "[APP-N] 알림 벨 드롭다운 DataBoundary 전환"
```

---

### Task 7: 로딩 표준 — 빈 loading.tsx 보강

**Files:**

- Modify: `app/w/[workspaceId]/loading.tsx`

**Interfaces:**

- Consumes: `WorkspaceRouteSkeleton`.

- [ ] **Step 1: 빈 loading.tsx를 skeleton으로**

`app/w/[workspaceId]/loading.tsx`의 `return null`을 교체:

```tsx
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";

export default function WorkspaceLoading() {
  return <WorkspaceRouteSkeleton />;
}
```

다른 `loading.tsx`가 `return null`이거나 비어 있으면(`grep -rln "return null" app/**/loading.tsx`) 해당 화면 skeleton으로 동일 처리. 적절한 skeleton이 없으면 해당 라우트에 맞는 최소 skeleton을 `components/`에 만들되 DESIGN.md 각짐·hairline 준수.

- [ ] **Step 2: 게이트 + 커밋**

Run: `pnpm test:run && pnpm lint && pnpm format:check && pnpm build`

```bash
git add app/w/**/loading.tsx
git commit -m "[APP-N] 빈 로딩 라우트에 skeleton 채움"
```

---

### Task 8: AGENTS.md 컨벤션 명문화

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: merge 방식 정정**

`AGENTS.md`의 "Promote to `main` … squash-merge `dev` into `main`" 문장을 찾아 아래로 교체:

> - Integrate a feature by **squash-merging it into `dev` locally**, then `git push` — no pull request.
> - Promote to `main` by **rebase-merging `dev` into `main` (fast-forward, 커밋 보존) locally**, then push. (squash 아님)

- [ ] **Step 2: 커밋/브랜치 이름 규칙 추가**

"Repository & Workflow"(또는 유사) 섹션에 추가:

> - 커밋·브랜치 제목은 `[APP-N] 제목`. `feat(app-N):`·`feat:` 등 conventional prefix 금지. 이슈 없는 잡일만 `chore:`/`docs:` bare 허용.

- [ ] **Step 3: Codex 리뷰 게이트 추가**

> - 코드 리뷰 게이트는 push 전 로컬 `codex exec review --base dev --title "..."` 하나다. GitHub 원격 `@codex` 봇 리뷰는 요청·반영하지 않는다.

- [ ] **Step 4: hydration 안전 규칙 추가**

Architecture(SSR/hydration 항목 근처)에 추가:

> - SSR을 기능 단위로 통째 끄지 않는다. 시간·랜덤·`typeof window` 결과를 첫 렌더에 직접 그리지 않는다. `mounted` 가드는 최후수단이며 최소화한다. hydration 불일치는 숨기지 말고 원인을 고친다.

- [ ] **Step 5: 오류·로딩 경계 규칙 추가**

"Critical Conventions"에 추가:

> - 단순 조회 위젯은 `components/ui/data-boundary.tsx`의 `<DataBoundary>`로 감싼다(로딩=skeleton, 실패=`InlineRetry`). suspense 훅(`useGetXSuspense`)을 쓴다.
> - **전환하지 않는 쿼리:** 폴링(`refetchInterval`)·조건부(`enabled`)·404를 정상 UI 상태로 다루는 조회(예: `note-summary` 404→요약없음, `personal-chat` 404→빈 대화)는 `useQuery`를 유지한다.
> - mutation 실패는 토스트(`lib/query/query-client.ts`), 지속 상태·주 데이터 실패는 인라인 — 기존 경계 유지.
> - 로딩: 페이지·리스트·위젯 = skeleton, 버튼·mutation 진행 = 인라인 spinner.

- [ ] **Step 6: 커밋**

```bash
git add AGENTS.md
git commit -m "[APP-N] AGENTS.md 컨벤션 명문화 (merge·커밋명·Codex·hydration·경계)"
```

---

## Self-Review

**Spec coverage:**

- §4.1 의존성 → Task 1. §4.2 Orval → Task 1. §4.3 DataBoundary/InlineRetry → Task 2. §4.4 전환 → Task 3~6(9개 전부: notes 3, workspace 2, settings 3, notification 1). §4.5 로딩 표준 → Task 5 skeleton + Task 7. §5 AGENTS.md 5항목 → Task 8. §6 검증 → 각 태스크 게이트 + Task 4 mock 프리뷰. 갭 없음.
- §8 리스크(전환 규모·Suspense 폭포·usePrefetch): 위젯군별 태스크 분할로 규모 대응. 폭포는 위젯별 개별 DataBoundary(형제 경계)로 자연 완화. usePrefetch는 Task 1에서 훅만 생성, 확장 적용은 강제하지 않음(기존 2곳 유지) — spec의 "선택 적용"과 일치.

**Placeholder scan:** "정확한 부모는 grep으로 확정"류는 실제 명령을 준 구체 지시이며, 코드가 필요한 스텝(DataBoundary·InlineRetry·loading.tsx)은 전체 코드를 실었다. TBD/막연한 지시 없음.

**Type consistency:** `DataBoundary({ fallback, children, errorLabel })`·`InlineRetry({ onRetry, label })`가 Task 2 정의와 Task 3~6 사용에서 일치. suspense 훅 이름은 `useGetX` → `useGetXSuspense` 규칙으로 일관(Orval 생성 규칙). skeleton 컴포넌트명은 각 태스크에서 추출·명명.

**Known follow-ups:** notification-bell의 배지 vs 목록 데이터 분리(Task 6 Step 1)는 파일 실제 구조에 따라 판단 필요 — 구현 중 카운트가 목록과 별도 쿼리가 아니면, 드롭다운 열림 상태에서만 목록을 suspense-로드하는 방식으로 처리한다.
