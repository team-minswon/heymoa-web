# APP-889 외부 에이전트 연결 화면의 OAuth 연결 목록과 안내 전환 — 구현 순서

- 이슈: [APP-889](https://linear.app/minswon/issue/APP-889)
- spec: docs `origin/main:projects/PRO-54-외부-에이전트-연결/spec/APP-889/spec.md` @ `0b6938d`
- 프로젝트 브랜치: `pro-54/외부-에이전트-연결` ← `dev` (web 원격에 있음, `3ca427f` = APP-888)
- APP 브랜치: `feat/app-889/oauth-connection-guide` ← `pro-54/외부-에이전트-연결`
- 병합: APP → PRO 는 squash(로컬, `merge-worktree.sh`, PRO 워크트리 `.worktrees/pro-54`), PRO → dev 는 PRO-54 2단계를 마칠 때 rebase(APP-932 의 전제). 커밋 제목은 `[APP-889] 제목`
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 어긋나지 않는다. 생성 타입 `AgentDelegationsResponseDataDelegationsItemCredentialKind` 가 `PERSONAL_TOKEN`·`OAUTH`, `…RevokeReason` 이 `USER`·`MEMBERSHIP_ENDED`·`REFRESH_TOKEN_REUSED` 다(APP-888 이 docs `245dcbc` 미러로 들임). 회수 API(`DELETE /v1/agent-delegations/{id}`)는 자격 종류를 받지 않는다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 에이전트 명령은 로컬 `--help` 로 확인했다(Claude Code 2.1.285, Codex 0.160). ChatGPT·claude.ai 조건은 공식 도움말 검색 결과이고 운영 확인은 APP-932 몫이다. 이 plan 이 새로 근거로 삼는 숫자는 없다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | 바뀌는 화면은 `agent-connections-settings.tsx` 하나다(`settings-dialog.tsx` 가 그린다). 시험 더블: 설정 시험이 생성 훅을 `vi.mock` 하고 회수 훅이 호출을 기록하지 않아, 회수 시험을 위해 기록하게 바꾼다. 시험 fixture `row()` 에 `credentialKind` 가 없다(타입이 `unknown[]` 라 지금은 안 걸린다) — 채운다. MSW 시드에는 APP-888 이 `credentialKind` 를 넣었고 「떠난 팀의 연결」이 OAuth·`MEMBERSHIP_ENDED` 다. e2e `agent-connections.spec.ts` 는 「지난 연결 3개」를 펼친다 |
| 되돌리기 | 복구 비용은 얼마인가 | web 화면과 설정값뿐이다. 단계마다 커밋 하나를 되돌리면 된다. 운영은 설정값이 꺼져 있어 안내가 지금 그대로다 |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 둘(ChatGPT 조건, claude.ai 연결) 다 운영에서만 확인되고 APP-932 로 옮겼다. 이 구현을 막지 않는다 |

## 무엇을 건드리나

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `components/settings/agent-connections-settings.tsx` | 개인 토큰만 아는 목록·「새 연결」 | 목록에 종류 뱃지·회수 사유, 「새 연결」이 설정값에 따라 OAuth 안내 카드 또는 지금 폼 |
| `components/settings/agent-connections-settings.test.tsx` | 개인 토큰 목록·발급 시험 | fixture 에 `credentialKind`, 회수 훅 호출 기록, 종류·사유·두 갈래 시험 |
| `components/agent-connections/copy-block.tsx` | (신규) | 설정 파일 안의 `CopyBlock` 을 옮긴다. 발급 안내와 OAuth 안내가 같이 쓴다 |
| `components/agent-connections/agent-oauth-guide.tsx` | (신규) | OAuth 안내 카드: MCP 주소, Claude Code·Codex·claude.ai·ChatGPT 방법, 「브라우저 없는 환경이면 개인 토큰 만들기」 |
| `e2e/agent-connections.spec.ts` | 지난 연결을 펼쳐 회수된 행을 본다 | 펼친 지난 연결에서 「떠난 팀의 연결」이 「OAuth」 뱃지와 「워크스페이스를 떠나 끊겼습니다」로 보이는 한 줄 |
| `.env.example` | 공개 설정값 셋 | `NEXT_PUBLIC_AGENT_OAUTH_GUIDE=disabled` 와 설명 한 줄 |

**배치 결정.**
- 설정값은 컴포넌트 안에서 `process.env.NEXT_PUBLIC_AGENT_OAUTH_GUIDE === "enabled"` 로 그릴 때 읽는다. Next 는 이 꼴을 빌드 때 값으로 바꾸고, vitest 는 `vi.stubEnv` 로 두 갈래를 그린다. 설정값 모듈을 따로 만들지 않는다 — 읽는 곳이 하나다.
- 종류·사유 문구는 `STATUS_LABEL` 옆에 `Record<…, string>` 상수로 둔다. enum 값이 늘면 타입 검사가 깨져 문구를 빠뜨리지 않는다.
- 「새 연결」의 지역 상태는 지금의 `creating` 불리언 대신 「안내 / 개인 토큰 폼 / 없음」 셋으로 둔다. 설정값이 꺼져 있으면 안내 상태를 건너뛴다.
- OAuth 안내 카드와 복사 칸은 APP-888 이 만든 `components/agent-connections/` 에 둔다. 설정 화면(`components/settings/`)이 가져다 쓴다.

## 순서

### 1. 목록의 종류 뱃지와 회수 사유

- 바꾸는 것: 설정 파일의 행(상태 뱃지 곁 「OAuth」/「개인 토큰」, OAuth 행은 토큰 앞자리 자리 비움), 지난 연결의 회수 사유 한 줄. 시험 fixture 의 `credentialKind`, 회수 훅 기록. e2e 한 줄
- 시험이 보는 것: 개인 토큰·OAuth 연결이 한 목록에 종류와 함께 보인다 / OAuth 행에 토큰 앞자리가 없다 / 두 행 모두 「회수」 → 확인 → 회수 요청이 그 id 로 간다 / 사유 세 문구가 각각 보이고 만료는 사유가 없다
- 검증: `pnpm exec vitest run components/settings` · `pnpm typecheck` · `pnpm exec playwright test e2e/agent-connections.spec.ts`
- 되돌리기: 이 커밋만 되돌린다. 설정값과 상관없이 나가는 부분이다

### 2. 복사 칸 꺼내기

- 바꾸는 것: `CopyBlock` 을 `components/agent-connections/copy-block.tsx` 로 옮기고 설정 파일이 가져다 쓴다. 동작은 그대로다
- 검증: `pnpm exec vitest run components/settings` — 발급 안내 시험(「에이전트마다 붙여 넣을 것 하나씩」)이 그대로 통과한다 · `pnpm typecheck`
- 되돌리기: 이 커밋만 되돌린다

### 3. OAuth 안내 카드와 설정값

- 바꾸는 것: `agent-oauth-guide.tsx`, 설정 파일의 「새 연결」 갈래와 빈 목록 문구, `.env.example`
- 안내 카드
  - MCP 주소(`buildUrl("/mcp")`) 복사 칸
  - Claude Code: `claude mcp add --transport http heymoa <주소>` 복사 칸, `/mcp` 로 인증한다는 줄, 폴더 범위 안내(APP-869)
  - Codex: `codex mcp add heymoa --url <주소>` 와 `codex mcp login heymoa` 복사 칸, 이미 등록했으면 `codex mcp remove heymoa` 먼저
  - claude.ai·Claude 앱: 사용자 지정 커넥터에 주소, Team·Enterprise 는 소유자가 먼저
  - ChatGPT: 개발자 모드 조건 문장과 OpenAI 도움말 링크(새 창)
  - 「등록한 뒤 에이전트가 연 브라우저에서 로그인하고 워크스페이스를 고르면 연결이 끝납니다」
  - 「브라우저 없는 환경(CI·서버에서 도는 에이전트)이면 개인 토큰 만들기」 → 지금 폼
- 시험이 보는 것: 설정값이 없거나 `enabled` 가 아니면 「새 연결」이 지금 폼이다 / `enabled` 면 안내 카드(주소, 네 에이전트, 각 명령의 주소가 `buildUrl("/mcp")` 와 같음)가 열리고 「개인 토큰 만들기」로 폼이 열려 발급까지 간다 / 켜졌을 때 빈 목록 문구가 바뀐다
- 검증: `pnpm exec vitest run components/settings components/agent-connections` · `pnpm typecheck` · 목 dev 서버를 설정값 켠 채 띄워 설정 창 › 외부 에이전트를 눈으로 본다
- 되돌리기: 이 커밋만 되돌린다. 운영은 설정값이 꺼져 있다

### 4. 로컬 끝-끝 (커밋 없음)

- server: APP-888 과 같이 버리는 워크트리에 `origin/dev` 위로 `origin/pro-54/외부-에이전트-연결` 을 로컬 병합(push 안 함)하고 jar·이미지로 띄운다. `Fixtures.kt` 충돌은 양쪽을 남긴다. docker 빌드가 키체인에서 멈추면 스크래치 `DOCKER_CONFIG` 로 돌린다
- web: 이 브랜치의 dev 서버, `NEXT_PUBLIC_API_BASE_URL` = 그 server, `NEXT_PUBLIC_AGENT_OAUTH_GUIDE=enabled`
- 시험용 로그인 쿠키는 파일에서 읽는 헤드리스 스크립트로만 쓴다(대화에 드러내지 않는다)
- 순서
  1. 스크립트로 워크스페이스 화면 → 설정 창 › 외부 에이전트 › 「새 연결」을 열고, 안내 카드의 Claude Code·Codex 명령 문자열을 읽어 온다
  2. 그 문자열을 **그대로** 임시 `CLAUDE_CONFIG_DIR`·`CODEX_HOME` 에서 실행한다. 인증은 Claude Code 안의 `/mcp` 대신 같은 일을 하는 `claude mcp login heymoa --no-browser`(가상 터미널)로 하고, Codex 는 안내의 `codex mcp login heymoa` 에 `--no-browser` 만 더한다. 각 CLI 가 연 인가 주소를 스크립트가 따라가 동의 화면에서 허락한다
  3. 설정 화면 목록에 두 연결이 「OAuth」 뱃지로 보이는지 화면으로 남긴다
  4. 하나를 목록의 「회수」로 끊고, 그 에이전트가 받은 토큰으로 `/mcp` 를 부르면 401 인지 본다. 남은 하나는 여전히 200 인지 본다
- 모델은 부르지 않는다. 끝나면 버리는 워크트리·compose·이미지·임시 폴더·쿠키 파일·상위 프리뷰 설정 항목을 지운다. 결과는 Linear ⑤ 에 적는다

## 마지막 관문

APP 브랜치를 PRO 브랜치에 squash 하기 직전, 다른 무거운 작업과 겹치지 않게(부하가 높으면 무관한 e2e 가 시간 초과로 깨진다) 한 번 통째로 돌린다.

- `pnpm test:run && pnpm verify`
- `pnpm test:e2e` — 레포 `CLAUDE.md` 와 merging skill 의 머지 전 관문. 설정 화면을 바꿨으므로 반드시 돈다
- `pnpm exec playwright test --config playwright.oauth.config.ts` — APP-888 흐름이 그대로인지
- `codex exec review -c model_reasoning_effort="high" --base pro-54/외부-에이전트-연결`

이 레포는 PR 도 CI 도 쓰지 않는다. **여기서 안 걸리면 아무 데서도 안 걸린다.** `merge-worktree.sh` 가 squash 직전 `pnpm test:run && pnpm verify` 를 한 번 더 돈다. PRO 브랜치 push 는 사용자에게 묻고 한다.

## 안 하는 것

- 운영 배포·OAuth 켜기·운영 확인 — APP-932
- 운영 안내 켜기와 꺼짐 갈래 정리 — APP-933
- 연결 이름 바꾸기, 개인 토큰 발급 방식 변경
- MSW e2e 를 설정값 켠 채로 한 벌 더 돌리는 설정 — 안내 갈래는 컴포넌트 시험과 로컬 끝-끝이 본다
