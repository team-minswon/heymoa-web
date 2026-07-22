# HeyMoa 계약·Mock 전사·워크스페이스 개선 설계

## 1. 목표

현재 `openapi3.yml`, `asyncapi.yml`, Orval 생성물, MSW REST/WebSocket mock과 워크스페이스·노트 UI를 다시 검토하고 하나의 일관된 MVP로 개선한다.

- OpenAPI와 AsyncAPI의 중복 오류, 모호한 응답, 수기 런타임 schema 드리프트를 제거한다.
- Spring Kotlin 서버가 구현할 REST·raw WebSocket 계약을 구체화한다.
- Spring과 OpenAI STT가 없어도 실제 마이크 소리에 반응하는 Partial/Final 전사 흐름을 MSW에서 확인한다.
- 계정과 여러 워크스페이스의 최소 CRUD·전환 흐름을 추가한다.
- 워크스페이스와 노트 화면을 `DESIGN.md`의 ElevenLabs editorial style에 맞추되 회의 도구에 필요한 정보 밀도를 유지한다.

## 2. 범위

### 2.1 포함

- 현재 사용자 조회와 표시 이름 수정
- Google OAuth 이메일·프로필 이미지 읽기
- 내 워크스페이스 목록, 생성, 조회, 이름·설명 수정, 기본 워크스페이스 지정
- 워크스페이스 전환
- Folder와 Note의 기존 CRUD 및 N:M 연결
- 사용자당 활성 TranscriptionSession 하나
- 실제 마이크 PCM capture와 입력 레벨 시각화
- 마이크 음량으로 진행되는 seed 기반 MSW 한국어 회의 대본
- Partial, Final, pause, resume, stop, 재연결
- `view=side|full`, `tab=transcript|details`
- 데스크톱 overlay note와 모바일 note surface

### 2.2 제외

- Workspace 삭제
- Workspace Member 목록·초대·역할·권한 관리
- 사용량, 플랜, 결제, 템플릿, 공유 링크
- 캘린더·데스크톱 앱·외부 연동
- 다국어, 영어, 자동 언어 감지와 언어 선택 UI
- TranscriptSegment 수정
- AI 문서, 요약, 액션아이템과 챗봇
- MSW에서 실제 발화 내용을 인식하는 STT
- Spring·OpenAI adapter 구현

## 3. 설계 방향

계약 중심 수직 개선 방식을 사용한다.

1. OpenAPI·AsyncAPI 계약 정합성
2. Orval 생성물과 수기 runtime schema 검증
3. 상태를 공유하는 MSW REST·WebSocket runtime
4. 마이크 입력과 녹음 상태
5. 계약을 사용하는 워크스페이스·노트 UI

화면을 먼저 확장한 뒤 API를 뒤따라 붙이지 않는다. UI에 노출되는 모든 기능은 이번 계약과 mock이 실제로 지원해야 한다.

## 4. 계약 정합성

### 4.1 OpenAPI 구조 오류

현재 문서에 존재하는 YAML 중복 key를 제거한다.

- `components.responses.Conflict.content.application/json.schema.$ref`
- `CurrentUserInfoResponse.properties.name.type`

모든 operation에 명시적이며 고유한 `operationId`를 부여한다. 특히 User와 Auth operation의 이름을 Orval 추론에 맡기지 않는다.

### 4.2 성공·실패 응답

현재 `AppResponse_*`는 `data`와 `error`가 모두 optional이어서 성공 data가 없거나 data와 error가 함께 있는 문서도 유효하다. 성공과 실패의 schema를 분리한다.

성공 응답:

```json
{
  "success": true,
  "data": {}
}
```

- `success`는 `true` enum
- endpoint별 `data`는 required

실패 응답:

```json
{
  "success": false,
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "노트를 찾을 수 없습니다.",
    "details": null
  }
}
```

- 공통 `AppErrorResponse`를 사용한다.
- `success`는 `false` enum이다.
- `error`는 required다.
- 공통 4xx/5xx response는 `AppResponse_Unit`을 참조하지 않는다.
- endpoint별 example로 HTTP status와 가능한 `AppErrorType`을 명확히 한다.

기존 서버·fetcher와 응답 parsing을 통일하기 위해 생성과 삭제도 `200 AppResponse` 정책을 유지한다.

### 4.3 식별자·시간·cursor

- 모든 공개 entity ID와 PK는 13자 TSID string이다.
- Spring Kotlin 시간은 `Instant`, 외부 계약은 RFC 3339 `date-time`이다.
- 오디오 위치와 녹음 길이는 `int64` millisecond다.
- cursor는 opaque string이며 클라이언트가 해석하거나 조합하지 않는다.
- 목록은 안정적인 정렬 key와 entity ID를 cursor에 포함하되 인코딩 방식은 서버 내부 구현이다.

### 4.4 언어 제거

이번 MVP는 한국어만 지원한다.

- `CreateTranscriptionSessionRequest.language`를 제거한다.
- `TranscriptionSessionResponse.language`를 제거한다.
- session 생성은 빈 body를 요구하지 않도록 request body 자체를 제거한다.
- Spring/OpenAI의 한국어 설정은 서버 내부 구성이다.
- 클라이언트에서 영어·자동 감지·언어 선택 UI와 관련 상태를 제거한다.

## 5. 사용자·워크스페이스 계약

### 5.1 User

| Method | Path           | 역할             |
| ------ | -------------- | ---------------- |
| GET    | `/v1/users/me` | 현재 사용자 조회 |
| PATCH  | `/v1/users/me` | 표시 이름 수정   |

`CurrentUserResponse`:

- `userId: Tsid`
- `name: string`
- `email: string`
- `profileImageUrl: string | null`
- `createdAt: Instant`
- `updatedAt: Instant`

Google 이메일과 프로필 이미지는 읽기 전용이다. `UpdateCurrentUserRequest`는 `name`만 받는다.

### 5.2 Workspace

| Method | Path                                   | 역할                   |
| ------ | -------------------------------------- | ---------------------- |
| GET    | `/v1/workspaces`                       | 내 워크스페이스 목록   |
| POST   | `/v1/workspaces`                       | 워크스페이스 생성      |
| GET    | `/v1/workspaces/{workspaceId}`         | 워크스페이스 조회      |
| PATCH  | `/v1/workspaces/{workspaceId}`         | 이름·설명 부분 수정    |
| PUT    | `/v1/workspaces/{workspaceId}/default` | 기본 워크스페이스 지정 |

기존 `GET /v1/workspaces/default`는 제거한다.

`WorkspaceResponse`:

- `workspaceId: Tsid`
- `name: string`
- `description: string | null`
- `isDefault: boolean`
- `createdAt: Instant`
- `updatedAt: Instant`

규칙:

- 사용자에게는 항상 정확히 하나의 default Workspace가 있다.
- 최초 Google 가입 transaction에서 사용자 이름의 Workspace를 만들고 default로 지정한다.
- 새 Workspace 생성은 default를 변경하지 않는다.
- 화면 전환만으로 default를 변경하지 않는다.
- default 변경은 명시적인 `PUT` command로만 수행한다.
- 이미 default인 Workspace에 같은 command를 보내도 성공한다.
- 로그인 callback은 목록에서 default를 찾아 이동한다.
- 데이터 이상으로 default가 없으면 첫 번째 항목으로 이동하되 오류를 관측 가능하게 남긴다.
- Workspace 삭제와 공개 Member API는 이번 범위에서 제외한다.

목록 응답은 default를 먼저 두고 나머지를 이름순으로 정렬한다.

## 6. TranscriptionSession과 녹음 시간

### 6.1 상태

```text
CONNECTING → STREAMING ↔ PAUSED → FINALIZING → COMPLETED
                     ↘ INTERRUPTED
CONNECTING/STREAMING/FINALIZING → FAILED
```

활성 상태는 `CONNECTING`, `STREAMING`, `PAUSED`, `FINALIZING`이다. 사용자당 활성 Session은 하나다.

### 6.2 실제 녹음 시간

현재 구현의 `Date.now() - startedAt` 방식은 pause 중에도 시간이 흐른다. 단일 UI 타이머는 wall-clock 회의 경과가 아니라 실제 녹음된 오디오 길이를 표시한다.

`TranscriptionSessionResponse`에 다음을 추가한다.

- `recordedDurationMs: int64`

계산 규칙:

```text
recordedDurationMs = 완료된 STREAMING 구간 합 + 현재 STREAMING 구간 경과
```

- pause 시 현재 STREAMING 구간을 누적하고 타이머를 멈춘다.
- resume 시 새로운 STREAMING 구간을 시작한다.
- stop과 FINALIZING 진입 시 타이머를 멈춘다.
- 재연결은 REST가 반환한 `recordedDurationMs`부터 이어간다.
- Segment의 `startedAtMs`, `endedAtMs`도 pause를 제외한 녹음 timeline 기준이다.

## 7. AsyncAPI

### 7.1 WebSocket 연결

```text
WS /v1/transcription-sessions/{sessionId}/stream?ticket={singleUseTicket}
```

REST로 Session을 생성하거나 재연결 ticket을 발급한 뒤 native WebSocket을 연다. access token을 URL에 넣지 않는다.

### 7.2 Binary audio

- PCM16 little-endian
- mono
- 24 kHz
- WebSocket binary frame
- 권장 frame 길이 40ms
- JSON/Base64 envelope를 사용하지 않는다.

### 7.3 JSON command와 event

Browser → Spring:

- `TURN_COMMIT`
- `SESSION_PAUSE`
- `SESSION_RESUME`
- `SESSION_COMPLETE`
- `PING`

Spring → Browser:

- `SESSION_READY`
- `SESSION_STATUS`
- `TRANSCRIPT_PARTIAL`
- `TRANSCRIPT_FINAL`
- `SESSION_COMPLETED`
- `ERROR`
- `PONG`

`SESSION_STATUS`에는 상태 전환 시점의 `recordedDurationMs`를 포함한다.

`TRANSCRIPT_PARTIAL`:

- `itemId`
- `text`: 누적 snapshot
- `startedAtMs`: 현재 Partial의 녹음 timeline 시작점

`TRANSCRIPT_FINAL`은 DB 저장 성공 뒤 공개 `TranscriptSegment`를 보낸다. Browser는 같은 `itemId` Partial을 제거하고 `segmentId` 기준으로 Final을 upsert한다.

### 7.4 command 허용 범위

- `STREAMING`: audio, commit, pause, complete, ping
- `PAUSED`: resume, complete, ping
- `FINALIZING`: ping 이외 audio·state command 거부
- pause, resume, complete는 서버 상태 전이를 멱등하게 처리한다.
- 복구 가능한 오류는 `ERROR` 뒤 연결을 유지한다.
- 치명적인 인증·권한·Session·provider 오류는 `ERROR` 뒤 문서화한 close code로 종료한다.

## 8. 계약 드리프트 방지

OpenAPI와 AsyncAPI는 외부 파일 `$ref`를 공유하지 않는다. Orval과 AsyncAPI 도구의 호환성을 단순하게 유지한다.

대신 계약 테스트가 다음을 비교한다.

- TSID 정규식
- `TranscriptionSessionStatus` enum
- 공통 `AppErrorType` enum
- `TranscriptSegment` 필드와 제약
- AsyncAPI example과 `protocol.ts` Zod parser
- 모든 OpenAPI operationId의 존재와 고유성
- YAML duplicate key

수기 `protocol.ts`는 WebSocket runtime validation을 위해 유지한다. 명세와 달라지면 테스트가 실패해야 한다.

## 9. 실제 마이크 기반 MSW 전사

### 9.1 Browser audio graph

```text
getUserMedia
  ├─ AudioWorklet → PCM16 binary → WebSocket/MSW
  └─ AnalyserNode → normalized level 0..1 → RecordingProvider UI
```

- 하나의 `MediaStream`을 공유한다.
- `AudioWorklet`은 서버 전송용 PCM frame을 만든다.
- `AnalyserNode`는 전역 level meter와 노트 waveform을 구동한다.
- React에는 원본 sample 대신 정규화된 level만 전달한다.
- level은 `requestAnimationFrame`으로 읽되 상태 전달은 15~20fps로 제한한다.
- pause 시 audio 송신과 level 갱신을 함께 중단한다.
- 별도 audio visualization library를 추가하지 않는다.
- 시각화는 SVG 또는 CSS를 사용하고 `<canvas>`에 의존하지 않는다.

### 9.2 Mock voice activity

MSW WebSocket handler는 binary PCM16 sample의 RMS를 직접 계산한다.

- 짧은 초기 구간에서 noise floor를 추정한다.
- noise floor 기반 threshold와 최소 threshold 중 큰 값을 사용한다.
- 순간적인 짧은 소음은 발화로 보지 않는다.
- threshold 이상의 voiced duration이 쌓일 때만 대본을 진행한다.
- 약 300~500ms의 voiced duration마다 Partial snapshot을 갱신한다.
- 약 800~1000ms의 silence가 이어지면 현재 문장을 Final로 commit한다.
- `TURN_COMMIT`, pause, stop은 남은 Partial을 즉시 commit한다.
- pause 중 binary frame은 대본과 타이머를 진행시키지 않는다.

threshold와 timing은 한 설정 객체에 모으고 UI나 환경변수로 노출하지 않는다.

### 9.3 대본

- seed가 고정된 자연스러운 한국어 회의 대본 묶음을 사용한다.
- Session ID에서 seed를 만들어 재현 가능한 대본을 고른다.
- Partial은 한 문장의 token이 순차적으로 늘어나는 snapshot이다.
- 여러 문장이 차례로 Final이 된다.
- 마지막 문장 뒤에는 다음 대본으로 이어져 장시간 테스트할 수 있다.
- Final은 mock DB에 저장되어 REST 조회에 즉시 반영된다.
- Faker의 무관한 단어를 매번 조합하지 않는다.
- 사용자의 실제 발화 내용과 mock text는 일치하지 않는다.

기본 브라우저 mock은 정상 시나리오 하나만 제공한다. 개발용 selector나 환경변수는 두지 않는다. ticket 실패, provider 실패와 disconnect는 자동 테스트에서 scenario dependency를 직접 주입해 검증한다.

## 10. MSW REST store

MSW DB가 User, Workspace, Folder, Note, Session, Segment를 상태로 관리한다.

- seed에는 default Workspace와 보조 Workspace를 하나씩 둔다.
- Workspace 생성·수정·default 변경은 다음 목록 조회에 반영된다.
- default는 항상 하나만 유지한다.
- Folder와 Note는 Workspace별로 격리한다.
- 서로 다른 Workspace의 Note와 Folder 연결은 `403`이다.
- Final event가 Segment store를 갱신하고 Note summary가 새 길이를 반영한다.
- 고정 seed와 TSID generator로 테스트 결과를 재현한다.
- handler 성공 응답은 항상 명시적인 `success: true` override를 사용한다.

## 11. 페이지와 URL

### 11.1 로그인 callback

- `GET /v1/workspaces`를 조회한다.
- `isDefault: true` Workspace로 이동한다.
- default가 없으면 첫 항목으로 fallback한다.

### 11.2 워크스페이스 홈

```text
/w/{workspaceId}
```

Tiro의 `고정 sidebar + 얇은 toolbar + 날짜별 조밀한 목록` 정보 구조만 참고한다. 캘린더·앱 설치 같은 미지원 홍보 카드는 만들지 않는다.

왼쪽 Sidebar:

- 흰색 surface, 16~24px radius, hairline, 약한 shadow
- 사용자 avatar·이름·이메일
- 모든 노트
- 현재 Workspace switcher
- Folder 목록과 생성·이름 변경·삭제
- 선택 항목은 `surface-strong` 배경

상단 Toolbar:

- 현재 Workspace 또는 Folder 이름
- 잉크색 pill `기록 시작`
- 새 Note action
- 언어 선택 없음

본문:

- 날짜별 Note 그룹
- 길이, 제목, Folder, 기록 시각, 실행자
- cursor pagination
- 활성 녹음이 있을 때만 작은 상태 행
- 첫 Workspace/Note의 empty state

### 11.3 프로필 menu

프로필 영역을 누르면 작은 menu를 연다.

- 내 계정 설정
- 로그아웃

사용량, 플랜, 템플릿, 선물, 앱 다운로드와 고객문의는 이번 UI에 표시하지 않는다.

### 11.4 Workspace switcher

- 내 Workspace 목록
- default 표시
- 선택 시 `/w/{workspaceId}`로 이동
- 새 Workspace
- Workspace 설정

Workspace 전환만으로 default를 변경하지 않는다.

### 11.5 설정 Dialog

둥근 대형 Dialog로 제공한다.

- `내 계정`: avatar/email 읽기 전용, 표시 이름 수정
- `워크스페이스 일반`: 이름·설명 수정, 기본으로 설정
- 저장 중, 저장됨, field 오류를 표시한다.
- Workspace 삭제와 멤버 메뉴는 없다.
- 모바일에서는 전체 화면 Dialog로 전환한다.

## 12. Note surface

### 12.1 URL

```text
/w/{workspaceId}/notes/{noteId}?view=side&tab=transcript
/w/{workspaceId}/notes/{noteId}?view=full&tab=details
```

- `view`: `side | full`, 기본 `full`
- `tab`: `transcript | details`, 기본 `transcript`
- 잘못된 값은 기본값으로 정규화한다.

### 12.2 Side overlay

- 오른쪽에서 목록 위에 겹치는 overlay다.
- 화면 가장자리에서 inset된 흰색 surface다.
- 16~24px radius, hairline, 약한 shadow를 사용한다.
- 뒤 목록은 현재 위치를 알아볼 수 있을 정도로 보인다.
- overlay 기준 좌측 상단에 닫기와 전체 화면 전환을 둔다.
- 우측 상단에는 보조 menu와 삭제를 둔다.
- Escape, focus trap, 닫힌 뒤 focus 복원을 지원한다.
- 모바일에서는 전체 폭 또는 bottom Drawer surface가 된다.

### 12.3 Full view

- 같은 `NotePanel`을 재사용한다.
- overlay chrome만 제거한다.
- Sidebar는 유지하되 접을 수 있다.
- Workspace 복귀와 side view 전환을 좌측 상단에 둔다.

### 12.4 Transcript tab

- Session 상태와 실제 녹음 시간
- 시작, pause, resume, stop
- 실제 마이크 level 기반 넓은 waveform
- Final Segment 시간순 목록
- 현재 Partial live row
- 여러 과거 Session의 경계
- Segment 삭제와 확인 Dialog
- loading, empty, REST error, WebSocket error 상태

Final event가 오면 Partial을 제거하고 Segment를 즉시 표시한 뒤 REST query를 invalidate한다.

### 12.5 Details tab

- 제목
- 맥락
- 연결 Folder
- 생성자·생성·수정 시각
- 저장 중·저장됨·오류 상태

요약, 문서, 액션아이템과 템플릿은 표시하지 않는다.

## 13. 디자인 시스템

`DESIGN.md`의 token과 원칙을 따른다.

- 앱 바닥의 `canvas`는 CSS 배경 token이며 HTML `<canvas>`가 아니다.
- Sidebar와 Note overlay는 흰색 `surface-card`다.
- 구분은 `hairline`과 단일 soft shadow tier를 사용한다.
- CTA만 ink pill을 사용한다.
- 카드와 panel은 16px 이상 radius를 사용한다.
- pastel gradient orb는 대기·목록·panel surface에 사용하지 않는다.
- 조밀한 Note 행에는 compact radius와 충분한 keyboard focus를 제공한다.
- 표시 headline에서만 serif light editorial hierarchy를 사용한다.
- body와 control은 읽기 쉬운 sans-serif를 유지한다.

마이크 시각화는 이중 구조다.

- 전역 녹음 pill: 작은 실제 level meter
- Note transcript: 넓은 실제 waveform

무음, pause, 입력 장치 없음과 권한 거부는 animation만으로 구분하지 않고 text label도 제공한다.

## 14. 상태·오류·복구

### 14.1 상태 소유권

- TanStack Query: REST 영속 resource
- RecordingProvider: socket, Partial, microphone level, 실제 녹음 시간
- URL: view와 tab
- MSW DB: REST와 WebSocket이 공유하는 mock 영속 상태

### 14.2 복구

- 새로고침 시 활성 Session을 조회한다.
- 활성 Session이면 새 connection ticket을 발급해 재연결한다.
- REST의 `recordedDurationMs`부터 타이머를 복원한다.
- ticket 만료와 짧은 단절만 제한된 횟수로 재시도한다.
- 권한, 없는 Session과 invalid state는 자동 반복하지 않는다.
- 새 기록 시 활성 Session이 있으면 기존 기록으로 이동한다.
- FINALIZING 동안 stop 중복을 막는다.

### 14.3 오류 UI

- field 오류는 입력 근처에 표시한다.
- 목록 실패는 목록 영역 안에 retry를 둔다.
- 마이크 권한 거부와 장치 없음은 해결 방법과 다시 시도를 제공한다.
- WebSocket 오류는 전역 pill과 transcript에서 같은 의미로 표시한다.
- 치명적 STT 오류에서도 이미 저장된 Final을 유지한다.
- 개발 error code를 그대로 사용자 문구로 노출하지 않는다.

## 15. 검증

### 15.1 계약

- YAML duplicate key 검사
- 모든 OpenAPI operationId 존재·고유성
- `pnpm orval`
- generated artifact 최신 여부
- `pnpm asyncapi:validate`
- OpenAPI/AsyncAPI/Zod 공통 schema 비교
- 모든 AsyncAPI example의 Zod parse

### 15.2 Mock·audio

- 무음 PCM은 Partial을 만들지 않는다.
- voiced PCM 누적으로 Partial이 성장한다.
- silence 뒤 Final이 저장된다.
- pause 중 frame과 timer를 진행시키지 않는다.
- resume 후 새 Partial이 진행된다.
- stop은 마지막 Partial, Final, completed 순서를 보장한다.
- Final은 REST Segment 조회와 Note summary에 반영된다.
- session 하나만 활성화된다.
- ticket과 close code를 처리한다.
- RMS와 active duration 계산은 순수 함수로 검증한다.

### 15.3 UI

- Workspace 생성·수정·전환·default 지정
- 사용자 표시 이름 수정
- 날짜 그룹·Folder filter·pagination
- side overlay 닫기·전체화면 URL 전환
- tab URL 전환
- microphone level에 따른 meter와 waveform 변화
- pause 동안 timer 정지
- Final/Partial 교체와 Segment 삭제
- 페이지 이동 중 RecordingProvider 유지
- 모바일 Sidebar, Dialog와 Note surface
- 현재 실패하는 `note-panel.test.tsx`의 RecordingProvider dependency 복구

### 15.4 완료 명령과 브라우저 흐름

```bash
pnpm orval
pnpm asyncapi:validate
pnpm test:run
pnpm lint
pnpm build
```

브라우저에서 다음 흐름을 데스크톱과 모바일로 검증한다.

```text
로그인 → default Workspace 이동
→ Workspace 생성·전환·설정
→ Note 생성 → 마이크 허용 → 소리 입력
→ Partial 성장 → 무음으로 Final
→ pause에서 timer·waveform 정지 → resume
→ 다른 페이지에서도 전역 녹음 유지
→ side/full 전환 → stop → REST Final 재조회
```

## 16. 구현 순서

1. 현재 실패 테스트 복구와 baseline 확인
2. OpenAPI 오류·응답·User·Workspace·Session 계약 수정
3. Orval 재생성과 REST mock store 확장
4. AsyncAPI·Zod·계약 검증 강화
5. active duration과 microphone level pipeline
6. voice activity 기반 MSW 대본 상태 머신
7. 계정·Workspace Dialog와 Sidebar 개선
8. Workspace home과 Note overlay/detail 개선
9. 전체 자동 검증과 실제 브라우저 흐름 확인
