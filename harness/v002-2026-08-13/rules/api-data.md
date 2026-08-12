# API 호출과 목

계약(`openapi3.yml`) → Orval → TanStack Query 훅 + MSW 목.

**어느 훅이 어디 생성됐는지는 `lib/api/generated/`를 직접 봅니다.** 배치는
`orval.config.ts`의 `mode: "tags-split"`이 정하므로 서버 태그 하나가 디렉터리 하나입니다.
목록을 문서로 옮기지 않습니다 — 계약이 바뀔 때마다 낡습니다.

## 호출은 생성 훅으로

API 호출은 `lib/api/generated/`의 Orval 훅으로 합니다. 직접 `fetch()`해도 되는 자리는
**생성 훅이 닿지 못하는 곳**뿐이고, 세 가지입니다.

| 왜 | 어디 |
|---|---|
| transport 자신 | `lib/api/` — 공용 mutator와 SSE. 생성 훅은 `text/event-stream`을 못 읽습니다 |
| 토큰 갱신과 순환하는 인증 경로 | `lib/auth/`, `proxy.ts` — 앱 밖 런타임이거나 갱신 자신을 부르는 자리 |
| 목 전용 표면 | `components/mocks/` — MSW 서비스 워커가 최상위 내비게이션을 못 가로챕니다 |

**제품 컴포넌트(`app/`·`components/` 중 `mocks/` 밖)가 API 경로를 직접 `fetch()`하면
위반입니다.** 위 셋에 새 자리를 더할 때는 어느 줄에 해당하는지 주석으로 남깁니다.

`lib/api/fetcher.ts`가 401 → `/v1/auth/refresh` → 재시도를 자동으로 합니다.

**생성됐어도 못 쓰는 훅이 셋 있습니다.** 응답 형태가 JSON이 아니라 생성 훅의 전제를
벗어납니다.

| 훅 | 왜 | 대신 |
|---|---|---|
| `sendAgentChatMessage`·`sendNoteSharedChatMessage` | 응답이 `text/event-stream`이라 훅이 스트림을 못 읽고 한 덩어리로 다룹니다 | `lib/api/sse.ts`의 `postEventStream()` |
| `startWorkspaceIntegration` | 계약이 **302 리다이렉트**라 본문이 HTML이고 `apiFetch`의 JSON 파싱이 깨집니다 | `window.location.assign()`으로 이동 (`workspace-integrations-settings.tsx`) |

목 환경에서 연동 왕복은 `/mock-oauth`가 대신합니다 — MSW는 최상위 내비게이션을 못 가로채
그 이동을 재현할 수 없습니다.

## 계약은 미러입니다

`openapi3.yml`은 heymoa-server 산출물의 미러이고, `/internal/**` 경로를 뺀 것입니다 —
그쪽은 heymoa-ai가 부르지 브라우저가 부르지 않습니다.

**손으로 고치지 않습니다.** 갱신은 원본에서 복사한 뒤 `/internal/**`을 지우는 것입니다.
원본은 docs repo(`../docs`)의 `origin/main`이고, **어느 파일인지는 그 레포의 `INDEX.md`가
가리킵니다.** 깊은 경로를 여기 적지 않습니다 — 실제로 옮겨진 적이 있습니다.
워킹 트리를 읽으면 남의 브랜치일 수 있습니다.

바뀌면 `pnpm orval`을 먼저 돌리고, 그다음 응답을 실제로 정의하는 핸들러 파일(아래)을 맞춥니다.
`handlers.ts`는 레지스트리라 경로가 새로 생겼을 때만 건드립니다.
`lib/api/generated/`는 산출물이라 편집하지 않습니다. (둘 다 hook이 막습니다.)

## MSW 목

- REST는 `lib/mocks/rest-handlers.ts`, WebSocket은 `lib/mocks/websocket-handler.ts`,
  SSE는 `lib/mocks/sse-handler.ts`에 있습니다. `lib/mocks/handlers.ts`는 레지스트리만 모읍니다.
- 핸들러는 **명시적 override 응답**으로 `success: true`를 돌려줍니다.
- **orval이 생성하는 기본 목 응답을 그대로 쓰지 않습니다.** 무작위 `success: false`가 나와
  인증이 깨집니다. 시드를 고정한 faker는 정당합니다 — `lib/mocks/db.ts`와
  `lib/mocks/chat-stream.ts`가 그렇게 씁니다. 금지 대상은 무작위성이지 faker 자체가 아닙니다.
- SSR 목 경로는 `lib/auth/server.ts`의 `getCurrentUserForSsr()`입니다.
  `shouldEnableMocking()`이 참이면 고정 mock 유저를 돌려줍니다.
