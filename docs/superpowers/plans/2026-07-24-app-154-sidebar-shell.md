# APP-154 워크스페이스 셸 재구성 계획

**Goal:** 사이드바 상단 120→56·유저 하단, full 모드 사이드바 유지, 상단 크롬 1단(노트 액션·새 노트·벨 한 줄). TDD.

## Task 1: 사이드바 재구성 (독립)

**Files:** `workspace-sidebar.tsx`, `workspace-sidebar.test.tsx`

- 테스트 먼저: 상단이 워크스페이스 스위처(유저 카드 아님), 하단 `SidebarFooter`에 유저 프로필+기어.
- 워크스페이스 스위처를 `SidebarHeader` 단독 1줄로. 유저 프로필 드롭다운을 `SidebarFooter`(상단 hairline)로, chevron→`Settings` 기어. 드롭다운 내용(내 계정 설정·로그아웃) 유지.
- [ ] sLzX8 구조 일치, 테스트 통과

## Task 2: full 모드 사이드바 (독립)

**Files:** `workspace-route-layout.tsx`, `note-route-surface.tsx`(top 오프셋 확인)

- `hideSidebar` 제거 — 항상 사이드바. full 표면(`absolute top-16`)이 255 우측에 앉는지 확인.
- [ ] full에서 사이드바 보임

## Task 3: 새 노트 로직 추출

**Files:** `lib/workspace/use-create-meeting.ts`(신규), `workspace-page.tsx`

- `handleCreateMeeting`(생성→낙관→라우팅→녹음 시작)를 `useCreateMeeting(workspaceId)` 훅으로. 반환: `createMeeting`, `label`, `disabled`, `isPending`.
- `workspace-page`가 훅 소비. 본문 헤더의 "MEETING NOTES" 키커·새 노트 버튼 제거, 제목 `text-screen-title`.
- [ ] 훅 단위 테스트 or 통합, 허브 렌더 유지

## Task 4: 상단 크롬 1단 (핵심)

**Files:** `workspace-toolbar.tsx`, `workspace-app-shell.tsx`, `note-panel.tsx`, `meeting-controls.tsx`

- 상단바: `activeNoteId` 있으면 `useGetNote`로 제목 브레드크럼 + 노트 액션 슬롯(`MeetingControls` + 패널 토글=닫기). 항상 우측에 새 노트(`useCreateMeeting`) + 벨.
- `note-panel.tsx` full 헤더의 액션(`MeetingControls`·expand·close) 제거. 제목/배지/메타 본문 블록 유지, 바 테두리 완화.
- `meeting-controls.tsx`: `stoppable`→`recording.stop()` 분기 제거(독 단독). 회의 pause/resume/종료 유지. 녹음 중 pause disabled+안내 유지.
- [ ] MFFmb 대조: 한 줄 상단바, 본문 제목/탭

## Task 5: 게이트·검증·머지

- [ ] 신규/변경 컴포넌트 테스트, `pnpm test:run && lint && typecheck && build && test:e2e`
- [ ] Playwright: 허브(sLzX8 사이드바)·노트 full(MFFmb 1단·사이드바) 실측
- [ ] `codex exec review --base dev` P1 없음 → dev squash merge, Linear Done

## Self-Review

- 계약 불변(useGetNote·useCreateNote 기존 훅). 참석자·상태배지 안 씀.
- 녹음 중지=독 단독은 drift #7. 회의 pause 유지는 기능 손실 방지 — SPEC "중지 1개"는 녹음 중지 중복을 지칭.
- 노트 허브 목록 행 flat(drift #1)은 154 조건 아님 — 후속으로 분리(스코프 방어).
- side 시트(계승)·노트 내부 탭(155)·알림(157) 안 건드림.
