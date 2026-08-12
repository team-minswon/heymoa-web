# APP-280 side 회의 면 구현 계획

> Base: `origin/dev` at `433e6a2`
> Branch: `feature/app-280-side-meeting`
> Scope: `heymoa-web` only; generated API and contracts untouched

## Goal

기본 진입점인 side 노트에서 회의 상태와 시작자를 확인하고, 시작자는 회의를 종료하며,
진행 중에는 전사와 공유 챗봇을 전환하고 종료 뒤에는 기록과 요약을 전환한다.

## Decisions

- full은 기존 전사 + 공유 챗봇 동시 레이아웃을 유지한다.
- side는 기존 탭 안에서 `SharedChatPanel`, `NoteArchive`, `NoteSummary`를 그대로 재사용한다.
- side 헤더의 회의 표시는 기존 `MeetingControls`에 표시 옵션만 더해 재사용한다.
- side에서 회의를 시작하는 레코더 독은 추가하지 않고, 이미 도는 녹음의 종료 독만 유지한다.
- 진행 중 side 탭은 `전사 · 챗봇 · 노트 정보`, 종료 side 탭은
  `기록 · 요약 · 노트 정보`다.

## Task 1 — 탭 계약과 헤더 회의 상태

Files:

- `components/notes/note-view.tsx`
- `components/notes/note-view.test.tsx`
- `components/notes/meeting-controls.tsx`
- `components/notes/meeting-controls.test.tsx`
- `components/notes/note-panel.tsx`
- `components/notes/note-panel.test.tsx`

Steps:

1. side query가 `chat`과 `summary`를 보존하는 실패 테스트를 쓴다.
2. side 헤더에서 시작자·상태·권한별 종료 버튼을 검증하는 실패 테스트를 쓴다.
3. `MeetingControls`에 side 표시 옵션만 추가하고 full 동작은 유지한다.
4. side 회의 종료 콜백이 요약 탭으로 이동하게 연결한다.
5. 관련 Vitest와 typecheck를 실행하고 커밋한다.

## Task 2 — 상태별 side 탭과 공유 챗봇

Files:

- `components/notes/note-panel.tsx`
- `components/notes/note-panel.test.tsx`

Steps:

1. 진행 중 side의 `전사 · 챗봇 · 노트 정보`와 챗봇 탭 내용을 실패 테스트로 고정한다.
2. 종료 side의 `기록 · 요약 · 노트 정보`와 아카이브/요약 내용을 실패 테스트로 고정한다.
3. 공유 답변 중 종료되어도 턴이 끝나기 전에 패널을 언마운트하지 않는 회귀 테스트를 둔다.
4. full 트레이와 기존 종료 전환 계약이 그대로인지 관련 테스트로 확인한다.
5. 관련 Vitest, lint, typecheck를 실행하고 커밋한다.

## Task 3 — 실제 side 경로 검증

Files:

- `e2e/smoke.spec.ts`

Steps:

1. MSW foreign viewer 노트를 side로 열어 상태·시작자·3개 탭·챗봇 입력을 검증한다.
2. MSW starter 노트를 side로 열어 회의 종료 버튼이 보이는지 검증한다.
3. 종료 노트를 side로 열어 `기록 · 요약 · 노트 정보`와 요약 내용을 검증한다.
4. focused Playwright, 관련 Vitest, typecheck를 실행하고 커밋한다.

## Task 4 — 통합·검증·병합

1. controller가 구현 역할별 조사와 diff를 통합 검토한다.
2. `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`
3. `claude-opus-5`, `--effort medium`, `--permission-mode plan`,
   `--no-session-persistence` 검증자 2개를 서로 다른 공격 렌즈로 병렬 실행한다.
4. P1/P2는 TDD로 수정하고 전체 게이트와 두 검증을 다시 돌린다.
5. `dev`에 squash commit `[APP-280] side를 회의 면으로`로 병합하고 push한다.
6. 판단 기록을 남기고 Linear를 Done으로 바꾼다.

## Acceptance

- 진행 중 side: 상태와 시작자가 보이고 시작자에게만 회의 종료 버튼이 있다.
- 진행 중 side: `전사 · 챗봇 · 노트 정보`, 챗봇 탭에 공유 챗봇이 있다.
- 종료 side: `기록 · 요약 · 노트 정보`, 기록은 아카이브이고 요약은 분석 화면이다.
- side에서 새 녹음을 시작하는 독과 개인 챗봇은 추가되지 않는다.
- full의 공유 챗봇 상시 트레이와 기존 회의 조작이 유지된다.
- 전체 web 게이트와 독립 Opus 검증 2회 통과.
