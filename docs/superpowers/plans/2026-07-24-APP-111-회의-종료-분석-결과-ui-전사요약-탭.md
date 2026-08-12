# APP-111 회의 종료 + 분석 결과 UI 구현 계획

**Goal:** 노트 full에 회의 조작권(시작자 단독)·요약 탭(분석 상태·마크다운·재분석)을 더한다.

**Tech Stack:** Next.js 16, TanStack Query v5, orval, MSW, vitest, shadcn(AlertDialog·Tabs·Alert·Button).

## Global Constraints

- 조작권 판정 = `note.meetingStartedBy?.userId === useAuth().user?.userId`.
- 404 분석(`ANALYSIS_JOB_NOT_FOUND`)은 오류 아니라 빈 상태.
- 분석 폴링은 status PENDING/RUNNING일 때만.
- 마크다운은 문단·`-`·`1.`만 — 새 의존성 금지.
- 지속 상태 인라인, mutation 실패 토스트(전역 MutationCache).
- 검증: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`.

---

### Task 1: 최소 마크다운 렌더러 (`lib/markdown/render-markdown.tsx`)

**Files:** Create `lib/markdown/render-markdown.tsx`, `lib/markdown/render-markdown.test.tsx`.

**Produces:** `renderMarkdown(source: string): React.ReactNode` — 빈 줄로 블록 분리, `- ` → `<ul><li>`, `1. ` → `<ol><li>`, 그 외 → `<p>`.

- [ ] 테스트: 문단, `-` 불릿 목록, `1.` 번호 목록, 혼합, 빈 문자열.
- [ ] 구현: 줄 파싱. 표·코드블록·인라인 강조 미지원(주석).
- [ ] `pnpm test:run lib/markdown` 통과. Commit: `feat(app-111): 최소 마크다운 렌더러`.

### Task 2: 요약 탭 (`components/notes/note-summary.tsx`)

**Files:** Create `components/notes/note-summary.tsx`, `.test.tsx`.

**Consumes:** `useGetLatestAnalysis`, `useRequestAnalysis`, `renderMarkdown`, `errorCodeOf`, `note.meetingStatus`(ENDED 판정).

- 상태: 404(`ANALYSIS_JOB_NOT_FOUND`)→빈 상태(ENDED면 요약 만들기 버튼) / PENDING·RUNNING→스켈레톤(refetchInterval) / SUCCEEDED→마크다운 3종 / FAILED→Alert+다시 분석. ENDED 전엔 안내.

- [ ] 테스트: 다섯 상태 렌더 + 요약 만들기/다시 분석 mutation 호출 + 폴링 조건.
- [ ] 구현.
- [ ] `pnpm test:run components/notes/note-summary` 통과. Commit: `feat(app-111): 요약 탭 — 분석 상태·마크다운·재분석`.

### Task 3: 회의 조작 컨트롤 (`components/notes/meeting-controls.tsx`)

**Files:** Create `components/notes/meeting-controls.tsx`, `.test.tsx`.

**Consumes:** `note`(meetingStatus·meetingStartedBy), `useAuth().user`, `usePauseMeeting`, `useResumeMeeting`. 종료는 Task 4 다이얼로그를 연다.

- 시작자: IN_PROGRESS→중지+종료, PAUSED→재개+종료. 뷰어: pill + "OO님이 시작한 회의". ENDED/미시작: 조작 없음.

- [ ] 테스트: 시작자 IN_PROGRESS/PAUSED 버튼, 뷰어 힌트+버튼 없음, ENDED 없음.
- [ ] 구현.
- [ ] `pnpm test:run components/notes/meeting-controls` 통과. Commit: `feat(app-111): 회의 조작 컨트롤 (시작자 단독)`.

### Task 4: 종료 확인 다이얼로그 (`components/notes/meeting-end-dialog.tsx`)

**Files:** Create `components/notes/meeting-end-dialog.tsx`, `.test.tsx`.

**Consumes:** `useEndMeeting`(analysis 모듈), 녹음 상태(`useRecording`), `errorCodeOf`.

- `AlertDialog` 확인 → `useEndMeeting`. 녹음 중이면(`hasActiveSession`) 409 예상 → 다이얼로그가 destructive Alert + `녹음 중지` 액션(녹음 stop 호출). "녹음 상태" 행 표시.

- [ ] 테스트: 확인→endMeeting 호출, 녹음 중이면 녹음 중지 액션 노출.
- [ ] 구현.
- [ ] `pnpm test:run components/notes/meeting-end-dialog` 통과. Commit: `feat(app-111): 회의 종료 확인 다이얼로그 + 409 분기`.

### Task 5: 노트 패널 3탭 + 앱바 조작 (`note-panel.tsx`)

**Files:** Modify `components/notes/note-panel.tsx`, `note-view.tsx`(NoteTab 타입), `note-panel.test.tsx`.

- `NoteTab`에 `"summary"` 추가. full 모드 3탭. 앱바에 `<MeetingControls>`. 요약 탭 = `<NoteSummary>`.

- [ ] 테스트: full 3탭, 요약 탭이 NoteSummary 렌더, 앱바에 MeetingControls.
- [ ] 구현.
- [ ] `pnpm test:run components/notes/note-panel` 통과. Commit: `feat(app-111): 노트 3탭 + 앱바 회의 조작`.

### Task 6: 검증 + 브라우저 + e2e

- [ ] 브라우저 실측: 시작자 조작·종료 다이얼로그·요약 탭 상태(목).
- [ ] 전체 검증 통과. Commit: `test(app-111): 회의 종료·분석 e2e`.

## Self-Review

- 스펙 커버: 마크다운(T1)·요약 상태(T2)·조작권(T3)·종료 다이얼로그(T4)·3탭(T5)·검증(T6).
- 타입 일관: `NoteTab` 확장(T5)을 note-view가 소비, `renderMarkdown`(T1)을 T2가 소비.
