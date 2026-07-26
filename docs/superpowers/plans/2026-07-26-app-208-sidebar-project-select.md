# APP-208 사이드바 프로젝트 선택 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노트를 보는 중에 사이드바에서 프로젝트를 고르면 화면이 눈에 띄게 바뀌게 한다.

**Architecture:** 프로젝트 선택은 지역 상태로 두되, **노트가 열려 있으면 목록으로 돌아간다.** 상태 경계를 바꾸지 않으므로 `docs/frontend-architecture.md`의 "지역 상태다"가 그대로 참이다.

**Tech Stack:** Next.js App Router (`useRouter`), Playwright

## Global Constraints

- 커밋 제목은 `[APP-208] 제목` 형식
- 코드 주석은 평서체
- 검증: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`

## 방향 선택 — 2번(노트를 닫는다)

이슈가 방향 둘을 제시했다. **2번을 고른다.**

`docs/frontend-architecture.md`는 "URL 공유가 필요해질 때만 search param으로 승격한다"고 적어
뒀다. 지금 요구는 **공유가 아니라 "화면이 반응하지 않는다"**이다. 승격은 그 요구를 넘어서고,
넘어선 만큼 뒤로가기·공유·prefetch·초기 동기화가 전부 범위에 들어온다. 지금 사는 것에 비해
비싸다.

2번은 사이드바를 "어떤 건 되고 어떤 건 안 되는" 상태에서 꺼낸다. 워크스페이스 전환은 이미
`router.push`로 이동한다 — 프로젝트 선택도 같은 성질이 된다.

**승격이 필요해지는 신호**를 적어 둔다: 프로젝트가 걸린 URL을 남에게 보내야 할 때, 또는
뒤로가기로 이전 프로젝트로 돌아가야 한다는 요구가 나올 때. 그때 별도 이슈로 한다.

## 실측 — 증상 범위

이슈가 "side에서도 같은 문제인지 먼저 확인하라"고 했다. 확인한 결과는 이렇다.

| 뷰 | 노트 표면 | 목록이 보이나 |
|---|---|---|
| `view=full` | `absolute inset-x-0 top-16` — 본문 컬럼을 통째로 덮는다 | 안 보인다 |
| `view=side` (데스크톱) | Sheet가 `md:right-2 md:w-[min(860px,…)]` | 일부만 보인다 |
| `view=side` (모바일) | Sheet가 `inset-0` — 전면을 덮는다 | 안 보인다 |

**뷰나 뷰포트로 분기하지 않는다.** side 모바일이 full과 같은 증상이라 분기가 곧 깨진다.
"프로젝트를 고르면 노트를 닫는다" 한 규칙으로 셋을 다 덮는다.

## File Structure

| 파일 | 무엇 |
|---|---|
| `components/workspace/workspace-app-shell.tsx` | 선택 핸들러를 감싸 노트가 열려 있으면 이동시킨다 |
| `components/workspace/workspace-app-shell.test.tsx` | 노트가 열렸을 때/아닐 때 동작 |
| `e2e/smoke.spec.ts` | full 화면에서 실제로 화면이 바뀌는지 |

사이드바는 안 건드린다. `onSelectProject`를 부르는 쪽 그대로 두고 셸이 그 콜백을 바꾼다 —
사이드바가 라우팅을 몰라도 되게 한다.

---

### Task 1: 노트가 열려 있으면 목록으로 돌아간다

**Files:**
- Modify: `components/workspace/workspace-app-shell.tsx:64-72` (핸들러 추가), `:161` (전달)
- Test: `components/workspace/workspace-app-shell.test.tsx` (신설 또는 추가)

**Interfaces:**
- Consumes: `activeNoteId`(이미 prop), `router`(이미 있음), `workspaceId`(이미 prop)
- Produces: 없음. `onSelectProject`의 시그니처는 그대로다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

셸은 Provider가 많아 통째로 렌더하면 무거워진다. **핸들러의 판단만** 검증한다 — 노트가 열려
있으면 이동, 아니면 이동 없음. 두 경우 모두 선택 상태는 바뀌어야 한다.

`components/workspace/workspace-app-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/w/workspace-1",
  useSearchParams: () => new URLSearchParams(),
}));
```

**실제 셀렉터와 mock 범위는 구현을 열어 맞춘다.** 셸이 어떤 훅을 부르는지 확인하고 필요한
것만 mock한다 — 추측해서 쓰지 않는다. 렌더가 지나치게 무거우면 핸들러를 순수 함수로 뽑아
그것을 직접 테스트한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run components/workspace/workspace-app-shell.test.tsx`
Expected: FAIL — `router.push`가 호출되지 않음

- [ ] **Step 3: 셸에 핸들러를 넣는다**

`components/workspace/workspace-app-shell.tsx`의 `useState` 아래에 더한다.

```tsx
  // 프로젝트를 고르면 목록으로 돌아간다. 노트 표면이 본문 컬럼을 덮고 있어서(full은 항상,
  // side는 모바일에서) 필터만 바꾸면 화면에 아무 일도 안 일어난 것처럼 보인다. 워크스페이스
  // 전환이 이미 이동으로 처리되므로 프로젝트 선택도 같은 성질로 맞춘다.
  const handleSelectProject = useCallback(
    (projectId: string | null) => {
      setSelectedProjectId(projectId);

      if (activeNoteId) {
        router.push(`/w/${workspaceId}`);
      }
    },
    [activeNoteId, router, workspaceId]
  );
```

`useCallback`을 import에 더한다.

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
```

`WorkspaceSidebar`에 넘기는 값을 바꾼다.

```tsx
                onSelectProject={handleSelectProject}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm vitest run components/workspace/workspace-app-shell.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add components/workspace/workspace-app-shell.tsx components/workspace/workspace-app-shell.test.tsx
git commit -m "[APP-208] 프로젝트를 고르면 열린 노트를 닫는다"
```

---

### Task 2: full 화면에서 실제로 바뀌는지 e2e로 못박는다

**Files:**
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: Task 1
- Produces: 없음

단위 테스트는 핸들러의 판단만 본다. "화면이 눈에 띄게 바뀐다"는 URL과 화면으로 확인해야
한다.

- [ ] **Step 1: 테스트를 쓴다**

셀렉터는 기존 e2e가 쓰는 것을 그대로 쓴다 — `MOCK_WORKSPACE_ID`, 노트 URL 형식. 사이드바
항목 이름(`모든 노트`, 프로젝트 이름)은 **목 데이터를 열어 확인한다.**

```ts
test("returns to the note list when a project is picked in full view", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}/notes/01K0000000002?view=full`);
  await expect(page).toHaveURL(/notes/);

  await page.getByRole("button", { name: "모든 노트" }).click();

  // 노트를 닫고 목록으로 돌아간다.
  await expect(page).toHaveURL(new RegExp(`/w/${MOCK_WORKSPACE_ID}$`));
});
```

- [ ] **Step 2: 수정 없이 실패하는지 확인한다**

Task 1의 `onSelectProject={handleSelectProject}`를 잠시 `setSelectedProjectId`로 되돌리고
돌린다. URL이 그대로라 FAIL 해야 한다. 확인 후 복구한다.

- [ ] **Step 3: 통과를 확인한다**

Run: `pnpm test:e2e`
Expected: 기존 11개 + 신규 1개 통과

- [ ] **Step 4: 커밋한다**

```bash
git add e2e/smoke.spec.ts
git commit -m "[APP-208] full 화면에서 프로젝트 선택이 목록으로 돌아가는지 e2e로 못박는다"
```

---

### Task 3: 문서를 맞추고 내린다

**Files:**
- Modify: `docs/frontend-architecture.md` (상태 경계 절)

- [ ] **Step 1: 아키텍처 문서에 한 줄을 더한다**

상태 경계가 **바뀌지 않았으므로** "지역 상태다"는 그대로 둔다. 대신 왜 지역 상태인 채로도
화면이 반응하는지를 한 줄 붙인다.

```markdown
- workspace 선택: 현재 project 선택은 workspace shell의 지역 상태다. URL 공유가 필요해질 때만 search param으로 승격한다. 노트가 열린 상태에서 project를 고르면 노트를 닫고 목록으로 돌아간다 — 노트 표면이 본문 컬럼을 덮어서 필터만 바꾸면 화면이 반응하지 않는 것처럼 보이기 때문이다.
```

- [ ] **Step 2: 전체 검증**

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

- [ ] **Step 3: codex 리뷰**

```bash
codex exec review --base dev
```

- [ ] **Step 4: dev에 머지하고 이슈를 닫는다**

skill `merging`을 따른다. 머지 직후 Linear를 Done으로 옮기고 완료 댓글을 단다. 댓글에
**side 뷰 실측 결과**와 **승격을 안 한 이유**를 남긴다 — 이슈가 둘 다 물었다.
