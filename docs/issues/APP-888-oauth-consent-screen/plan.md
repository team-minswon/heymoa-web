# APP-888 외부 에이전트 연결 동의 화면 — 구현 순서

- 이슈: [APP-888](https://linear.app/minswon/issue/APP-888)
- spec: docs `origin/main:projects/PRO-54-외부-에이전트-연결/spec/APP-888/spec.md` @ `4644b60` (처음 병합 `245dcbc`, docs#180 으로 web 사본 동기화 기준 고정)
- 프로젝트 브랜치: `pro-54/외부-에이전트-연결` ← `dev` (web 에는 아직 없다. 착수 때 `origin/dev` 에서 만든다)
- APP 브랜치: `feat/app-888/oauth-consent-screen` ← `pro-54/외부-에이전트-연결`
- 병합: APP → PRO 는 squash(로컬, `merge-worktree.sh`), PRO → dev 는 PRO-54 2단계가 끝난 뒤 rebase. 커밋 제목은 `[APP-888] 제목`(레포 `CLAUDE.md`)
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 어긋나지 않는다. docs `245dcbc` 미러의 `getAgentOAuthConsent`·`approveAgentOAuthConsent`·`denyAgentOAuthConsent` 와 필드(`clientName`·`redirectHost`·`scopes`, `{state, workspaceId}`, `redirectUri`)를 읽었다. server `pro-54 @ cced0b5c` 의 `AgentOAuthEndpoints` 가 보내는 web 경로도 `/oauth/authorize`·`/oauth/consent` 로 spec 과 같다. 한 가지를 구현에 반영한다: 404 는 `AGENT_OAUTH_REQUEST_NOT_FOUND` 말고도 `WORKSPACE_NOT_FOUND` 가 있으므로, 「다시 연결」 안내는 상태 코드가 아니라 **오류 코드**로 가른다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | web 사본 동기화를 스크래치에서 돌려 쟀다 — `245dcbc` 기준 68 → 71경로, 스키마 4개 추가, `AgentDelegationsResponse`·`CreatedAgentDelegationResponse` 만 변경. main(`001d160`) 기준은 72경로로 PRO-48 몫이 섞인다. 「access 만료 → proxy 갱신 쿠키가 바깥 302 에 실린다」는 코드만 읽었고 재지 않았다 — 6단계 e2e 시나리오 3이 잰다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | 생성 타입에서 `credentialKind` 가 필수가 되어 목 위임 seed 4곳(`lib/mocks/db.ts`)과 `createAgentDelegation`, 시험 fixture 2곳(`agent-connections-settings.test.tsx`)을 고쳐야 한다. `normalizeReturnTo` 호출자(`auth-callback-client`·`google-login-button`·`invite-landing`)는 허용 목록이 넓어지기만 해 영향이 없다. `proxy.ts` matcher 는 이미 `/oauth/*` 를 덮는다. APP-902 인증 e2e 설정은 건드리지 않는다. 초대 화면의 `Card` 를 옮기면 `invite-landing` 이 바뀐다 |
| 되돌리기 | 복구 비용은 얼마인가 | web 화면·헤더·생성 코드만 바뀌고 데이터는 없다. 단계마다 커밋 하나를 되돌리면 된다. 운영은 server OAuth 가 꺼져 있어 새 경로가 쓰이지 않는다 |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 셋(사이트 전체 프레임 금지, 실제 Google 로 긴 `returnTo`, claude.ai·ChatGPT 창) 모두 운영에서 OAuth 를 켜는 날 확인할 것이라 이 구현을 막지 않는다. 동기화 기준은 사용자가 정했다(docs#180) |

## 무엇을 건드리나

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `openapi3.yml` | server 미러 사본, 68경로 | docs `245dcbc` 미러에서 `scripts/sync-openapi.mjs` 로 다시 만든 71경로 |
| `lib/api/generated/**` | orval 생성물 | `pnpm orval` 재생성. 동의 API 훅(`agent-o-auth…` 태그 폴더) 생성 |
| `lib/mocks/db.ts` | 위임 seed 3개 + 생성 함수에 `credentialKind` 없음 | `credentialKind: "PERSONAL_TOKEN"` 를 채운다. 동의 요청 목 저장(state → 에이전트 이름·호스트)과 허락·거절 처리를 더한다 |
| `lib/mocks/rest-handlers.ts` | 동의 API 핸들러 없음 | 조회·허락·거절 핸들러(목 개발 화면용) |
| `components/settings/agent-connections-settings.test.tsx` | fixture 2곳에 `credentialKind` 없음 | 채운다 |
| `components/agent-connections/agent-access-notice.tsx` | (신규) | 알림 네 줄. `agent-connections-settings.tsx` 의 목록을 그대로 옮긴다 |
| `components/settings/agent-connections-settings.tsx` | 알림 네 줄이 박혀 있다 | 공용 알림을 쓴다 |
| `components/layout/centered-card.tsx` | (신규) | `invite-landing.tsx` 의 `Card` 를 옮긴다(아이콘 원 + 카드). 제품 의미가 없어 `layout/` 에 둔다 |
| `components/workspace/invite-landing.tsx` | 파일 안에 `Card` | 옮긴 카드를 쓴다 |
| `lib/auth/paths.ts` | `returnTo` 허용 목록에 `/oauth/*` 없음 | `/oauth/authorize`·`/oauth/consent` 를 더하고, 받은 쿼리로 server 인가 주소를 만드는 `buildAgentAuthorizeUrl` 을 더한다(API 주소 + `/oauth2/authorize` 고정) |
| `lib/auth/paths.test.ts` | | 위 둘의 시험 |
| `components/agent-connections/agent-oauth-login-card.tsx` | (신규) | 「에이전트를 HeyMoa 에 연결하려면 로그인하세요」 + Google 버튼(`buildGoogleOAuthUrl(현재 주소)`). 입구·동의 화면이 같이 쓴다 |
| `app/oauth/authorize/page.tsx` | (신규) | SSR. 로그인이면 `redirect(buildAgentAuthorizeUrl(…))`, 아니면 로그인 카드, 쿼리가 비면 「다시 연결」 안내 |
| `app/oauth/authorize/page.test.tsx` | (신규) | 세 갈래를 `getCurrentUserForSsr`·`redirect` 를 목으로 바꿔 본다(`app/auth/callback/page.test.tsx` 와 같은 방식) |
| `app/oauth/consent/page.tsx` | (신규) | SSR 로 로그인 확인 → 아니면 로그인 카드, 맞으면 동의 컴포넌트 |
| `components/agent-connections/agent-oauth-consent.tsx` | (신규) | 클라이언트. 동의 조회·워크스페이스 고르기·허락·거절·이동 |
| `components/agent-connections/agent-oauth-consent.test.tsx` | (신규) | 컴포넌트 시험 |
| `next.config.ts` | 헤더 설정 없음 | `headers()` 로 `/oauth/:path*` 에 프레임 금지 두 줄 |
| `playwright.oauth.config.ts` | (신규) | 목 끔. webServer 둘 — 가짜 API(`node e2e/agent-oauth/fake-api.ts`), web(`pnpm dev`, `NEXT_PUBLIC_API_BASE_URL` = 가짜 API) |
| `e2e/agent-oauth/fake-api.ts` | (신규) | Node `http` 가짜 API. Node 24 의 타입 제거로 그대로 돈다. 생성 타입은 `import type` 상대 경로로만 쓴다 |
| `e2e/agent-oauth/consent-flow.spec.ts` | (신규) | 시나리오 넷 |

**배치 결정.**
- 동의 화면 쪽 컴포넌트는 새 폴더 `components/agent-connections/` 에 둔다. 설정 화면(`components/settings/`)과 OAuth 화면이 같이 쓰는 알림도 여기 둔다 — settings 가 oauth 를 가져오거나 그 반대가 되지 않게.
- 동의 화면은 `/invite` 처럼 일반 경로로 두고 `isChromelessRoute` 는 고치지 않는다. 위 막대(HeyMoa 표시)가 남아 이 화면이 HeyMoa 의 것임을 보여 준다.
- 쿼리를 다시 붙일 때 Next 가 준 `searchParams` 를 이름·값·순서대로 `URLSearchParams` 에 넣는다. 같은 이름이 여러 번 오면 모두 넣는다.

## 순서

### 1. web 사본 동기화와 생성 훅

- 바꾸는 것: `openapi3.yml`(docs `245dcbc` 미러에서 `scripts/sync-openapi.mjs`), `pnpm orval`, 목 위임 seed·생성 함수와 설정 시험 fixture 에 `credentialKind`
- 미러 읽기: `$HOME/.heymoa/moa/scripts/docs-read.sh --ref 245dcbc contracts/specs/openapi3-server.yml > <스크래치>/mirror.yml`
- 검증: 경로 71개·추가 스키마 4개인지 센다(동기화 스크립트가 `Public mirror: 71 paths` 를 찍는다). `pnpm typecheck && pnpm test:run`
- 되돌리기: 이 커밋만 되돌리면 된다. 생성 코드와 목뿐이다

### 2. 공용 알림과 카드 꺼내기

- 바꾸는 것: `agent-access-notice.tsx`·`centered-card.tsx` 신규, 설정 연결 대화상자와 초대 화면이 그것을 쓰게
- 동작은 바뀌지 않는다
- 검증: `pnpm test:run -- components/settings components/workspace` 와 `pnpm typecheck`. 설정 시험의 「회의 전사도 에이전트가 읽는다고 알린다」가 그대로 통과해야 한다
- 되돌리기: 이 커밋만 되돌린다

### 3. 로그인 뒤 돌아갈 길과 입구 `/oauth/authorize`

- 바꾸는 것: `lib/auth/paths.ts`(허용 목록, `buildAgentAuthorizeUrl`), 로그인 카드, `app/oauth/authorize/page.tsx`, 시험 둘
- 시험이 보는 것:
  - 로그인이면 API 주소 + `/oauth2/authorize` 로 같은 쿼리(인코딩된 `redirect_uri`·`resource` 포함)와 함께 보낸다
  - 쿼리에 `redirect_uri=https://evil.example`·`returnTo=…` 가 있어도 보내는 곳은 그대로다
  - 로그인 안 됨이면 로그인 카드이고 Google 주소의 `returnTo` 가 `/oauth/authorize?…` 다
  - 쿼리가 비면 「다시 연결」 안내다
  - `normalizeReturnTo` 가 `/oauth/authorize?…`·`/oauth/consent?…` 를 쿼리째 통과시키고 `/oauth/other` 는 `/` 로 보낸다
- 검증: `pnpm test:run -- lib/auth app/oauth` 와 `pnpm typecheck`
- 되돌리기: 이 커밋만 되돌린다. 아직 server 가 이 경로로 보내지 않는다

### 4. 동의 화면 `/oauth/consent`

- 바꾸는 것: `app/oauth/consent/page.tsx`, `agent-oauth-consent.tsx`, 목 핸들러, 컴포넌트 시험
- 동작:
  - 조회는 일반 `useQuery` 형태의 생성 훅(404 를 화면이 그리므로 suspense 를 쓰지 않는다)
  - 허락·거절 mutation 은 `meta: { suppressErrorToast: true }` 로 전역 토스트를 끄고 화면이 그린다
  - 문구는 server 것(`errorMessageOf()`)을 쓴다. 오류 코드(`errorCodeOf()`)는 화면 갈래만 정한다 — `AGENT_OAUTH_REQUEST_NOT_FOUND` 면 허락·거절 버튼을 거두고 그 문구만 남기고, 그 밖은 버튼을 둔 채 문구를 띄운다(web 규칙 `error-loading`)
  - `redirectUri` 가 `http:`·`https:` 일 때만 `window.location.assign`, 아니면 오류 안내
  - 누르는 동안 두 버튼을 모두 막는다
- 시험이 보는 것: 이름·「HeyMoa 가 확인한 앱이 아닙니다」·호스트·「읽기」·알림 / 워크스페이스 하나는 미리 고름, 둘은 고르기 전 허락 막힘, 없음은 거절만 / 404 안내 / scheme 검사 / 허락·거절 요청 본문
- 검증: `pnpm test:run -- components/agent-connections` 와 `pnpm typecheck`. 목 개발 서버에서 `/oauth/consent?state=mock` 을 열어 눈으로 본다
- 되돌리기: 이 커밋만 되돌린다

### 5. 프레임 금지 헤더

- 바꾸는 것: `next.config.ts` 의 `headers()`
- 검증: `pnpm dev` 를 띄우고 `curl -sI localhost:3000/oauth/consent?state=x` 에 `X-Frame-Options: DENY` 와 `frame-ancestors 'none'` 이 있는지, `curl -sI localhost:3000/` 에는 없는지 본다. 6단계 e2e 가 같은 것을 다시 본다
- 되돌리기: 이 커밋만 되돌린다

### 6. OAuth e2e(가짜 API)

- 바꾸는 것: `playwright.oauth.config.ts`, `e2e/agent-oauth/fake-api.ts`, `e2e/agent-oauth/consent-flow.spec.ts`
- 가짜 API:
  - 쿠키 이름은 `lib/auth/cookies.ts` 와 같다(`access_token`·`refresh_token`). access 는 `exp` 가 든 JWT 모양(서명 없음) — `proxy.ts` 가 `exp` 만 읽는다
  - `GET /v1/auth/session`, `POST /v1/auth/refresh`(refresh 를 바꾸고 새 쿠키), Google 로그인 시작(바로 쿠키를 심고 web `/auth/callback?returnTo=…` 로), `GET /oauth2/authorize`(쿠키가 살아 있으면 web 동의로, 없으면 web 입구로 받은 쿼리 그대로), 동의 API 셋, `GET /v1/workspaces`, 에이전트 콜백(받은 쿼리를 기록하고 시험이 읽는 엔드포인트)
  - 브라우저에서 부르는 경로는 web 주소를 허용하는 CORS(credentials 포함)
  - 응답 본문은 생성 타입을 `import type` 으로 붙여 필드 이름이 갈라지면 `pnpm typecheck` 가 깨지게 한다
- 시나리오:
  1. 쿠키 없이 가짜 API 의 `/oauth2/authorize?…` 를 연다 → web 로그인 카드 → 로그인 → 동의 화면 → 허락 → 콜백에 `code`·`state`
  2. 거절 → 콜백에 `error=access_denied`, 가짜 API 기록에 허락 요청 없음
  3. 만료된 access + 살아 있는 refresh 쿠키로 `/oauth2/authorize?…` → 로그인 카드를 거치지 않고 동의 화면. 가짜 API 기록에 갱신 1번
  4. `/oauth/authorize`·`/oauth/consent` 응답 헤더에 프레임 금지 두 줄
- 검증: `pnpm exec playwright test --config playwright.oauth.config.ts`. dev 서버가 `.next` 를 나눠 쓰므로 다른 e2e 와 동시에 돌리지 않는다
- 되돌리기: 이 커밋만 되돌린다. 시험 설비뿐이다
- 시나리오 3이 실패하면(갱신 쿠키가 바깥 302 에 안 실림) spec 「어떻게 실패하나」대로 입구를 「갱신 뒤 클라이언트 이동」으로 바꾸고 Linear ③ 을 남긴다

### 7. 끝-끝 로컬 확인 (커밋 없음)

- server: `heymoa-server` 에 버리는 워크트리를 만들어 `origin/dev` 위에 `origin/pro-54/외부-에이전트-연결` 을 로컬로 병합한다(push 하지 않음). 이미지로 구워 compose 로 띄운다(버리는 DB, `local` 프로필, `AGENT_OAUTH_ENABLED=true`, web 주소 `http://localhost:3000`)
- web: 이 브랜치의 `pnpm dev`, `NEXT_PUBLIC_API_BASE_URL` 은 그 server
- 브라우저 패널에 로컬 프로필 로그인 쿠키를 심는다
- Codex CLI: 임시 `CODEX_HOME` 에서 `codex mcp login` → 연 주소를 브라우저 패널로 따라가 동의 화면에서 허락 → 「Successfully logged in」, `codex mcp list` 의 Auth
- Claude Code: 임시 `CLAUDE_CONFIG_DIR` 에서 `claude mcp add`·로그인 → 같은 흐름 → `claude mcp list` 의 연결 상태·도구 목록
- 모델은 부르지 않는다. 결과는 Linear ⑤ 에 적고, 버리는 워크트리·compose·임시 폴더·쿠키 파일을 지운다

### 8. 계약 문서

- docs `contracts/README.md` 의 web 사본 행을 고친다(기준 `245dcbc`, PRO-48 몫 빠짐, 경로·스키마 수). 전용 docs 워크트리에서 docs PR 로 올린다
- 검증: 행의 경로 수가 1단계에서 센 수와 같다

## 마지막 관문

APP 브랜치를 PRO 브랜치에 squash 하기 직전, 조용한 머신에서 한 번 통째로 돌린다.

- `pnpm test:run && pnpm verify`
- `pnpm test:e2e` — 레포 `CLAUDE.md` 와 merging skill 이 머지 전 관문으로 요구한다. 설정 화면의 공용 알림을 바꿔 MSW e2e(`agent-connections.spec.ts`)도 다시 봐야 한다
- `pnpm exec playwright test --config playwright.auth.config.ts` — `lib/auth/paths.ts` 를 바꿨으므로 APP-902 인증 e2e 도 다시 본다
- `pnpm exec playwright test --config playwright.oauth.config.ts`
- `codex exec review --base pro-54/외부-에이전트-연결` — 이 레포의 유일한 코드 리뷰 게이트다(merging skill 은 `--base dev` 로 적었지만 이 이슈의 base 는 PRO 브랜치다)
- e2e 는 다른 무거운 작업과 겹치지 않게 돌리고, 띄워 둔 프리뷰 dev 서버를 먼저 끈다 — `.next` 를 나눠 쓴다

이 레포는 PR 도 CI 도 쓰지 않는다. **여기서 안 걸리면 아무 데서도 안 걸린다.** PRO 브랜치를 원격에 올리는 것은 사용자에게 묻고 한다.

## 안 하는 것

- 설정의 연결 목록(OAuth 연결 표시, `credentialKind`·회수 사유 문구)과 연결 안내 전환 — APP-889. 1단계에서 생성 타입만 받고 화면은 안 고친다
- docs main 미러의 PRO-48 몫 동기화 — PRO-48 이 server 에 들어갈 때 그쪽에서 한다
- 목 개발 모드에서 `/oauth/authorize` 를 동의 화면으로 바로 잇는 편의 — 목 개발은 `/oauth/consent?state=mock` 을 바로 연다
- 사이트 전체 프레임 금지
