# APP-154 워크스페이스 셸 — 좌측 사이드바 재구성 설계

**목표:** v5 사이드바 정본(sLzX8)과 상단 크롬 1단(MFFmb)을 코드에 반영한다. 사이드바 상단 120→56, 유저·설정을 최하단으로, full 모드에서 사이드바 유지, 노트 액션을 상단바 한 줄로 통합.

**입력:** 프레임 `sLzX8`(사이드바)·`LHXhy`(허브)·`MFFmb`(노트 full), CHROME/MOTION SPEC, 현재 `workspace-*`·`note-*`·`meeting-controls` 트리, `openapi3.yml`(계약 불변).

**범위 밖:** 알림 표면(APP-157), 노트 상세 내부 탭·전사·요약 재구성(APP-155), 설정 push(LNplj 폐기), 노트 side 시트(계승), **노트 허브 목록 행 flat 재구성·필터 칩(drift #1 — 154 완료 조건 아님, 후속으로 뺀다).**

## 자문자답으로 잡은 것

### 사이드바 상단 120 = 유저 카드(64) + 워크스페이스 스위처(56)

실측: `workspace-sidebar`의 `SidebarHeader`가 유저 프로필 드롭다운(64) → hairline → 워크스페이스 스위처(56) → hairline로 120px를 쓴다. v5 정본(sLzX8): **상단은 워크스페이스 1줄(56)만**, 유저 아바타+설정 기어는 **최하단 UserBar**(상단 hairline). shadcn `SidebarFooter`로 내린다. 유저 드롭다운(내 계정 설정·로그아웃)은 그대로, 트리거만 하단으로 이동하고 chevron→기어.

### 상단 크롬 2단은 full 노트에서 난다

허브 상단바는 이미 1단(브레드크럼+벨). **2단은 노트 full에서** 난다 — 셸 브레드크럼 바(`WorkspaceToolbar`, top-0) + `NotePanel`의 자체 `<header>`(제목+회의조작+닫기)가 겹친다. v5 정본(MFFmb): **한 줄** — 좌 브레드크럼(노트 제목 포함) · 우 [노트 액션 슬롯] → 새 노트 → 벨.

**해소:** 셸 상단바를 노트-aware로 만든다. `activeNoteId`가 있고 full이면 상단바가 노트 제목 브레드크럼 + 노트 액션(회의 종료·pause/resume·패널 토글)을 그린다. `NotePanel` full 헤더의 액션 버튼(MeetingControls·expand·close)을 뺀다. 제목/배지/메타는 본문 블록으로 남긴다(바 테두리 제거, 155가 더 다듬음).

### "중지"는 상단바에 두지 않는다 (drift #7) — 단, 회의 중지(pause)는 남긴다

`MeetingControls`의 "중지"는 두 동작이 섞여 있다: 녹음 중 `stoppable`이면 `recording.stop()`(**녹음 중지 = 레코더 독과 같은 동작**), 아니면 `pauseMeeting`(**회의 중지 = 서버 PAUSED**). MOTION SPEC "중지 1개 = 독"은 **녹음 중지 중복**을 없애라는 것이다. 그래서 `MeetingControls`에서 **녹음 중지 분기(`recording.stop()` 호출)를 제거**하고 — 녹음 중지는 하단 레코더 독이 단독으로 맡는다 — **회의 중지(pause)/재개/종료는 유지**한다. 녹음 중에는 pause가 계약상 409이므로 disabled+안내로 둔다(기존 동작 계승). 회의 pause를 통째로 지우면 PAUSED 진입 경로가 사라지므로 지우지 않는다.

### full 모드가 워크스페이스를 덮어 내비를 잃는다

`workspace-route-layout`가 full일 때 `hideSidebar`로 사이드바를 없앤다. full 노트 표면은 `SidebarInset` 안 `absolute inset-x-0 top-16`이라, 사이드바를 다시 그리면 자연히 255 우측에 앉는다. **`hideSidebar` 제거 — 사이드바를 항상 그린다.** 다른 노트로 이동 가능해진다.

### 새 노트를 상단바로

CHROME SPEC·LHXhy: 새 노트는 상단바 우측(벨 왼쪽). 현재는 허브 본문 헤더 버튼이다. 생성 로직(`handleCreateMeeting`: 노트 생성 → 낙관 갱신 → 라우팅 → 녹음 시작)을 `useCreateMeeting(workspaceId)` 훅으로 빼 상단바가 소비한다. 허브 본문 헤더의 버튼과 "MEETING NOTES" 대문자 키커(FORM SPEC 금지)를 제거하고, 제목은 `text-screen-title`(34) 토큰으로.

## 구현 (파일)

- `workspace-sidebar.tsx` — 스위처 상단 1줄, 유저 프로필 `SidebarFooter` 하단(기어).
- `workspace-route-layout.tsx` — `hideSidebar` 제거(항상 사이드바).
- `workspace-app-shell.tsx` / `workspace-toolbar.tsx` — 상단바 노트-aware(브레드크럼 노트 제목 + 노트 액션 슬롯 + 새 노트 + 벨). `useGetNote`(프리페치 캐시) 소비.
- `note-panel.tsx` — full 헤더 액션 제거, 제목/메타 본문 블록화(바 테두리 완화).
- `meeting-controls.tsx` — 녹음 중지 분기 제거(독 단독), 회의 pause/resume/종료 유지.
- `lib/workspace/use-create-meeting.ts`(신규) — 생성 로직 추출. `workspace-page.tsx`가 소비, 상단바도 소비.
- `workspace-page.tsx` — 키커·버튼 제거, 제목 34 토큰.

## 완료 조건

- [ ] 사이드바 상단 56 한 줄, 유저·설정 최하단 (sLzX8 대조)
- [ ] 상단 크롬 1단 — 노트 액션·새 노트·벨이 한 행 (MFFmb 대조)
- [ ] full 모드에서 사이드바 보이고 다른 노트 이동 가능
- [ ] 녹음 중지는 독 단독, 회의 pause/resume/종료는 상단바
- [ ] 컴포넌트 테스트(vitest) — 사이드바 하단 유저·상단 스위처, 상단바 노트 액션, full 사이드바 존재
- [ ] 게이트 통과 · `codex exec review --base dev` P1 없음 · Playwright 실측 대조

## 링크

- 이슈: https://linear.app/minswon/issue/APP-154
- 근거: `docs/design/v5-spec-notes.md`(CHROME·MOTION SPEC), 프레임 sLzX8·LHXhy·MFFmb
- 후속(별도): 노트 허브 목록 행 flat 52/r8·필터 칩(drift #1) — 154 조건 아님, 155 이후 정리 제안
