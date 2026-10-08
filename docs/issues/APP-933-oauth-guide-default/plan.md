# APP-933 외부 에이전트 연결 안내를 OAuth 한 갈래로 정리 — 구현 순서

- 이슈: [APP-933](https://linear.app/minswon/issue/APP-933)
- spec: docs `origin/main:projects/PRO-54-외부-에이전트-연결/spec/APP-933/spec.md` @ `f73084f`
- 프로젝트 브랜치: `pro-54/외부-에이전트-연결` ← `dev` (워크트리 `.worktrees/pro-54`, 지금 `dev` `c647378` 과 같다)
- APP 브랜치: `feat/app-933/oauth-guide-default` ← `pro-54/외부-에이전트-연결`
- 병합: APP → PRO 는 squash(로컬, `merge-worktree.sh`), PRO → `dev` 는 rebase, 그 뒤 `dev` → `main`(Vercel 운영 = 운영 켜기). 커밋 제목은 `[APP-933] 제목`. push 는 단계마다 사용자 확인 뒤
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 계약을 건드리지 않는다. 안내 카드가 보이는 주소는 `buildUrl("/mcp")` 이고, 운영에서 `https://api.heymoa.app/mcp` 의 OAuth 메타데이터가 켜져 있다(spec 을 쓰며 확인) |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 숫자는 없다. 「안내 명령이 운영에서 연결된다」는 APP-932 운영 확인 기록(Claude Code·Codex 인증 성공)이 근거다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | 설정값을 읽는 곳은 `agent-connections-settings.tsx` 한 곳(「새 연결」이 여는 화면, 빈 목록 문구). 시험은 두 무리다 — 값을 켜고 끄는 「OAuth 안내」 묶음 다섯, 값 없이 「새 연결」 뒤 바로 토큰 폼을 쓰는 일곱 자리(APP-941 막힘 시험의 `openForm` 하나 포함). e2e 는 `agent-connections.spec.ts` 두 곳과 `workspace-agent-access.spec.ts` 한 곳이 같은 전제다. OAuth e2e(`playwright.oauth.config.ts`)는 동의 화면만 보므로 영향이 없다. `docs/issues/APP-889-…/plan.md` 의 설정값 언급은 그 이슈의 기록이라 고치지 않는다 |
| 되돌리기 | 복구 비용은 얼마인가 | `main` 커밋 하나를 revert 하고 Vercel 이 다시 빌드하면 운영이 개인 토큰 폼 기본으로 돌아간다. 저장 데이터는 바뀌지 않는다. 운영 server OAuth 를 끌 때 이 커밋도 함께 되돌려야 한다(spec 「어떻게 실패하나」, 사용자가 받아들임) |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 열린 질문은 없다. 결정 넷(한 번에 정리, 운영 확인은 화면만, 이슈 본문 고침, Vercel 옛 값은 배포 뒤 정리)은 사용자가 추천대로 확인했다(docs#198) |

## 무엇을 건드리나

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `components/settings/agent-connections-settings.tsx` | `oauthGuide` 로 「새 연결」의 첫 화면과 빈 목록 문구를 가른다 | 설정값·`oauthGuide` 와 꺼짐 갈래를 지운다. 「새 연결」은 늘 `guide` 로 열고, 빈 목록은 OAuth 문구만. 주석을 지금 상태로 고친다 |
| `.env.example` | 설정값 줄과 주석 셋 | 지운다 |
| `components/settings/agent-connections-settings.test.tsx` | 「OAuth 안내」 묶음 다섯이 값을 켜고 끄고, 나머지 일곱 자리는 꺼짐 기본을 전제로 「새 연결」 뒤 바로 폼을 쓴다 | `vi.stubEnv` 와 꺼짐 갈래 시험을 지우고, 폼을 쓰는 곳은 「새 연결」→「개인 토큰 만들기」를 거치는 지역 도우미 하나로 연다 |
| `e2e/agent-connections.spec.ts` · `e2e/workspace-agent-access.spec.ts` | 「새 연결」 뒤 바로 폼을 채운다 | 「개인 토큰 만들기」를 거친다. 첫 시험에서 안내 카드가 기본으로 열리는 것을 한 번 본다 |

**배치를 여기서 정한다.** 폼을 여는 도우미는 컴포넌트 시험 파일 안에 둔다(쓰는 곳이 그 파일뿐이다). e2e 는 두 파일에 한 줄씩 더하는 것이라 도우미를 만들지 않는다.

## 순서

### 1. 설정값과 꺼짐 갈래 지우기

- 바꾸는 것: 컴포넌트, `.env.example`, 컴포넌트 시험(지우기·도우미로 바꾸기)
- 시험: 「새 연결」은 안내 카드(주소·에이전트별 명령)를 열고, 「개인 토큰 만들기」로만 폼이 열린다. 빈 목록은 주소를 등록하라는 문구다. 기존 토큰 발급·막힘·회수 시험은 도우미를 거쳐 그대로 통과한다
- 검증: `pnpm test:run -- agent-connections && pnpm typecheck` 그리고 `grep -rn NEXT_PUBLIC_AGENT_OAUTH_GUIDE app components lib e2e .env.example` 가 비어 있다
- 되돌리기: 이 커밋만 revert

### 2. e2e

- 바꾸는 것: 토큰을 만드는 e2e 세 곳이 「개인 토큰 만들기」를 거친다. 첫 시험이 안내 카드가 기본으로 열리는 것을 본다
- 검증: `pnpm test:e2e -- agent-connections workspace-agent-access` (dev 서버·프리뷰가 떠 있으면 먼저 끈다)
- 되돌리기: 이 커밋만 revert. 1단계만 남으면 이 e2e 가 깨지므로 둘을 함께 되돌린다

### 3. 로컬 확인 (커밋 없음)

- MSW dev 서버에서 설정 › 계정 › 외부 에이전트의 「새 연결」이 안내 카드를 열고, 「개인 토큰 만들기」가 폼을 여는 화면을 찍어 둔다. 실제 server 끝-끝은 하지 않는다 — 바뀌는 것은 화면 갈래뿐이고 server 와 주고받는 요청이 같다

## 마지막 관문

2단계까지 커밋한 뒤 `pnpm test:run && pnpm verify` 와 `pnpm test:e2e`, `playwright test -c playwright.oauth.config.ts` 를 한 번 통째로 돌린다. web 은 PR·CI 가 없어 **이것이 유일한 관문**이다. 그다음 skill `merging` 의 codex 리뷰를 지나 APP → PRO squash, PRO → `dev` rebase, `dev` → `main` 순서로 넣고, push 는 단계마다 사용자 확인 뒤에 한다. `main` 배포 뒤 운영 화면 확인은 사용자가 한다(spec 「다 됐다고 판단하는 기준」).

## 안 하는 것

- 안내 카드의 문구·에이전트 목록, 개인 토큰 폼 — spec 「범위 밖」
- Vercel 운영 환경값 정리 — 남아 있다면 배포 뒤 사용자가 지운다
- 지난 plan(`docs/issues/APP-889-…`)의 설정값 언급 — 그 이슈의 기록이다
