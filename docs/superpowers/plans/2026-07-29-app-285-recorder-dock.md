# APP-285 좁은 화면 레코더 독 겹침 구현 계획

> Base: `origin/dev` at `3414c9d`
> Branch: `feature/app-285-recorder-dock`
> Scope: `heymoa-web` only; generated API and contracts untouched

## Goal

375×812 full 화면에서 시작자의 레코더 독이 전사 스크롤 viewport를 덮지 않는다.
전사와 공유 챗봇은 기본으로 함께 보이며, 뷰어는 모바일에서도 회의 시작자를 식별한다.

## Decisions

- `< lg` 독은 `NotePanel` flex 흐름의 `shrink-0` footer 레인, `lg+`만 기존 absolute floating이다.
- 모바일 전사 콘텐츠의 `pb-28`과 최신 버튼 `bottom-20`은 desktop 전용으로 낮춘다.
- 공유 챗봇은 새 탭·접이식 상태 없이 기본 표시를 유지한다. 높이는 `45vh` 대신 전사가
  지배 영역으로 남는 bounded `dvh` 값으로 줄이고 MSW에서 실측한다.
- 모바일 시작자 이름은 보이게 하고 설명 suffix만 좁은 폭에서 visually hidden 처리한다.

## Task 1 — 독 레인과 전사 하단 보정

Files:

- `components/notes/note-panel.tsx`
- `components/notes/note-panel.test.tsx`
- `components/notes/transcript-view.tsx`
- `components/notes/transcript-view.test.tsx`

Steps:

1. 독 레인이 모바일에서 `absolute`인 것을 잡는 실패 테스트를 쓴다.
2. side의 활성 녹음도 같은 레인에서 종료 버튼을 유지하는 테스트를 보강한다.
3. 독 레인을 모바일 normal flow + `shrink-0`, desktop absolute로 바꾼다.
4. 전사 content padding과 최신 버튼 offset을 mobile/desktop 반응형으로 바꾼다.
5. 관련 Vitest, lint, typecheck, diff-check를 실행하고 커밋한다.

## Task 2 — 모바일 시작자 이름

Files:

- `components/notes/meeting-controls.tsx`
- `components/notes/meeting-controls.test.tsx`

Steps:

1. 이름 자체가 `hidden` 클래스에 갇히지 않는 실패 테스트를 쓴다.
2. 모바일에는 잘린 이름을 표시하고, 전체 “님이 시작한 회의” 설명은 접근 가능한 텍스트로
   유지한다.
3. 관련 Vitest, lint, typecheck, diff-check를 실행하고 커밋한다.

## Task 3 — 실제 모바일 기하와 tray 높이

Files:

- `e2e/smoke.spec.ts`
- `components/notes/note-panel.tsx` (controller integration only)

Steps:

1. 기존 MSW starter note를 375×812 full transcript로 연다.
2. 전사 viewport, 독, 공유 tray가 모두 로드된 뒤 독/viewport 교차 높이가 0인지 검증한다.
3. 전사와 공유 챗봇이 동시에 보이고, tray가 bounded `dvh` class의 실측 범위에 있는지 검증한다.
4. foreign viewer note에서 시작자 이름이 실제로 보이고 toolbar 안에 드는지 검증한다.
5. `45vh`를 최소 bounded `dvh` 값으로 바꾸고 실측 후 필요한 경우 값만 조정한다.
6. focused Playwright, 관련 Vitest, typecheck, diff-check를 실행하고 커밋한다.

## Task 4 — 통합·검증·병합

1. controller가 task commit별 diff와 보고를 검토한다.
2. `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`
3. `claude-opus-5`, `--effort medium`, `--permission-mode plan`,
   `--no-session-persistence` 검증자 2개를 서로 다른 렌즈로 병렬 실행한다.
4. P1/P2는 TDD로 수정하고 전체 게이트와 두 검증을 다시 돌린다.
5. `dev`에 squash commit `[APP-285] 좁은 폭에서 레코더 독이 전사 본문을 가린다`로 병합하고
   push한다.
6. Linear를 Done으로 바꾸고 완료 댓글을 남긴다.

## Acceptance

- 375×812 starter full view: transcript viewport와 recorder dock의 교차 높이 0.
- 좁은 폭에서 transcript와 shared chat이 최초부터 둘 다 보인다.
- 좁은 폭의 transcript viewport가 기존 실측 257px 수준을 유지하거나 늘고, dock이 읽기 영역을
  가리지 않는다.
- 375×812 foreign viewer: 시작자 이름과 진행 중 상태가 보이고 조작 버튼은 없다.
- side 활성 녹음의 종료 버튼과 desktop floating dock은 유지된다.
- 전체 web 게이트와 독립 Opus 검증 2회 통과.
