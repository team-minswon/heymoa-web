# APP-207 챗봇 패널 스크롤 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개인·노트 챗봇에서 긴 대화가 스크롤되고 새 메시지가 하단으로 따라오게 한다.

**Architecture:** 수정은 CSS 클래스 하나씩 둘이다. 스크롤 JS는 정상이므로 건드리지 않는다. 이 레포가 이미 쓰는 `min-h-0 flex-1` 관용구로 맞추는 것이 전부다.

**Tech Stack:** Tailwind CSS 4, Base UI ScrollArea, Playwright

## Global Constraints

- 커밋 제목은 `[APP-207] 제목` 형식
- 코드 주석은 평서체
- 검증: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`
- **CSS 수정이라 눈으로 확인해야 확정된다.** 단위 테스트는 jsdom이라 레이아웃을 계산하지 않는다

## 왜 이것이 원인인가

flex 아이템의 기본 `min-height: auto`는 콘텐츠 높이 아래로 줄어드는 것을 막는다. 그래서
`flex-1`만 준 `ScrollArea`는 대화가 길어지면 콘텐츠만큼 커지고, 뷰포트가 `size-full`이라
같이 커진다. 결과가 `scrollHeight === clientHeight`이고, 이 한 조건에서 **증상 둘이 같이
나온다** — 스크롤할 여백이 없고, `viewport.scrollTop = viewport.scrollHeight`도 움직일 곳이
없다.

대조군이 같은 레포에 있다. `note-panel.tsx`(5곳)·`sidebar.tsx`·`settings-dialog.tsx`·
`note-route-surface.tsx`가 전부 `min-h-0`을 함께 준다. 깨진 두 곳만 빠져 있다.

## File Structure

| 파일 | 무엇 |
|---|---|
| `components/chat/personal-chat.tsx:492` | 개인 챗봇 `ScrollArea` |
| `components/notes/shared-chat-panel.tsx:216` | 노트 챗봇 `ScrollArea` |
| `e2e/smoke.spec.ts` | 스크롤 가능 여부 회귀 테스트 |

---

### Task 1: 두 패널의 ScrollArea에 min-h-0

**Files:**
- Modify: `components/chat/personal-chat.tsx:492`
- Modify: `components/notes/shared-chat-panel.tsx:216`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 개인 챗봇을 고친다**

```tsx
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
```

- [ ] **Step 2: 노트 챗봇을 고친다**

```tsx
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
```

- [ ] **Step 3: 타입과 린트를 확인한다**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과

- [ ] **Step 4: 커밋한다**

```bash
git add components/chat/personal-chat.tsx components/notes/shared-chat-panel.tsx
git commit -m "[APP-207] 챗봇 패널 ScrollArea에 min-h-0을 준다"
```

---

### Task 2: 스크롤 가능 여부를 e2e로 못박는다

**Files:**
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: Task 1의 수정
- Produces: 없음

단위 테스트는 jsdom이라 레이아웃을 계산하지 않는다. `scrollHeight`와 `clientHeight`를 실제로
재려면 브라우저가 필요하므로 Playwright에 둔다. **이 테스트는 Task 1을 되돌리면 반드시
깨져야 한다** — 그래야 회귀를 잡는다.

- [ ] **Step 1: 실패를 먼저 확인한다**

Task 1을 잠시 되돌리고(두 파일에서 `min-h-0`만 제거) 아래 테스트를 추가한 뒤 돌린다.
`scrollHeight > clientHeight`가 거짓이 되어 FAIL 해야 한다. 확인했으면 `min-h-0`을 복구한다.

- [ ] **Step 2: 개인 챗봇 스크롤 테스트를 쓴다**

`e2e/smoke.spec.ts` 맨 아래에 더한다. 셀렉터는 이미 있는 `data-testid="personal-chat-panel"`과
`ScrollArea`가 뷰포트에 붙이는 `data-slot="scroll-area-viewport"`를 쓴다.

```ts
test("keeps the personal chat scrollable when the thread is long", async ({
  page,
}) => {
  await page.goto("/w/workspace-1");
  await page.getByRole("button", { name: "챗봇 열기" }).click();

  const panel = page.getByTestId("personal-chat-panel");
  await expect(panel).toBeVisible();

  const viewport = panel.locator('[data-slot="scroll-area-viewport"]');

  // 스크롤할 여백이 생기도록 대화를 여러 번 주고받는다.
  for (let i = 0; i < 6; i += 1) {
    await panel.getByRole("textbox").fill(`긴 대화를 만드는 메시지 ${i}`);
    await panel.getByRole("textbox").press("Enter");
    await expect(panel.getByText(`긴 대화를 만드는 메시지 ${i}`)).toBeVisible();
  }

  // min-h-0이 없으면 뷰포트가 콘텐츠만큼 커져 둘이 같아진다.
  const overflow = await viewport.evaluate(
    (el) => el.scrollHeight - el.clientHeight
  );
  expect(overflow).toBeGreaterThan(0);
});
```

**셀렉터가 실제와 다르면 테스트가 아니라 셀렉터를 고친다.** 열기 버튼의 접근名과 입력창
role은 구현을 열어 확인한다 — 추측해서 쓰지 않는다.

- [ ] **Step 3: 통과를 확인한다**

Run: `pnpm test:e2e`
Expected: 기존 10개 + 신규 1개 통과

- [ ] **Step 4: 커밋한다**

```bash
git add e2e/smoke.spec.ts
git commit -m "[APP-207] 챗봇 스크롤 여백을 e2e로 못박는다"
```

---

### Task 3: 눈으로 확인하고 내린다

**Files:** 없음

- [ ] **Step 1: 실제 앱에서 셋을 본다**

`pnpm dev`로 띄우고 개인 챗봇과 노트 챗봇 각각에서 확인한다.

1. 긴 대화에서 **스크롤이 된다**
2. 새 메시지·스트리밍 중 **하단으로 따라간다**
3. 위를 읽는 중에는 **끌려 내려가지 않는다**

3번이 중요하다. `stickToBottomRef`가 바닥 48px 안일 때만 따라가게 돼 있는데, 이 수정으로
스크롤이 살아나면서 그 분기가 **처음으로 실제로 동작하기 시작한다.** 지금까지는
`scrollHeight === clientHeight`라 항상 "바닥"이었다.

- [ ] **Step 2: 전체 검증**

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

- [ ] **Step 3: codex 리뷰**

```bash
codex exec review --base dev
```

P1·P2를 고치고 다시 돌린다.

- [ ] **Step 4: dev에 머지하고 이슈를 닫는다**

skill `merging`을 따른다. 머지 직후 Linear를 Done으로 옮기고 완료 댓글을 단다.
