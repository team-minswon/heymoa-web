# 녹음·전사와 에이전트 채팅 코드 책임 분리 — web 구현 순서

- 이슈: [APP-747](https://linear.app/minswon/issue/APP-747)
- spec: docs `origin/docs/app-747/code-cleanup:projects/PRO-51-실시간-전사-끊김-복구/spec/APP-747/spec.md` @ `2852b03`
- 프로젝트 브랜치: 없음 (web 은 dev 에 로컬 squash)
- APP 브랜치: `refactor/app-747/code-cleanup` ← `origin/dev`
- 병합: 메인 세션이 로컬 squash 로 dev 에 넣는다. 이 브랜치는 push 만 한다
- 검증: `pnpm test:run && pnpm verify`, 그리고 `pnpm test:e2e`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 없음. `openapi3.yml`·`asyncapi.yml`·STOMP 프레임·로그 이벤트 이름(`logTranscription` 첫 인자)을 안 바꾼다. 바뀌는 것은 web 내부 콜백 모양(`RealtimeSessionOptions.onFailure`)뿐이고 호출부는 provider 하나다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 줄 수·주석 비율은 검토가 `627b1dd` 에서 센 값이다. 이 plan 은 그 숫자로 판정하지 않고 테스트 통과로 판정한다 |
| 경계 | 영향받는 호출자·테스트 더블 | `onFailure` 는 `recording-provider.tsx` 와 두 테스트 파일이 부른다. 리스·탭 ID 는 `recording-provider.tsx`·`note-panel.tsx`·두 테스트가 import 한다. `getNoteTopicWebSocketUrl` 은 `note-realtime-provider.tsx` 와 두 테스트의 `vi.mock` 이 쓴다. 노트 목록 무효화(`isNoteListQueryKey` predicate)는 컴포넌트 여섯 곳이 같은 줄을 적는다 |
| 되돌리기 | 복구 비용 | squash 커밋 하나의 revert. 데이터·계약 모양을 안 바꾼다 |
| 사람에게 물은 것 | 열린 질문 | spec 에 없음 |

## 건드리는 것

| 파일 | 지금 | 바뀐 뒤 |
|---|---|---|
| `lib/transcription/socket.ts` | STOMP 전송 | 전사 WS 주소(`transcriptionWebSocketUrl`)를 같이 둔다 |
| `lib/notes/note-topic-client.ts` | 주소 함수 복제본을 가짐 | 복제본을 지우고 위를 쓴다 |
| `lib/notes/invalidate.ts` | (신규) | 노트·노트 목록·전사 무효화 |
| `lib/transcription/recorder-lease.ts` | (신규) | `realtime-session.ts` 의 탭 ID·localStorage 리스를 옮긴다 |
| `lib/transcription/realtime-session.ts` | 세션 + 리스 | 세션만. 실패를 `onFailure(kind, detail)` 로 알린다 |
| `lib/notes/note-realtime-reducer.ts` | (신규) | `note-realtime-provider.tsx` 안의 reducer 를 옮긴다 |
| `lib/transcription/presentation.ts` | 행 세우기 | 저장본·실시간 병합과 partial 출처 선택 selector 를 더한다 |
| `components/notes/transcript-view.tsx` | 병합·선택 로직을 가짐 | selector 를 부른다 |
| `lib/transcription/recording-state.ts` | (신규) | 녹음 상태 reducer 와 실패 문구 |
| `components/transcription/recording-provider.tsx` | `useState` 12·`useRef` 11 | reducer 하나 + 자원 ref(컨트롤러·teardown 카운터·취소·stop 약속) |
| `lib/chat/turn-messages.ts` | (신규) | 턴 화면 계산(접기·시각 얼리기·재조정 판정) |
| `lib/chat/use-chat-turn.ts` | (신규) | `PersonalChatPanel` 의 턴 수명(전송·재진입·재동기·중지·대화 전환) |
| `components/chat/personal-chat.tsx` | 패널이 턴 수명을 쥠 | 패널은 컴포저와 그리기만 |

## 순서

### 1. 중복과 떠 있는 주석 정리
- 바꾸는 것: WS 주소 함수 하나로, 무효화 헬퍼 공유, `setTurnActive`·`onMicrophoneChange` 래퍼 제거, `personal-chat.tsx` 의 떠 있는 주석·중복 주석
- 검증: `pnpm test:run`, `pnpm typecheck`
- 되돌리기: 이 커밋만 revert

### 2. 실패 종류를 문자열에서 종류로
- 바꾸는 것: `realtime-session.ts` 의 `fail`·`failStop`·`checkWindow`·`sendStop` 이 종류를 넘기고, provider 가 종류로 문구를 만든다. 「재개 창 소진」 여부를 문구 접두사가 아니라 상태로 든다
- 검증: 종류를 바꿔도 문구가 같은지 provider 테스트, `pnpm test:run`
- 되돌리기: 이 커밋만 revert

### 3. 순수 로직을 lib 로
- 바꾸는 것: 리스·탭 ID → `recorder-lease.ts`, 노트 reducer → `note-realtime-reducer.ts`, 전사 selector → `presentation.ts`. 새 순수 함수에 단위 테스트
- 검증: `pnpm test:run`
- 되돌리기: 이 커밋만 revert

### 4. 녹음 상태 reducer
- 바꾸는 것: 리셋 목록 네 벌을 reducer 한 벌로, ref 미러 넷을 상태 저장소 하나로, `setTimeout(0)` 셋을 걷는다. `teardownCount`·`cancelled()`·`tornDown()` 구분은 그대로 둔다
- 검증: provider 테스트 전부, reducer 단위 테스트, `pnpm test:e2e` 녹음 흐름
- 되돌리기: 이 커밋만 revert

### 5. 채팅 턴 훅
- 바꾸는 것: `useChatTurn` 으로 턴 수명을 옮기고 패널은 컴포저·스크롤·그리기만. 채팅 파일 주석을 불변식만 남긴다
- 검증: personal-chat 테스트 전부, `pnpm test:e2e` 채팅 흐름
- 되돌리기: 이 커밋만 revert

## 마지막 관문

5단계가 끝난 뒤 `pnpm test:run && pnpm verify` 와 `pnpm test:e2e` 를 통째로 한 번 돌린다. 그 뒤 적대적 리뷰 지적을 고칠 때마다 다시 돌린다.

## 안 하는 것

- `realtime-session.ts` 의 재부착·정지 구조(`reattachLoop`·`attachUnlessBounced`·trailing·`stopOnce`)
- `note-realtime` 의 `transcript-reset` 규칙(저장본이 정본, catch-up 은 `persistedThrough` 이하만 덜어 냄)
- 경과 타이머를 시작 시각 기준으로 바꾸는 것 — 동작 변경이라 별도 안건
- `socket.ts` 가 이벤트 의미를 조금 아는 것 — 검토가 그대로 두기를 권했다
