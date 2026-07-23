# APP-111 codex 게이트 기록

`codex exec review --base dev`. 지적은 전부 실재해 전부 반영했다.

## R1 — 2건 P2

### 1. 다른 참가자가 종료하면 요약 탭이 stale (note-summary.tsx)

요약 탭을 종료 전에 열어 두면 404가 폴링을 멈추는데, 다른 참가자가 회의를 끝내
`isEnded`가 참으로 바뀌어도 같은 쿼리 키라 다시 읽지 않아 "아직 요약이 없습니다"에 갇히고,
요약 만들기 버튼이 `ANALYSIS_IN_PROGRESS`(자동 분석이 이미 있음)를 맞을 수 있었다.

**반영:** `isEnded` 전이에 `refetch`하는 effect + 종료됐는데 아직 분석을 못 봤으면(404)
자동 생성된 분석을 잡으려 계속 폴링하도록 `refetchInterval`을 확장.

### 2. 녹음 중 중지는 항상 409다 (meeting-controls.tsx)

시작자가 이 노트를 녹음 중이면 `meeting-pause`가 계약상 `ACTIVE_TRANSCRIPTION_SESSION`으로
반드시 막히는데 중지 버튼이 그대로 mutation을 불렀다.

**반영:** 종료와 같은 "먼저 녹음 중지" 흐름 — 녹음 중이면 중지 버튼이 `녹음 중지`로 바뀌어
`recording.stop()`을 먼저 부른다(항상 실패하는 액션을 노출하지 않는다).

## R2 — 2건 P2

### 1. 종료가 요약 탭으로 넘어가지 않는다 (meeting-end-dialog.tsx)

전사·노트정보 탭에서 종료하면 다이얼로그만 닫히고 현재 탭에 남아, 시작된 분석(분석 진행)이
안 보였다. 계약 흐름은 202 → 요약의 분석 진행이다.

**반영:** `onEnded` 콜백을 dialog→controls→note-panel로 이어, 종료 접수 시 `onTabChange("summary")`.
e2e도 기본 전사 탭에서 종료해 자동 전환을 검증하도록 바꿨다.

### 2. 종료된 404·실패가 무한 폴링된다 (note-summary.tsx)

R1에서 넣은 `isEnded && data===undefined` 폴링이 짧은 생성 경합만이 아니라 모든 404·401·
네트워크 실패에서 참이라, 없는 분석을 3초마다 영구히 두드렸다.

**반영:** 폴링을 PENDING/RUNNING으로만 제한. 원격 종료는 R1의 refetch-on-transition이,
없는 분석은 수동 액션(요약 만들기·다시 시도)이 맡는다.

## R3 — 2건 P2

### 1. stop 실패로 열린 채 남은 세션이 게이트를 빠져나간다 (recording-provider.tsx)

`recording.stop()`이 실패하면 phase=failed지만 activeNoteId와 READY/ACTIVE 세션은 그대로라
서버는 여전히 `ACTIVE_TRANSCRIPTION_SESSION`을 준다. 게이트가 `failed`를 빼서 중지·종료가
곧바로 활성화됐다.

**반영:** `isNoteRecordingActive` 헬퍼를 recording-provider에 두고(failed+세션 열림도 활성으로),
meeting-controls·meeting-end-dialog가 공유한다.

### 2. 요약 마크다운 제목이 리터럴로 보인다 (render-markdown.tsx)

계약의 `overview: "# 개요"`·목 완료의 `"## 회의 개요"`가 문단으로 떨어져 `#`·`##`가 그대로
보였다. "제목 없음"으로 잡은 스펙 판단이 계약과 어긋났다.

**반영:** 렌더러를 줄 기반으로 바꿔 제목(`#`~`######`)을 heading으로 그린다. 테스트 추가.

## R4 — 2건 P2

### 1. 서버가 보고한 활성 세션을 다이얼로그가 못 다룬다 (meeting-end-dialog.tsx)

활성 전사가 다른 탭·기기에 있거나 새로고침으로 로컬 상태를 잃으면 `isRecording`이 거짓인데도
`meeting-end`가 409 `ACTIVE_TRANSCRIPTION_SESSION`을 준다. 다이얼로그는 "대기"를 계속 보이고
같은 실패 액션을 제시하며 순간 토스트만 이유를 알렸다.

**반영:** end mutation의 409를 잡아 `serverBlocked`로 전환 — 차단 안내 + `다시 시도`(서버가
정리하면 통한다). 로컬 상태가 아니라 **서버 409를 권위**로 삼는다.

### 2. 실패한 열린 세션의 복구 액션이 무동작이다 (recording-provider.tsx)

`failed`+열린 세션에서 `녹음 중지`가 `recording.stop()`을 부르지만 `failRecording()`이 이미
컨트롤러를 비워 no-op이었다 — 눌러도 영영 안 풀린다.

**반영:** `isRecordingStoppable`(살아 있는 컨트롤러가 있을 때만 참)로 갈라, 정리 동작을
stoppable이면 `stop()`(곱게), 아니면 `disconnect()`(강제)로 보낸다. 두 컴포넌트 공유.

## R5 — 2건 P2

### 1. 인라인 409에 전역 토스트가 겹친다 (meeting-end-dialog.tsx)

409를 인라인 차단 안내로 그리면서 mutation 전역 토스트도 떠 같은 실패가 두 곳에 겹쳤다.

**반영:** `useEndMeeting`에 `meta.suppressErrorToast`, 인라인으로 못 다루는 실패만 명시적 토스트.

### 2. serverBlocked가 재오픈·noteId 변경에 남는다 (meeting-end-dialog.tsx)

409 한 번 뒤 다이얼로그를 닫았다 열거나 다른 noteId로 재사용해도 `serverBlocked`가 남아,
원격 녹음이 끝났는데도 차단·"다시 시도"로 잘못 보였다.

**반영:** `${noteId}:${open}` 컨텍스트가 바뀌면 렌더 중 상태 조정으로 `serverBlocked`를 접는다.

## R6 — 2건 P2

### 1. 세션 id 전 진행 phase가 게이트를 빠져나간다 (recording-provider.tsx)

`start()`가 세션 id를 붙이기 전에 activeNoteId·`requesting-permission`/`connecting`으로 들어가는데
`isNoteRecordingActive`가 세션 id를 요구해 그 창에서 pause/end가 열렸다 — 뒤늦은 시작이 회의를
되살릴 수 있었다.

**반영:** 진행 phase(ACTIVE_PHASES)면 세션 id 전이라도 활성으로 본다. failed만 세션 열림을 본다.

### 2. failed 세션을 끝내지 않고 로컬만 지운다 (meeting-controls·dialog)

세션 생성은 성공했는데 연결이 실패하면 서버 세션(READY)은 살아 있고 컨트롤러는 없다. 이때
`disconnect()`는 로컬만 지우고 서버 stop을 안 보내 pause/end가 여전히 409인데, **세션 폴링·복구
상태까지 잃는다**. 클라이언트에 세션을 id로 끝낼 REST가 없어 정리는 서버 reconcile뿐이다.

**반영:** disconnect를 걷어냈다. 정리 동작을 **stoppable(살아 있는 컨트롤러)일 때만 stop**으로,
그 밖의 차단(failed·서버 보고)은 **재시도 + 폴링 reconcile 대기**로 바꿨다. 앱바 중지는 failed
세션 동안 비활성(항상 실패하는 액션 금지)으로 두고 폴링이 세션을 정리하면 풀린다.

## R7 — 2건 P2

### 1. 연결 중 phase를 stoppable로 봐 고아 세션을 남긴다 (recording-provider.tsx)

`requesting-permission`/`connecting`을 stoppable로 둬 stop()을 부르면 컨트롤러만 닫히고 취소
안전하지 않은 start()가 이어져 서버 세션을 만들어 고아로 남긴다.

**반영:** `isRecordingStoppable`을 **`recording`(연결돼 녹음 중)만**으로 좁혔다. 연결 중은
차단(대기)으로만 두고 stop을 제안하지 않는다.

### 2. 재분석 창에 중복 요청이 열린다 (note-summary.tsx)

202 뒤 mutation은 끝나지만 refetch가 도착하기 전 낡은 FAILED/404가 남고 버튼이 다시 열려,
그 창에서 또 누르면 ANALYSIS_IN_PROGRESS(409)다.

**반영:** `requestAnalysis.isPending || analysisQuery.isFetching` 동안 재분석 버튼을 잠근다.

## R8 — 1건 P2

### 시작(연결) 중 종료가 고아 세션을 만든다 (meeting-end-dialog.tsx)

`requesting-permission`/`connecting`에서 "다시 시도"가 `meeting-end`를 부르면, 서버 세션이 아직
없어 종료가 성공하고 이어지는 start()가 종료된 노트에 전사 세션을 만든다(계약·목이 ENDED 노트를
거절하지 않음).

**반영:** `isRecordingStarting` 헬퍼로 시작 중이면 종료를 막는다("연결 중…" 비활성). 재시도는
`serverBlocked`·failed 세션에만 남긴다.

## R9 — 통과

"aligns with the API contract and project conventions." 8라운드 / 지적 13건(전부 P2) 전부 반영.
