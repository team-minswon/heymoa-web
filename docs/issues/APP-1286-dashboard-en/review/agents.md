# 에이전트 연결·외부 에이전트 동의 (`agents`)

맡은 파일:

- `components/agent-connections/`: `agent-oauth-guide.tsx`(새 연결의 OAuth 안내), `agent-oauth-consent.tsx`(동의 화면), `agent-oauth-cards.tsx`(로그인·끝 카드), `agent-access-notice.tsx`, `agent-access-blocked.tsx`, `task-changes-toggle.tsx`, `copy-block.tsx`
- `app/(product)/oauth/`: `authorize/page.tsx`·`consent/page.tsx`(서버 컴포넌트). 한글은 없었고 `AGENT_OAUTH_RECONNECT_MESSAGE` 상수만 쓰던 자리입니다. `layout.tsx`는 한글이 주석뿐입니다
- 같이 고친 곳: `components/settings/agent-connections-settings.tsx`(「(MCP 꺼짐)」 접미어를 새 훅으로), `messages/ko/settings.json`의 `agentConnections.form.workspace`(「맡길」→「연결할」, 동의 화면과 같은 말)
- 언어 파일: `messages/<ko|en>/agents.json`, `messages/<ko|en>/common.json`(`actions.copy`, `copyBlock`)
- 등록: `i18n/messages.ts`, `i18n/messages.test.ts`의 `REQUIRED_EN`, `components/layout/app-shell.tsx`의 `PRODUCT_NAMESPACES`

판단:

- **동의 화면은 제품 루트 Provider 안입니다.** `/oauth/**`는 `app/(product)/layout.tsx`의 `AppShell` 아래라 서버 컴포넌트(`AgentOAuthEndCard`·`AgentOAuthLoginCard`)도 `useTranslations`로 같은 언어를 씁니다(next-intl의 서버 `useTranslations`). 렌더로 `/oauth/authorize`(쿼리 없음)가 영어로 그려지는 것을 확인했습니다
- **`AGENT_OAUTH_RECONNECT_MESSAGE` 상수를 지웠습니다.** `AgentOAuthEndCard`의 `message`가 선택이 되고, 안 넘기면 `agents.end.reconnect`를 그립니다. server가 문구를 주는 자리(`AGENT_OAUTH_REQUEST_NOT_FOUND`)는 지금처럼 server 문구를 그대로 받습니다
- **`BLOCKED_SUFFIX` 상수 대신 `useWorkspaceOptionLabel()` 훅**: 「{name} (MCP 꺼짐)」을 ICU 한 문장으로 둡니다. 개인 토큰 폼과 동의 화면이 같이 씁니다
- **`CopyBlock` 기본 문구는 `common.copyBlock`**: 마케팅 다운로드 페이지(Homebrew 명령)도 이 소품을 쓰고, 마케팅 루트는 `agents`를 내려 받지 않습니다. 다운로드 페이지는 지금처럼 `text`로 자기 문구를 넘깁니다. 한국어 토스트의 「을(를)」은 `objectParticle`로 받침에 맞춥니다
- **영어 토스트에는 라벨을 넣지 않습니다**(「Copied to clipboard.」): 설정의 발급 화면이 「Claude Code: paste in your terminal」 같은 긴 라벨을 넘겨 문장이 깨집니다
- **동의 버튼은 Allow / Decline**: 가이드 영어판이 이미 「[Allow]」를 쓰고, 거절은 용어집의 승인 카드 표기(Decline)를 따릅니다. OAuth 화면의 관용은 Allow/Deny·Allow/Cancel로 갈립니다
- **「맡기다」를 「접근·연결」로**: 「워크스페이스를 맡긴다」는 소유를 넘기는 것처럼 읽히고 영어(access)와 뜻이 달라, 동의 화면의 소개·로그인 설명·워크스페이스 라벨을 바꿨습니다. 설정 모듈의 다른 「맡긴」 문구(연결 끊기 확인창 등)는 그대로 두었습니다
- **안내 설명의 「읽기만 합니다」를 고쳤습니다**: 할 일 변경 허용(APP-1369)이 생긴 뒤로 사실과 달랐습니다. 「앱이 할 일 변경을 요청하면 연결할 때 허용할지 고릅니다」로 바꿨습니다
- **「주소」의 영어는 URL**(「HeyMoa URL」, 「paste the URL」): Claude의 사용자 지정 커넥터와 ChatGPT 커넥터가 server URL이라고 부릅니다
- **외부 앱 메뉴 이름은 그 앱의 영어 화면 이름**: Settings › Connectors, Add custom connector, Authenticate, Developer mode
- 범위 밖이지만 같이 고친 것: `e2e/agent-oauth/consent-flow.spec.ts`·`e2e/workspace-agent-access.spec.ts`의 한국어 기대값(윤문한 문장)

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 4 |
| 적합도 | 3 | 4 |
| 일관성 | 3 | 4 |
| **평균** | **3.5** | **4.0** |

## 반영한 지적

1차
- `guide.description`: 「읽기만 합니다」가 할 일 변경 허용과 어긋남 → 요청하면 연결할 때 고른다고 씀
- `login.description`·`consent.intro`·`consent.workspace`(+설정의 `form.workspace`): 「맡기다」 → 접근·연결
- `taskChanges.label`·`consent.scope.write`: 가운뎃점 나열 → 「할 일 변경 허용」(설정 배지 「할 일 변경 허용」과 같은 말), 「할 일 만들고 고치기」
- `consent.redirectTo`(en): 문장 조각 → 완결 문장
- `guide.noBrowser`: 「브라우저를 쓸 수 없다면」, 영어는 용어집 버튼 표기 「Create personal access token」
- `guide.claudeApp.trouble`: 「여기서 연결한 것이 … 들어옵니다」 → 「이 연결이 … 보입니다」
- `guide.claudeCode.trouble`·`guide.codex.trouble`: 「「이미 있다」고」 → 「heymoa가 이미 있다고」, 「명령을」 다시 붙여 넣음
- `guide.done`(en): 「it」 → 「the app」
- `consent.loadFailed`·`consent.workspacesFailed`: 마침표(설정 화면의 같은 실패 문구와 맞춤)

2차(점수 뒤 반영)
- `consent.deny`(en): Deny → Decline(용어집)
- `taskChanges.effect`(en): 복수 Apps/They → 단수(한국어와 같게)
- `consent.redirectTo`(en): 「After you click Allow, you'll go back to {host}.」
- `consent.noWorkspaces`(en): 「There are no workspaces to connect.」(소유로 읽히지 않게)
- `accessNotice.allProjects`(en): 「gets」 → 「can access」
- `common.copyBlock.failed`(en): 「copy it manually」

## 남긴 지적과 이유

- `end.reconnect`·`consent.invalidRedirect`의 「에이전트」 → 「AI 앱」(1차): server의 `AGENT_OAUTH_REQUEST_NOT_FOUND` 문구와 같은 말이어야 하고, 설정 화면도 연결 대상을 「에이전트」라고 부릅니다
- `common.copyBlock.copied` 영어에 라벨 넣기(1차): 위 판단 참고
- `guide.claudeCode.trouble`·`codex.trouble`을 합니다체로(2차): 「~하세요」는 요청이라 해요체 허용 범위입니다
- `guide.pasteInTerminal` 「아래 명령을」(2차): 바로 아래 명령 블록이 붙어 있어 길이만 늘어납니다
- `guide.claudeApp.trouble`의 「Team·Enterprise」(2차): 요금제 이름 두 개를 잇는 짧은 이름표라 그대로 둡니다
- `guide.done` 「연결이 나타납니다」(2차): 뒤에 「· 잘 안 될 때」가 이어지는 짧은 줄이라 그대로 둡니다

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `accessNotice.readAndTasks` | 앱은 읽기·화면 열기와 할 일 만들기·고치기를 합니다. | 앱은 내용을 읽고 화면을 열며, 할 일을 만들고 고칩니다. |
| `taskChanges.irreversible` | 허용은 연결을 만든 뒤 바꿀 수 없습니다. 바꾸려면 새로 연결합니다. | 허용 여부는 연결을 만든 뒤 바꿀 수 없습니다. 바꾸려면 새로 연결해야 합니다. |
| `login.title` | AI 앱을 HeyMoa 에 연결하려면 로그인하세요 | AI 앱을 HeyMoa에 연결하려면 로그인하세요 |
| `consent.unverified` | HeyMoa 가 확인한 앱이 아닙니다 | HeyMoa가 확인한 앱이 아닙니다 |
| `consent.redirectTo` | 허락하면 {host} 로 돌아갑니다 | 허락하면 {host}로 돌아갑니다 |
| `guide.description` | 고른 앱의 AI 가 이 워크스페이스의 회의와 프로젝트를 읽습니다. 읽기만 합니다. | 고른 앱의 AI가 이 워크스페이스의 회의와 프로젝트를 읽습니다. 앱이 할 일 변경을 요청하면 연결할 때 허용할지 고릅니다. |
| `guide.allow` | 열린 브라우저에서 워크스페이스를 고르고 「허락」 | 열린 브라우저에서 워크스페이스를 고르고 「허락」을 누릅니다 |
| `guide.claudeApp.openSettings` | Claude 앱이나 claude.ai 에서 설정 › 커넥터를 엽니다 | Claude 앱이나 claude.ai에서 설정 › 커넥터를 엽니다 |
| `guide.claudeApp.connect` | 「연결」을 누르고 열린 브라우저에서 워크스페이스를 고르고 「허락」 | 「연결」을 누른 뒤 열린 브라우저에서 워크스페이스를 고르고 「허락」을 누릅니다 |
| `guide.claudeApp.trouble` | Team·Enterprise 플랜은 조직 소유자가 먼저 커넥터를 추가해야 할 수 있습니다. 같은 계정으로 Claude Code 를 쓰면 여기서 연결한 것이 Claude Code 에도 들어옵니다. | Team·Enterprise 플랜은 조직 소유자가 먼저 커넥터를 추가해야 할 수 있습니다. 같은 계정으로 Claude Code를 쓰면 이 연결이 Claude Code에도 보입니다. |
| `guide.claudeCode.authenticate` | 터미널에서 <code>claude</code> 를 실행하고 <code>/mcp</code> → heymoa → 인증 | 터미널에서 <code>claude</code>를 실행하고 <code>/mcp</code> → heymoa → 인증 순서로 고릅니다 |
| `guide.claudeCode.trouble` | 「이미 있다」고 나오면 <code>claude mcp remove heymoa</code> 로 지운 뒤 다시 붙여 넣으세요. Claude 앱에서 커넥터로 연결했다면 따로 등록하지 않아도 됩니다. | heymoa가 이미 있다고 나오면 <code>claude mcp remove heymoa</code>로 지운 뒤 명령을 다시 붙여 넣으세요. Claude 앱에서 커넥터로 연결했다면 따로 등록하지 않아도 됩니다. |
| `guide.codex.trouble` | 브라우저가 열리지 않으면 <code>codex mcp login heymoa</code> 를 실행하세요. 「이미 있다」고 나오면 <code>codex mcp remove heymoa</code> 로 지운 뒤 다시 붙여 넣으세요. | 브라우저가 열리지 않으면 <code>codex mcp login heymoa</code>를 실행하세요. heymoa가 이미 있다고 나오면 <code>codex mcp remove heymoa</code>로 지운 뒤 명령을 다시 붙여 넣으세요. |
| `guide.chatgpt.developerMode` | 설정에서 개발자 모드를 켭니다 · <link>쓸 수 있는 요금제 보기</link> | 설정에서 개발자 모드를 켭니다. <link>쓸 수 있는 요금제 보기</link> |
| `login.description` | 로그인하면 이 앱에 워크스페이스를 맡길지 고르는 화면으로 이어집니다. | 로그인하면 이 앱이 접근할 워크스페이스를 고르는 화면으로 이어집니다. |
| `consent.intro` | 이 앱이 HeyMoa 워크스페이스를 맡겨 달라고 요청합니다. | 이 앱이 HeyMoa 워크스페이스 접근을 요청합니다. |
| `consent.workspace` | 맡길 워크스페이스 | 연결할 워크스페이스 |
| `taskChanges.label` | 할 일 만들기·고치기 허용 | 할 일 변경 허용 |
| `consent.scope.write` | 할 일 만들기·고치기 | 할 일 만들고 고치기 |
| `guide.noBrowser` | 브라우저가 없는 곳이면 <token>개인 토큰 만들기</token> | 브라우저를 쓸 수 없다면 <token>개인 토큰 만들기</token> |
| `consent.loadFailed` | 연결 요청을 불러오지 못했습니다 | 연결 요청을 불러오지 못했습니다. |
| `consent.workspacesFailed` | 워크스페이스를 불러오지 못했습니다 | 워크스페이스를 불러오지 못했습니다. |
| `settings.agentConnections.form.workspace` | 맡길 워크스페이스 | 연결할 워크스페이스 |

조사 앞 띄어쓰기(「HeyMoa 에」 「{host} 로」 「<code>…</code> 를」)도 같이 붙였습니다.

## 렌더 확인

임시 스크립트로 영어 계정 1440·1024에서 열었습니다(설정 > My MCP connections > New connection의 네 앱 탭과 「Having trouble?」, 개인 토큰 폼, `/oauth/consent?state=mock-consent`의 스위치·워크스페이스 선택, 없는 state, 쿼리 없는 `/oauth/authorize`).

- 넘침: 없음(잡힌 것은 폭 1px인 sr-only 요소뿐)
- 남은 한글 중 이 모듈 문구: 없음
- 남은 한글 중 다른 것: 목 데이터(워크스페이스·연결 이름 「노트북 Claude Code」 「테스트 유저의 워크스페이스」), 의도된 「언어 · Language」(D13), 없는 state에서 목 server가 주는 한국어 오류 문구(실제 server는 `Accept-Language`로 고릅니다)
- Codex 탭의 「Having trouble?」는 스크립트가 누르지 못했습니다(겹친 패널). 영어 시험이 한글 없음을 확인합니다

## 코드 리뷰

1회차: P1·P2 없음. P3 하나 — 동의 페이지의 서버 렌더링·하이드레이션을 영어로 보는 시험이 없다는 것. 실제 서버 경로(`/oauth/authorize`)를 렌더로 확인했고, 영어 문구는 `agent-connections-en.test.tsx`가 봅니다. 남겼습니다.
