# APP-162 노트 허브 목록 flat 계획

## Task 1: 상대 시각 포매터 (TDD)

**Files:** `lib/format/relative-time.ts`, 테스트.

- `formatRelativeTime(iso, now)` 순수 함수: 방금/n분 전/n시간 전/어제/n일 전/지난주/n주 전/n개월 전/n년 전. 테스트 먼저.

## Task 2: 목록 행 flat

**Files:** `note-list-row.tsx`(+테스트)

- 카드→`flex h-[52px] items-center gap-[14px] rounded-control px-3 hover:bg-canvas-soft`. 파일 아이콘(녹음 중이면 미터) + 제목 `text-read truncate` + 우측 `RelativeTime`(마운트 후 상대, fallback 절대 짧은 날짜). 배지·녹음시간·절대시각·세리프 제거. 메뉴 유지.

## Task 3: 목록 flat + 필터

**Files:** `workspace-note-list.tsx`(+테스트), `workspace-page.tsx`(+테스트)

- `workspace-note-list`: `groupNotesByDate` 제거, `updatedAt` 내림차순 flat + 행 사이 hairline. 빈 상태 카드 그림자 정리.
- `workspace-page`: 칩 `전체`·`내가 시작`(`useAuth` userId === meetingStartedBy.userId) 상태 + 필터 적용.

## Task 4: 게이트·검증·머지

- 테스트, `pnpm test:run && lint && typecheck && build && test:e2e`.
- Playwright 허브 LHXhy 대조(flat 행·필터 칩·상대시각).
- `codex exec review --base dev` P1 없음 → dev squash merge, Linear Done.

## Self-Review
- 계약 불변(meetingStatus 안 씀). 상태 배지·녹음중 필터 안 만듦.
- 상대시각 하이드레이션 안전(마운트 후 now).
- e2e 워크스페이스 렌더 테스트가 목록에 의존 — 셀렉터 확인.
