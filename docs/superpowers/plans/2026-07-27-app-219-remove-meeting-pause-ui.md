# 회의 중지·재개 UI 제거 계획 (APP-219)

설계: [`../specs/2026-07-27-app-219-remove-meeting-pause-ui-design.md`](../specs/2026-07-27-app-219-remove-meeting-pause-ui-design.md)
server 쪽 판단 근거: `heymoa-server/docs/superpowers/specs/2026-07-27-app-218-meeting-paused-removal-design.md`

## 1단계 — 계약과 생성물

- [x] `openapi3.yml` — 경로 2개·`MeetingStatusResponse` 스키마·`meetingStatus`의 `PAUSED`·
      오류 코드 2개 제거, `MEETING_NOT_ACTIVE` 문구 갱신 (34경로 → 32)
- [x] docs 미러에서 파생한 정본과 깊은 비교로 검증
- [x] `pnpm orval` — `lib/api/generated/meeting/` 소멸 확인

## 2단계 — 컴포넌트

- [x] `components/notes/meeting-controls.tsx` — 중지·재개 버튼, `usePauseMeeting`·
      `useResumeMeeting`, `useRecording`, `useQueryClient` 제거. `회의 종료`만 남긴다
- [x] `lib/notes/meeting-state.ts` — `SharedChatPhase`에서 `paused` 제거, 주석 갱신
- [x] `components/notes/shared-chat-panel.tsx` — 중지 컴포저 안내 제거.
      죽은 `onOpenPersonal` prop·`usePersonalChat()` 호출·`PauseCircle` import 정리
- [x] `components/notes/note-panel.tsx` — `meetingLive`에서 `paused` 항 제거
- [x] `components/notes/note-view.tsx`·`components/chat/personal-chat.tsx` — 주석 갱신

## 3단계 — 목

- [x] `lib/mocks/rest-handlers.ts` — `meeting-pause`·`meeting-resume` 핸들러 제거
- [x] `lib/mocks/db.ts` — `pauseMeeting`·`resumeMeeting` 제거, 미사용 타입 import 정리
- [x] 전사 세션 생성 목의 거절 사유를 `MEETING_ALREADY_ENDED`로 (계약과 일치)

## 4단계 — 테스트

- [x] `meeting-controls.test.tsx` 재작성 — 축소된 컴포넌트에 맞춰 6케이스
- [x] `meeting-state.test.ts`·`shared-chat-panel.test.tsx`·`db.test.ts`·
      `rest-handlers.test.ts` — PAUSED 케이스 제거·대체
- [x] `openapi-contract.test.ts` — 경로 수 34 → 32
- [x] e2e 회귀 추가 — 상단바에 `회의 종료`만, `중지`·`재개` 0개, `기록 시작` 유지

## 5단계 — 디자인

- [x] `mvp.pen` v5 세대(y40000~50000)에서 `PauseBtn` **8개 삭제**

| 프레임 | 노드 |
|---|---|
| `v5/note-full/transcript` | `jepAu` |
| `v5/note-full/details` | `k6klUR` |
| `v5/note-full/chat-closed` | `ASzfd` |
| `v5/chat/shared-streaming` | `vczrA` |
| `v5/chat/approval-pending` | `c3khzo` |
| `v5/chat/approval-result` | `Tqn3w` |
| `v5/state/skeleton` | `mJENG` |
| `v5/state/meeting-end` | `lpXxL` |

`v5/note-full/summary`·`v5/note-side/*`에는 원래 없었다(종료 상태라 상태 pill만).

- [ ] **v1·v2·v4 세대에 24개(`PauseBtn` 19 + `Btn 중지` 5)가 남아 있다.** APP-213이
      캔버스를 현재 상태 하나로 재구성하는 중이라 그쪽에서 세대째 사라진다 —
      여기서 손대면 충돌만 만든다

## 검증

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

- [x] 430 unit · 13 e2e 전부 통과

## 머지 전

- [x] `codex exec review --base dev` — [P2] 하나, 배포 순서 정정으로 반영
      ([`docs/codex-review-app-219.md`](../../codex-review-app-219.md))
- [ ] **APP-218(server)을 먼저 배포하고 이것을 뒤에 올린다.** 처음 적은 web-first는 틀렸다
