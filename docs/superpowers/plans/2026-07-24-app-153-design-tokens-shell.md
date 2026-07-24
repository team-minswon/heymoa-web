# APP-153 디자인 토큰·공용 셸 정합 계획

**Goal:** 고도·형태·타이포 토큰을 `globals.css`에 추가하고, 공용 셸 크롬을 토큰으로 정합하고, `DESIGN.md`·`AGENTS.md`에 마케팅/제품 경계를 문서화한다.

**Tech:** Tailwind v4 `@theme inline` 토큰, vitest 회귀 테스트. 화면 재구성 없음.

## Task 1: 토큰 회귀 테스트 (TDD, 먼저 실패)

**Files:** `lib/design-tokens.test.ts`

- `app/globals.css`를 읽어 필수 토큰 존재를 단언: `--shadow-e2`·`--shadow-e3`·`--radius-panel`·`--radius-block`·`--radius-control`·`--radius-chip`·`--text-screen-title`·`--text-note-title`·`--text-section`·`--text-panel-title`·`--text-read`.
- e2/e3 그림자가 2연타(콤마 포함)인지 단언 — 단일 티어 회귀 방지.
- [ ] 테스트 작성 → 지금은 실패

## Task 2: 토큰 추가

**Files:** `app/globals.css`

- `@theme inline` 블록에 고도(`--shadow-e2/e3`)·형태(`--radius-panel/block/control/chip`)·타이포(`--text-screen-title/note-title/section/panel-title/read`) 추가.
- [ ] Task 1 테스트 통과

## Task 3: 공용 셸 크롬 정합 (비구조적)

**Files:** `components/workspace/workspace-toolbar.tsx`, `components/workspace/workspace-sidebar.tsx`

- 레코더 pill `shadow-[0_8px_32px_...]` → `shadow-e2`.
- 사이드바 드롭다운/메뉴 오버레이 `shadow-[0_4px_16px_rgba(0,0,0,0.08)]` 3곳 → `shadow-e3`.
- 노트 목록 행·빈 상태·리스트는 **건드리지 않는다**(APP-154 재구성).
- [ ] raw shadow 치환, 구조 불변

## Task 4: 문서

**Files:** `DESIGN.md`, `AGENTS.md`

- `DESIGN.md` 제품편 신설(마케팅/제품 분리 — spec 참조).
- `AGENTS.md` Styling 절: 단일 Cards 규칙 → 마케팅/제품 분리, 제품 고도/형태 토큰 명시.
- [ ] 두 문서가 코드와 일치

## Task 5: 게이트·검증·머지

- [ ] `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`
- [ ] Playwright로 워크스페이스·노트·설정 화면이 안 깨졌는지 실측(그림자만 바뀜)
- [ ] `codex exec review --base dev --title "APP-153 디자인 토큰·공용 셸 정합"` P1 없음
- [ ] dev squash merge + push, APP-153 Done

## Self-Review

- spec 커버: 토큰 3종(T2)·셸 정합(T3)·DESIGN 제품편(T4)·AGENTS(T4)·회귀 테스트(T1)
- 재구성 없음이 핵심 — note-list 구조는 154. 여기서 만지면 154와 충돌하고 스코프가 샌다.
- 토큰 이름은 역할 기반(panel/block/control/chip, e2/e3) — 154~157이 크기 대신 이름을 소비한다.
