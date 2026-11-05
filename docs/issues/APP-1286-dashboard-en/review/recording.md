# 녹음·전사 독 (`recording`)

맡은 파일:

- `components/transcription/`: `recording-dock.tsx`(노트 아래 녹음 독), `global-recording-indicator.tsx`(다른 화면의 녹음 알약), `recording-connection-notice.tsx`, `recording-degraded-notice.tsx`, `recording-error-toast.tsx`, `recording-pending-spinner.tsx`, `recording-provider.tsx`(캡처 중단 토스트의 오류 코드), `desktop-meeting-timeline.tsx`(제목 없을 때의 기본 이름)
- `lib/transcription/`: `recording-messages.ts`(시작·실행·종료 실패 문구), `recording-state.ts`(문구 비교를 표시로 바꿈)
- 같이 고친 곳: `components/workspace/workspace-toolbar.tsx`의 일시정지 버튼·툴팁·마이크 입력(셸 모듈이 남긴 메모). `shell.toolbar`의 `micInput`·`pauseRecording`·`pauseTooltip`은 지웠습니다
- 언어 파일: `messages/<ko|en>/recording.json`
- 등록: `i18n/messages.ts`, `i18n/messages.test.ts`의 `REQUIRED_EN`, `components/layout/app-shell.tsx`의 `PRODUCT_NAMESPACES`
- 손대지 않은 것: `lib/transcription/gaps.ts`(13단계, D18), `speaker-identity.ts`의 한국어 기본 화자 이름(D18), `protocol.ts`의 계약 예시 값(시험 픽스처)

판단:

- **실패 문구는 `useTranslations`로**: `recording-messages.ts`를 부르는 곳은 `RecordingProvider` 하나(React)라 `errors` 이름공간과 `webMessage()`(React 밖 전용)를 쓰지 않았습니다. 함수가 첫 인자로 `t`(`recording.errors`)를 받고, provider가 넘깁니다. 문구는 렌더가 아니라 녹음 동작 뒤에 만들어져 하이드레이션과 무관합니다. 되돌리기: 함수의 `t` 인자를 지우고 문구를 다시 상수로
- **「종료 확인 실패」를 문구로 가르지 않습니다**: `recording-state.ts`가 `error === STOP_UNCONFIRMED_MESSAGE`로 비교하던 것을 `failed` 액션의 `unconfirmedStop: true`와 상태의 `unconfirmedStop`으로 바꿨습니다. 서버 완료가 오면 그 표시가 선 문구만 걷습니다. 언어와 무관하게 동작합니다
- **일시정지 툴팁은 한 키**(`recording.pause.tooltip`): 독·전역 표시기·워크스페이스 툴바가 같이 씁니다. em dash를 빼고 「녹음을 일시정지합니다. 회의는 끝나지 않습니다.」 / 「Pause recording. The meeting won't end.」. 독의 버튼 이름(「일시정지」)은 「녹음 제어」 묶음 안이라 짧은 그대로 두었습니다(e2e가 이 이름으로 찾습니다)
- **초 단위는 ICU `plural`**(영어 「1 second / 12 seconds」), 한국어는 `{seconds}초`
- **「(실패한) 기록」을 「녹음」으로**: 회의 종료·일시정지·연결 끊김으로 멈춘 것을 한국어는 「기록」, 영어는 recording이라 불러 녹음으로 맞췄습니다
- **해요체 평서문을 합니다체로**: 녹음 실패·연결 알림에 「멈췄어요」「못했어요」가 섞여 있었습니다. 가운뎃점으로 이은 연결 알림(「받아쓰기·실시간 분석 멈춤 · …중 · …」)은 문장으로 풀었습니다
- 독의 「닫기」는 `common.actions.close`

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 4 |
| 적합도 | 3 | 4 |
| 일관성 | 3 | 3 |
| **평균** | **3.5** | **3.8** |

## 반영한 지적

1차
- `degraded.title`: 「잠깐」이 언제 풀릴지 모르는 상태를 단정함 → 「받아쓰기가 멈췄습니다.」 / 「Transcription is paused.」
- `connection.bufferPaused`·`microphoneLost`·`systemAudioLost`: 조건(「다시 연결될 때까지」)을 두 언어에 같이, 영어 「Other participants aren't recorded」 → 「Other participants' audio」
- `connection.uploading`: 「밀린 소리」 → 대기 중인 소리 / queued audio
- `connection.disconnected`: 「녹음은 이 탭에 모아 두는 중」 → 녹음한 소리를 이 탭에 모아 둔다고 문장으로
- `errors.systemAudioMissing`: 입력을 못 찾은 것을 권한 문제로 단정하지 않게 「입력과 권한을 확인한 뒤」
- `errors.recorderDisconnected`: 「그 기기의 녹음이 정리되면(약 1분)」 → 「약 1분 뒤 다시 녹음할 수 있습니다」
- `errors.stopTimeout`·`stopTimeoutLost`: 「마지막 기록을 정리」 → 「마지막 소리를 저장」
- `errors.interrupted.*`: 기록 → 녹음, `READY_TIMEOUT` 인과를 영어와 같게

2차(점수 뒤 반영)
- `connection.bufferPaused`: 「밀린 저장이 끝나면 자동으로 이어서 녹음합니다」
- `connection.disconnected`: 세 문장으로 나눔(두 언어)
- `errors.socketFailed`: 「서버 연결」 → 「인터넷 연결」(사용자가 확인할 수 있는 것)
- `errors.stopUnconfirmed`: 「녹음 종료 상태를」 → 「녹음이 멈췄는지」
- `errors.serverError`·`interrupted.STT_PROVIDER_ERROR`: 「중단되었습니다」 → 「끊겼습니다」

## 남긴 지적과 이유

- `errors.stopTimeout`의 「다시 시도해 주세요」를 「녹음 상태를 확인해 주세요」로(2차): 이 실패 뒤 독에 「다시 녹음」 버튼이 남아 다시 시도가 실제로 할 수 있는 행동입니다
- `errors.stopTimeoutLost`의 어순 뒤집기(2차): 원인(마지막 저장 실패)과 결과(남은 소리 N초)가 실제 순서이고, 바꾸면 뜻이 달라집니다
- `errors.interrupted.READY_TIMEOUT`·`other`(2차): 지금 문구가 영어와 같은 뜻이라 그대로 둡니다
- 일관성 3점의 남은 몫은 「저장 마무리 중… / 대기 중인 소리 올리는 중」 같은 짧은 진행 상태 이름표가 평서문과 섞인다는 지적입니다. 진행률이 붙는 상태 이름이라 문장으로 늘리지 않았습니다

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `pause.tooltip` | 녹음 일시정지 — 회의는 끝나지 않습니다 | 녹음을 일시정지합니다. 회의는 끝나지 않습니다. |
| `connection.bufferPaused` | 저장이 밀려 녹음을 잠시 멈췄어요 · 저장되면 이어서 녹음해요 | 소리 저장이 밀려 녹음을 잠시 멈췄습니다. 밀린 저장이 끝나면 자동으로 이어서 녹음합니다. |
| `connection.pendingOnDevice` | 올릴 소리 {seconds}초가 이 기기에 있어요 · 연결될 때까지 이 탭을 열어 두세요 | 올리지 못한 소리 {seconds}초가 이 기기에 있습니다. 연결될 때까지 이 탭을 열어 두세요. |
| `connection.disconnected` | 연결이 끊겼어요 · 받아쓰기·실시간 분석 멈춤 · 녹음은 이 탭에 모아 두는 중 · 연결될 때까지 탭을 열어 두세요 | 연결이 끊겨 받아쓰기와 실시간 분석이 멈췄습니다. 녹음한 소리는 이 탭에 모아 둡니다. 다시 연결될 때까지 탭을 열어 두세요. |
| `errors.activeSession` | 다른 탭이나 기기에서 이 회의를 녹음하고 있어요. | 다른 탭이나 기기에서 이 회의를 녹음하고 있습니다. |
| `errors.recorderDisconnected` | 녹음하던 기기와 연결이 끊겼어요. 그 기기의 녹음이 정리되면(약 1분) 녹음할 수 있어요. | 녹음하던 기기와 연결이 끊겼습니다. 약 1분 뒤 다시 녹음할 수 있습니다. |
| `errors.dropped` | 연결이 끊겨 녹음을 멈췄어요. | 연결이 끊겨 녹음을 멈췄습니다. |
| `errors.droppedLost` | 연결이 끊겨 녹음을 멈췄어요. 이 기기에 남은 소리 {seconds}초를 올리지 못했어요. | 연결이 끊겨 녹음을 멈췄습니다. 이 기기에 남은 소리 {seconds}초를 올리지 못했습니다. |
| `errors.stopTimeoutLost` | 마지막 기록을 정리하지 못해 이 기기에 남은 소리 {seconds}초를 올리지 못했어요. | 마지막 소리를 저장하지 못해 이 기기에 남은 소리 {seconds}초를 올리지 못했습니다. |
| `errors.meetingEndedLost` | 회의가 끝나 이 기기에 남은 소리 {seconds}초를 올리지 못했어요. | 회의가 끝나 이 기기에 남은 소리 {seconds}초를 올리지 못했습니다. |
| `degraded.title` | 받아쓰기가 잠깐 멈췄습니다. | 받아쓰기가 멈췄습니다. |
| `connection.microphoneLost` | 마이크가 끊겼습니다. 이 동안의 소리는 녹음되지 않습니다. | 마이크가 끊겼습니다. 다시 연결될 때까지 소리가 녹음되지 않습니다. |
| `connection.systemAudioLost` | 컴퓨터 소리가 끊겼습니다. 이 동안 상대방의 소리는 녹음되지 않습니다. | 컴퓨터 소리가 끊겼습니다. 다시 연결될 때까지 상대방의 소리가 녹음되지 않습니다. |
| `connection.uploading` | 밀린 소리 올리는 중 {percent}% | 대기 중인 소리 올리는 중 {percent}% |
| `errors.systemAudioMissing` | 컴퓨터 소리 입력을 찾지 못했습니다. 권한을 허용한 뒤 다시 녹음해 주세요. | 컴퓨터 소리 입력을 찾지 못했습니다. 입력과 권한을 확인한 뒤 다시 녹음해 주세요. |
| `errors.stopTimeout` | 마지막 기록을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요. | 마지막 소리를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요. |
| `errors.interrupted.MEETING_ENDED` | 회의가 종료되어 기록을 마쳤습니다. | 회의가 끝나 녹음을 마쳤습니다. |
| `errors.interrupted.MEETING_PAUSED` | 회의가 일시정지되어 기록을 멈췄습니다. | 회의가 일시정지되어 녹음을 멈췄습니다. |
| `errors.interrupted.HEARTBEAT_TIMEOUT` | 연결이 끊긴 채로 오래 있어 기록을 중단했습니다. | 연결이 오래 끊겨 녹음을 멈췄습니다. |
| `errors.interrupted.READY_TIMEOUT` | 녹음을 시작하지 못해 세션이 만료되었습니다. 다시 시도해 주세요. | 녹음이 시작되기 전에 세션이 만료되었습니다. 다시 시도해 주세요. |
| `errors.socketFailed` | 실시간 스크립트 서버에 연결하지 못했습니다. 로그인 상태와 서버 연결을 확인해 주세요. | 실시간 스크립트 서버에 연결하지 못했습니다. 로그인 상태와 인터넷 연결을 확인해 주세요. |
| `errors.stopUnconfirmed` | 녹음 종료 상태를 확인하지 못했습니다. | 녹음이 멈췄는지 확인하지 못했습니다. |
| `errors.interrupted.STT_PROVIDER_ERROR` | 음성 인식 서비스 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요. | 음성 인식 서비스 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요. |
| `errors.serverError` | 실시간 스크립트 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요. | 실시간 스크립트 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요. |

## 렌더 확인

임시 스크립트로 영어 계정 1440·1024에서 시작 전 노트(`/w/01K0000000000/notes/01K0000000005`)를 열고, 「Start meeting」 툴팁, 녹음 시작(가짜 마이크) 뒤 독과 일시정지 툴팁을 봤습니다.

- 넘침: 이 모듈 문구에는 없음. 잡힌 「Timeline / New items in the timeline」은 노트 탭의 새 항목 표시(notes 모듈)입니다
- 남은 한글 중 이 모듈 문구: 없음
- 남은 한글 중 다른 것: 목 데이터(노트·프로젝트·사람 이름, 전사 본문, 채팅 대화)
- 못 본 것: 전역 녹음 표시기(워크스페이스 밖 화면에서만 서고 스크립트가 녹음을 유지한 채 그 화면으로 가지 못했습니다), 마이크 권한 거부·연결 오류 토스트. 둘 다 `recording-en.test.tsx`와 기존 시험이 문구를 봅니다

## 코드 리뷰

1회차: 지적 없음.
