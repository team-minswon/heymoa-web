# APP-110 계약 반영 설계

**목표:** heymoa-server가 구현을 끝낸 API 전부를 web이 호출할 수 있게 만들고, Vercel `dev` 데모가 실제 제품처럼 도는 MSW 목을 붙인다.

**범위 밖:** 화면 구현(APP-111~117), API 맥락 맵(APP-144), v4 디자인(APP-145). 이 이슈는 그들이 딛고 설 바닥만 만든다.

## 배경

heymoa-server `dev`가 기획 v2 체인(APP-102)과 멤버 초대(APP-63)를 병합해 미러가 37경로가 됐는데 `heymoa-web/openapi3.yml`은 13경로였다. **24경로가 web에 없었다.**

APP-110의 원래 계획은 "서버가 아직 구현 안 한 경로를 계약 초안으로 오버레이"였는데, 그 전제가 무너졌다. 오버레이 소스 `heymoa-server.v2-draft.openapi.yml`이 삭제됐고(서버가 전부 구현해 미러에 흡수) 참조 브랜치도 병합됐다. **오버레이 없이 복사하면 된다.**

## 결정

### `/internal/**` 3경로를 제외한다

`callbacks/analyses/{analysisId}`, `notes/{noteId}/context`, `workspaces/{workspaceId}/notes`는 heymoa-ai가 호출하는 경로다. 남기면 orval이 브라우저가 절대 부르지 않는 훅을 만들고 MSW 목까지 붙는다. 결과는 34경로이고, 그중 web이 새로 쓸 수 있게 되는 것이 21개다.

그 경로만 쓰던 `InternalNoteContextResponse`·`InternalWorkspaceNotesResponse` 스키마도 함께 뺀다 — 남기면 아무도 안 쓰는 모델이 생성된다.

### SSE 두 경로는 생성 훅을 쓰지 않는다

`sendAgentChatMessage`와 `sendNoteSharedChatMessage`는 응답이 `text/event-stream`이라 생성된 훅이 스트림을 읽지 못한다. `lib/api/sse.ts`의 `postEventStream()`(APP-118 산출물) 위에 손으로 만든다.

`AGENTS.md`의 "직접 `fetch()` 금지" 규칙에 이 예외를 명시한다. 지금 규칙대로면 `sse.ts` 자체가 위반처럼 읽힌다.

### 목은 상태 전이까지 간다

Vercel `dev` 배포가 이 목으로 돈다. 목의 충실도가 곧 데모의 충실도다. 고정 응답이면 버튼을 눌러도 화면이 안 바뀌어 테스트·데모 가치가 없다.

돌아야 하는 전이:

| 전이 | 확인 |
|---|---|
| 초대 생성 → 대기 목록 → 수락 | 멤버 +1, 초대가 목록에서 사라짐 |
| 알림 클릭 | `unreadCount` 감소 |
| 회의 종료 → 분석 PENDING → 완료 | 요약 3종 렌더 |
| 승인 → 도구 실행 | 채팅 히스토리에 기록 |
| 연동 연결 | 연결한 사람·시점 표시 |

### 목이 반드시 표현해야 하는 실패

빠지면 데모가 행복 경로만 보여주고, 화면 구현이 처리 코드를 쓸 근거를 잃는다.

| 실패 | 경로 | 화면에서 보여야 하는 것 |
|---|---|---|
| 409 입력 잠금 | `POST /v1/notes/{noteId}/chat/messages` | "OO님이 입력 중" + 입력창 비활성 |
| 409 회의 비ACTIVE | 같음 | "중지 중에는 개인 챗봇을 이용하세요" |
| 403 관전자 승인 시도 | `POST /v1/agent-chats/{chatId}/approvals/{approvalId}` | 승인 권한 없음 안내 |
| 404 만료된 승인 | 같음 | 카드 무효화 + 사유 |
| **종료 이벤트 없이 SSE 끊김** | 두 스트림 경로 | 재시도 UX |
| OAuth 리다이렉트 | `.../integrations/{provider}/authorize` | 목 전용 승인 화면 |

마지막 SSE 실패는 계약(`asyncapi-web-server.yml`)이 "스트림이 끝나는 세 번째 경로"로 명시한 것이다. 동시 스트림 상한 초과·upstream 유휴 60초·입력 잠금 상실 시 server가 종료 이벤트 없이 연결만 끊는다. **web이 이걸 모르면 영원히 로딩이다.**

**OAuth는 MSW로 완전히 재현되지 않는다.** authorize가 외부 도메인으로 리다이렉트하고 callback이 돌아오는 흐름이라 서비스 워커가 가로챌 수 없다. 목 환경에서는 우리 도메인의 목 전용 승인 화면(`/mock-oauth`)으로 보내고 거기서 callback 경로로 돌려보낸다. 그 화면의 디자인은 APP-145가 맡는다.

### Playwright를 도입한다

vitest는 jsdom이라 **MSW의 브라우저 서비스 워커 경로(`worker.start()`)를 한 번도 지나지 않는다.** Vercel `dev` 배포가 정확히 그 경로로 도는데도 그렇다. 여기를 Playwright가 덮는다.

스모크만 넣는다 — 앱이 뜨고, 워커가 붙고, 기존 화면이 목 데이터로 렌더되고, **신규 훅 하나가 브라우저에서 목 응답을 받는다.** 마지막이 핵심이다.

시각 회귀(스크린샷 비교)는 넣지 않는다. 화면 구현 이슈마다 baseline을 갱신해야 해서 지금 넣으면 내내 시끄럽다.

## 성공 기준

```bash
pnpm orval && pnpm test:run && pnpm lint && pnpm build && pnpm test:e2e
```

- `openapi3.yml`이 34경로, `/internal` 0건. 생성물에도 `/internal` 훅 0건 (테스트로 고정)
- `asyncapi.yml`에 채팅 SSE 채널 2개
- 위 전이 5종이 각각 vitest 통과
- SSE 목 3종 통과 — 이벤트 순서, 승인 대기 후 재개, **종료 이벤트 없이 끊김**
- 실패 6종이 목에 존재
- `pnpm test:e2e` 통과

## 리뷰 게이트

로컬 `codex exec review --base dev` 하나만 게이트다. PR 원격 Codex 리뷰는 요청·반영하지 않는다 — 이 저장소는 PR 없이 `dev`로 squash-merge하는 흐름이라 게이트를 한 곳으로 모아야 판정이 흔들리지 않는다.

목 3종을 끝낸 뒤, Playwright 도입 뒤, merge 직전 — 세 번 돌린다. 지적은 **고친다 / 근거를 적고 넘어간다 / 별도 이슈로 뺀다** 중 하나를 고르고 `docs/codex-review-app-110.md`에 한 줄씩 남긴다. 넘어간 판단이 기록에 없으면 다음 사람이 같은 지적을 다시 받는다.

계약 미러(`openapi3.yml`·`asyncapi.yml`)와 orval 생성물(`lib/api/generated/**`)에 대한 지적은 **반영하지 않는다.** 손으로 고치면 다음 갱신에서 되돌아가고, 진짜 문제라면 고칠 곳은 heymoa-server다. 기록만 하고 서버 이슈로 올린다.

## 진행 중 드러난 것

계약을 넓히자 세 가지가 드러났다. 셋 다 이 이슈에서 고쳤다.

**SSE 응답 스키마가 `type: object`였다.** restdocs-api-spec이 응답 필드 없는 `text/event-stream`을 빈 객체 스키마로 떨어뜨렸고, orval이 거기서 `{ [key: string]: unknown }` 타입을 만든 뒤 SSE 텍스트 example을 대입해 **web 빌드가 깨졌다.** 미러를 손대지 않고 heymoa-server의 정규화기를 고쳐 `type: string`으로 바로잡았다(`OpenApi3Normalizer.normalizeEventStreamSchemas`).

**`endReason` enum이 자란 걸 web이 몰랐다.** APP-120 회의 상태 머신이 `MEETING_ENDED`·`MEETING_PAUSED`를 추가했는데 web 계약 테스트가 옛 다섯 값에 고정돼 있었다.

**목 시드 노트에 회의 상태가 없었다.** 같은 APP-120이 `meetingStatus`·`meetingStartedBy`를 노트 응답에 넣었다. 노트는 생성 시부터 `IN_PROGRESS`이고 시작자는 녹음을 처음 시작할 때 정해지므로 그대로 시드했다.
