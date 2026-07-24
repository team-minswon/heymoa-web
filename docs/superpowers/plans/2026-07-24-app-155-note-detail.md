# APP-155 노트 상세 재디자인 계획

**Goal:** 세 탭 대문자 키커 제거, 전사 행 단일 밀도, 읽기 폭 820 통일, note-details 카드 고도 정합. 레코더 독 불변.

## Task 1: transcript-view

- 헤더 블록(키커 `Conversation`/상태 라벨 + 세리프 `대화 기록`) 제거, `statusLabel` 제거.
- 전사 행: `grid-cols-[64px_1fr] gap-5 py-4`(단일), 본문 `text-read`. partial 행도 동일 grid.
- 컨테이너 `max-w-[820px]` 유지, 본문 중복 `max-w-3xl` 제거.
- 테스트: transcript-view.test 갱신(키커 사라짐, 행 grid).

## Task 2: note-summary

- `AnalyzingSkeleton`의 `Analyzing` 키커 제거(세리프 유지). `SummarySections`·`Shell` 유지.

## Task 3: note-details

- `Note details` 키커 제거(세리프 `노트 정보` 유지).
- 컨테이너 `max-w-[820px]`(Shell 규격)로. 카드 `rounded-2xl shadow-[…]` → `rounded-block` + hairline, 그림자 제거.

## Task 4: 게이트·검증·머지

- 컴포넌트 테스트, `pnpm test:run && lint && typecheck && build && test:e2e`.
- Playwright full(Ftvu9/m0eVmx/AB8zp)·side 대조. 레코더 독 폭 전환 육안 확인(코드 불변이므로 회귀 없음).
- `codex exec review --base dev` P1 없음 → dev squash merge, Linear Done.

## Self-Review
- 레코더 독(recording-dock.tsx) 손대지 않음 — 모션 계승.
- 계약 불변. 우측 트레이(shared-chat-panel) 내부 안 건드림 — 156.
- SummarySections는 이미 SPEC 준수(한글 세리프) — 프레임 잔재를 따르지 않는다.
