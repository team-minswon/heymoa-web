# HeyMoa API·실시간 전사·제품 화면 동기화 설계

## 1. 목표

사용자가 갱신한 `openapi3.yml`과 `asyncapi.yml`을 유일한 계약 원본으로 삼아 다음 네 영역을 함께 동기화한다.

1. Orval REST 클라이언트, 모델, MSW, Faker 생성물을 최신 OpenAPI에 맞춘다.
2. 브라우저의 녹음 및 실시간 전사 런타임을 최신 AsyncAPI WebSocket 계약에 맞춘다.
3. 계약이 실제로 영향을 주는 로그인 후 제품 화면을 새 데이터 및 상태 흐름에 맞게 재배치한다.
4. REST와 WebSocket의 정상·빈 상태·충돌·실패 흐름을 로컬에서 결정적으로 재현할 수 있는 mock을 제공한다.

랜딩, 인증 콜백, 약관, 개인정보 페이지는 계약 변경으로 표시 정보나 사용자 행동이 달라지지 않으므로 이번 시각 재배치 범위에서 제외한다. 인증 콜백의 API 타입 호환성은 유지한다.

## 2. 현재 계약에서 확인된 변경

### 2.1 OpenAPI

- `GET /v1/users/me` 성공 데이터에 nullable `image` URL이 추가됐다.
- `POST /v1/notes/{noteId}/transcription-sessions`는 더 이상 request body를 받지 않는다.
- 전사 세션 시작의 `400 BAD_REQUEST` 응답이 제거되고, `404` 및 활성 세션 `409`가 주요 실패 흐름이 됐다.
- 저장된 전사 segment의 `startedAtMs`와 `endedAtMs`는 nullable이 아닌 세션 시작 기준 PCM 밀리초다.
- 전사 세션 종료 사유는 `READY_TIMEOUT`, `CLIENT_DISCONNECTED`, `CLIENT_PROTOCOL_ERROR`, `OPENAI_ERROR`, `INTERNAL_ERROR`로 정리됐다.
- Workspace, Project, Note CRUD 및 조회 경로는 생성 코드와 제품 화면의 탐색 구조를 계속 구성한다.

### 2.2 AsyncAPI

- WebSocket 주소가 `/ws/transcription-sessions/{sessionId}`로 변경됐다.
- query ticket 대신 `access_token` HttpOnly cookie와 허용된 `Origin`으로 upgrade를 인증한다.
- 브라우저 JSON command는 `{ type: "commit" }`, `{ type: "stop" }` 두 개다. pause, resume, ping command는 없다.
- 서버 JSON event는 `connected`, `partial`, `final`, `completed`, `error` 다섯 개다.
- `partial`은 `utteranceId`별 누적 snapshot이며 같은 ID의 기존 표시를 교체한다.
- `final`은 저장이 완료된 segment를 평탄한 payload로 전달하며 `sequence` 오름차순을 보장한다.
- binary audio는 signed PCM16, 24 kHz, mono, little-endian이며 frame은 2 byte 이상, 짝수 크기, 최대 1 MiB다.
- 오디오가 15초 쌓이면 서버가 자동 commit한다. stop 이후 최대 10초 동안 남은 final을 drain한다.
- 정상 완료는 `completed` 후 close code `1000`, 잘못된 client 입력은 error 후 `1008`, upstream 또는 내부 실패는 error 후 `1011`이다.

## 3. 선택한 접근법

계약 중심 재구성을 채택한다. 생성 코드만 맞추는 최소 패치는 UI와 mock에 낡은 pause/resume 및 ticket 개념을 남긴다. 반대로 전체 사이트 재설계는 계약 변경과 무관한 범위를 키운다.

작업 경계는 다음 네 단위로 나눈다.

- REST 계약 경계: Orval 생성물과 손작성 소비 코드
- 실시간 계약 경계: Zod protocol, socket, audio capture, transcript reducer
- mock 경계: 상태 저장형 REST DB/handler와 WebSocket scenario
- 제품 화면 경계: workspace, note, recording indicator, settings

각 경계는 독립 테스트를 갖고, 손작성 코드는 `lib/api/generated/` 내부 파일을 직접 수정하지 않는다.

## 4. 아키텍처와 데이터 흐름

### 4.1 REST 흐름

`openapi3.yml` → Orval → `lib/api/generated/` → TanStack Query hooks → 제품 컴포넌트 순서를 유지한다. `lib/api/fetcher.ts`의 cookie 인증 및 401 refresh 책임은 변경하지 않는다.

세션 시작은 `useStartTranscriptionSession`에 `noteId`만 전달한다. 성공한 `sessionId`와 REST session data를 RecordingProvider가 보관하고, 이후 socket URL을 `/ws/transcription-sessions/{sessionId}`로 조립한다.

`GET /v1/notes/{noteId}/transcript` 결과는 저장된 final의 기준 데이터다. 실시간 final은 낙관적으로 즉시 표시하되 `segmentId`로 중복 제거하고, final 또는 completed 수신 시 transcript query를 invalidate해 서버 저장 결과와 재조정한다.

### 4.2 실시간 흐름

1. 사용자가 마이크 권한을 허용한다.
2. REST로 note의 전사 세션을 생성한다.
3. cookie가 자동 포함되는 동일 인증 컨텍스트에서 WebSocket을 연다.
4. `connected`를 받은 뒤에만 PCM 전송 및 녹음 상태를 활성화한다.
5. audio capture가 PCM16 24 kHz mono frame을 전송한다.
6. 클라이언트의 명시적 구간 확정이 필요할 때 `commit`을 전송한다. 서버의 15초 자동 commit에도 의존할 수 있다.
7. `partial`은 `utteranceId`별 한 행을 교체한다.
8. `final`은 해당 partial을 제거하고 저장된 segment 목록에 upsert한다.
9. 사용자가 종료하면 audio capture를 먼저 멈추고 `stop`을 전송한다.
10. 남은 final과 `completed`를 받은 후 socket을 정상 종료하고 REST transcript를 다시 조회한다.

`connected` 이전 audio frame, 중복 start, completed 이후 command 같은 잘못된 전이는 runtime과 mock 양쪽에서 거부한다.

### 4.3 파일 책임

- `lib/transcription/protocol.ts`: AsyncAPI JSON command/event의 Zod schema와 TypeScript union만 담당한다.
- `lib/transcription/socket.ts`: WebSocket 연결, binary/JSON 송신, event parse, close lifecycle만 담당한다.
- `lib/transcription/audio.ts`: 마이크 입력, 24 kHz PCM16 변환, frame batching과 backpressure만 담당한다.
- `lib/transcription/transcript-reducer.ts`: partial replacement, final upsert/sort, completed 상태만 담당한다.
- `components/transcription/recording-provider.tsx`: REST 세션과 audio/socket 수명주기를 한 개의 전역 recording으로 조정한다.
- `lib/mocks/db.ts`: REST에서 지속되는 workspace/project/note/session/segment 상태를 소유한다.
- `lib/mocks/transcription-scenario.ts`: 한 WebSocket 연결의 protocol state와 scheduled event를 소유한다.

## 5. 제품 화면 설계

기존 ElevenLabs editorial 디자인 언어와 `--el-*` token을 유지한다. display heading은 `font-serif font-light`와 negative tracking, CTA는 pill, card는 프로젝트 표준 card geometry를 사용한다. gradient orb는 장식으로만 사용한다.

### 5.1 Workspace 화면

- 좌측 sidebar는 workspace switcher와 project 탐색을 유지한다.
- 본문 상단은 작은 eyebrow, 선택된 project 제목, note 수/상태, `새 회의` pill CTA 순으로 재구성한다.
- 현재 recording이 있으면 상단 작업 영역에 세션 상태와 경과 시간을 노출하되 note list를 덮지 않는다.
- note 목록은 제목, 최근 수정 시각, project 문맥, 전사 상태를 한 행에서 읽을 수 있게 한다.
- 로딩은 기존 skeleton, 빈 project는 설명과 첫 회의 생성 CTA, 실패는 retry 가능한 alert로 구분한다.

### 5.2 Note 화면

- desktop에서는 전사를 넓은 주 콘텐츠로, 회의 제목·context·project 정보는 보조 패널로 둔다.
- mobile에서는 정보와 전사를 탭으로 유지하되 기본 진입은 전사다.
- 상단에는 회의 제목, recording 상태, 시작/구간 확정/종료 행동을 배치한다. 제거된 pause/resume UI는 렌더링하지 않는다.
- partial은 `전사 중` badge와 함께 한 개의 임시 행으로 표시하고 같은 `utteranceId` 이벤트가 올 때 텍스트를 교체한다.
- final은 `startedAtMs`를 읽기 쉬운 시간으로 표시하고 `sequence` 순으로 안정적으로 정렬한다.
- completed 후에는 종료 상태를 표시하고 저장된 transcript query 결과로 자연스럽게 전환한다.

### 5.3 전역 Recording Indicator

- 다른 route로 이동해도 RecordingProvider와 세션은 유지된다.
- indicator는 녹음 중인 note, 경과 시간, 입력 level, 해당 note로 돌아가기, `구간 확정`, `종료`를 제공한다.
- pause/resume 버튼과 상태는 제거한다.
- error가 발생하면 사람이 이해할 수 있는 한국어 메시지와 note 복귀 행동을 제공한다.

### 5.4 설정 및 사용자 표시

- `users/me.image`가 있으면 avatar image를 표시한다.
- null이거나 image load가 실패하면 사용자 이름의 첫 글자를 fallback으로 사용한다.
- workspace 설정의 기존 CRUD 행동과 editorial form 배치는 유지한다.

## 6. 오류 처리

- REST `401`은 기존 fetcher의 refresh/retry가 처리한다.
- 세션 시작 `409 ACTIVE_TRANSCRIPTION_SESSION_EXISTS`는 새 socket을 만들지 않고 명확한 충돌 toast/alert를 보여준다.
- note/workspace/project `404`는 해당 화면의 not-found 또는 비어 있는 selection 상태로 변환한다.
- socket `error` event는 code와 message를 보존하되 UI에는 안전한 한국어 메시지를 표시한다.
- `INVALID_CLIENT_MESSAGE`와 `INVALID_AUDIO_FRAME`은 terminal protocol error로 처리한다.
- `OPENAI_CONNECTION_FAILED`, `OPENAI_TRANSCRIPTION_FAILED`, `INTERNAL_ERROR`는 terminal service error로 처리한다.
- `completed` 없이 비정상 close되면 세션을 실패로 표시하고 audio capture를 항상 정리한다.
- `stop` 대기는 무한하지 않게 client timeout을 두고, timeout 후에도 audio/socket resource를 정리한 뒤 transcript query를 invalidate한다.

## 7. MSW와 Faker 설계

### 7.1 REST mock

Orval이 생성한 `.msw.ts`와 `.faker.ts`는 생성 여부 및 타입 정합성의 근거로 유지한다. 실제 앱 handler registry는 생성기의 무작위 success boolean에 의존하지 않는다.

- 모든 성공 응답은 `success: true`, `error: null`, 결정적인 data를 명시한다.
- mock user는 `userId: "user-12345"`, `name: "테스트 유저"`, `email: "test@heymoa.com"`을 유지하고 image URL을 추가한다.
- seed에는 복수 workspace/project/note, 전사 없는 note, 완료된 transcript가 있는 note, 활성 session이 있는 note를 포함한다.
- create/update/delete 동작은 `lib/mocks/db.ts` 상태를 실제로 변경하고 후속 GET에 반영한다.
- session create는 body 없이 동작하며 같은 note 또는 전역 활성 session 충돌을 409로 재현한다.
- 존재하지 않는 workspace/project/note/session은 계약의 404 error envelope를 반환한다.
- Faker factory는 테스트 fixture의 다양한 문자열, nullable image, timestamp, session end reason 생성에 사용하되 handler의 성공 여부와 식별자는 결정적으로 override한다.

### 7.2 WebSocket mock

MSW `ws.link()` 주소를 `/ws/transcription-sessions/:sessionId`에 맞춘다.

- 연결 직후 `connected`를 전송한다.
- binary PCM 누적과 `commit`을 받아 partial snapshot과 final segment를 순서대로 만든다.
- 15초 상당의 PCM 누적 시 command 없이 자동 commit한다.
- `stop` 후 pending final을 drain하고 `completed`, close `1000` 순으로 종료한다.
- 잘못된 JSON/command/audio frame은 `error` 후 close `1008`로 종료한다.
- 설정 가능한 upstream 실패 scenario는 `OPENAI_*` error 후 close `1011`로 종료한다.
- final 생성 시 REST mock DB에도 segment를 저장해 재조회 결과와 실시간 화면이 일치하게 한다.

## 8. 테스트 전략

### 8.1 계약 테스트

- OpenAPI에서 생성된 start-session 함수가 request body 없이 호출되는지 검증한다.
- generated user data에 nullable image가 있고 segment timestamp가 필수 number인지 타입 테스트로 고정한다.
- REST와 AsyncAPI의 TSID pattern, session ID, final segment 핵심 필드 정합성을 검증한다.
- `pnpm asyncapi:validate`로 AsyncAPI 문법을 검증한다.

### 8.2 단위 및 통합 테스트

- protocol: 모든 command/event example parse, 낡은 uppercase event와 pause/resume 거부
- reducer: utterance partial 교체, final 전환, segment ID upsert, sequence 정렬
- socket: connected 이전 송신 방지, commit/stop payload, 1000/1008/1011 close
- audio: PCM16 24 kHz mono 및 frame 크기 제약
- provider: body 없는 세션 생성, connected 이후 recording, commit, stop drain, failure cleanup
- REST mock: CRUD 지속성, nullable image, 404, 활성 session 409
- WebSocket mock: 정상 흐름, 자동 commit, protocol error, upstream error
- UI: workspace 상태/빈 화면, note partial/final, 제거된 pause UI, avatar fallback, 전역 indicator route link

### 8.3 최종 검증

관련 Vitest suite를 먼저 실행한 뒤 전체 `pnpm test:run`, `pnpm lint`, `pnpm build`를 통과시킨다. 생성물 재생성 뒤 diff를 확인해 손작성 파일이 `lib/api/generated/`에 섞이지 않았는지도 확인한다.

## 9. 마이그레이션 순서

1. 현재 계약 자체를 validate하고 계약 테스트 기대값을 최신화한다.
2. Orval을 실행해 generated client/model/MSW/Faker를 일괄 교체한다.
3. generated signature에 맞춰 REST 소비 코드와 auth mock user를 수정한다.
4. protocol/reducer/socket/audio를 AsyncAPI에 맞춰 테스트 주도로 교체한다.
5. RecordingProvider와 전역 indicator를 새 세션 lifecycle에 연결한다.
6. REST DB/handler와 WebSocket scenario를 새 계약으로 동기화한다.
7. workspace, note, settings 화면을 새 상태 및 행동 구조로 재배치한다.
8. 전체 테스트, lint, build와 변경 범위 감사를 수행한다.

## 10. 비범위

- OpenAPI 또는 AsyncAPI 계약 자체를 제품 편의에 맞춰 다시 설계하지 않는다.
- 서버에 없는 pause/resume, connection ticket, segment delete API를 클라이언트 전용 기능으로 유지하지 않는다.
- landing/static 페이지를 새 디자인으로 개편하지 않는다.
- 새로운 상태 관리 라이브러리나 WebSocket code generator를 추가하지 않는다.
- 복수 동시 녹음 세션을 지원하지 않는다.
