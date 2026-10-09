# APP-1031 외부 에이전트 연결 안내 카드의 앱별 단계 개편 — 구현 순서

- 이슈: [APP-1031](https://linear.app/minswon/issue/APP-1031)
- spec: docs `origin/main:projects/PRO-54-외부-에이전트-연결/spec/APP-1031/spec.md` @ `afe5e8b`
- 프로젝트 브랜치: `pro-54/외부-에이전트-연결` ← `dev` (APP-933 뒤 지웠다 — `dev` `50c6c90` 에서 새로 만든다. 워크트리 `.worktrees/pro-54`)
- APP 브랜치: `feat/app-1031/agent-guide-tabs` ← `pro-54/외부-에이전트-연결`
- 병합: APP → PRO 는 squash(로컬, `merge-worktree.sh`), PRO → `dev` 는 rebase, 그 뒤 `dev` → `main`(Vercel 운영). 커밋 제목은 `[APP-1031] 제목`. push 는 단계마다 사용자 확인 뒤
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 계약을 건드리지 않는다. 주소는 지금처럼 `buildUrl("/mcp")` 이고 server 요청은 그대로다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 숫자는 없다. 「같은 계정의 Claude Code 에 커넥터가 들어온다」는 spec 을 쓴 세션에서 확인했다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | `AgentOAuthGuide` 를 쓰는 곳은 `agent-connections-settings.tsx` 한 곳이다. 시험이 기대는 이름은 둘이다 — 카드의 `region` 이름 「OAuth 연결 안내」(컴포넌트 시험 2곳, e2e 1곳)와 「개인 토큰 만들기」 버튼(컴포넌트 시험 2곳, e2e 2곳). 둘 다 그대로 둔다. 안내 카드의 명령을 통째로 비교하는 컴포넌트 시험 하나(`blocks` 비교)는 탭별 비교로 바꾼다. 토큰 발급 화면(`IssuedToken`)의 명령은 범위 밖이라 그 시험은 그대로다 |
| 되돌리기 | 복구 비용은 얼마인가 | 안내 문구와 배치만 바뀐다. `main` 커밋 하나를 revert 하면 된다 |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 열린 질문은 없다. 탭 배치·기본 탭·`--scope user` 는 사용자가 시안과 질문으로 확인했다(docs#200) |

## 무엇을 건드리나

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `components/agent-connections/agent-oauth-guide.tsx` | 머리 문단 + MCP 주소 칸 + 네 앱 묶음이 모두 펼쳐진 카드 | 「어떤 앱에서 HeyMoa 를 쓰시나요?」 머리, `components/ui/tabs.tsx` 네 탭(기본 Claude 앱·claude.ai), 탭마다 번호 단계·복사 칸·「잘 안 될 때」 접는 칸, 끝 상태 한 줄, 개인 토큰 링크와 닫기 |
| `components/settings/agent-connections-settings.test.tsx` | 「OAuth 안내」 묶음이 세 복사 칸을 통째로 비교 | 기본 탭의 단계·주소, 탭을 바꾸면 그 앱의 명령(Claude Code 는 `--scope user`), 어느 탭에도 토큰 없음 |
| `e2e/agent-connections.spec.ts` | 「새 연결」 뒤 안내 `region` 이 보이는지 본다 | 기본 탭 단계가 보이고 Claude Code 탭으로 바꾸면 명령이 보이는 것을 한 번 본다 |

**배치를 여기서 정한다.** 탭별 단계는 같은 파일 안의 작은 컴포넌트(단계 한 줄)로 그리고, 탭 내용은 그 파일의 자료(앱별 단계 목록)가 아니라 JSX 로 직접 쓴다 — 앱마다 문장 모양이 달라 자료로 뽑으면 문장을 쪼개게 된다. 「잘 안 될 때」는 네이티브 `<details>` 로 접는다.

## 순서

### 1. 안내 카드 개편

- 바꾸는 것: `agent-oauth-guide.tsx`, 컴포넌트 시험
- 시험: 「새 연결」 → 기본 탭(Claude 앱·claude.ai)의 세 단계와 주소 복사 칸. Claude Code 탭은 `claude mcp add --transport http --scope user heymoa <주소>`, Codex 탭은 `codex mcp add heymoa --url <주소>`, ChatGPT 탭은 도움말 링크. 어느 탭에도 `Bearer`·`hm_` 없음. 「개인 토큰 만들기」는 그대로 폼을 연다
- 검증: `pnpm test:run -- agent-connections && pnpm typecheck`
- 되돌리기: 이 커밋만 revert

### 2. e2e

- 바꾸는 것: `e2e/agent-connections.spec.ts` 첫 시험에 기본 탭 단계와 Claude Code 탭 전환을 한 번 본다
- 검증: `pnpm test:e2e -- agent-connections workspace-agent-access` (dev 서버·프리뷰가 떠 있으면 먼저 끈다)
- 되돌리기: 이 커밋만 revert

### 3. 화면 확인 (커밋 없음)

- MSW dev 서버에서 네 탭을 차례로 열어 찍고, 좁은 폭(모바일)에서 탭이 넘치지 않는지 본다

## 마지막 관문

2단계까지 커밋한 뒤 `pnpm test:run && pnpm verify`, `pnpm test:e2e`, OAuth e2e(`-c playwright.oauth.config.ts`)를 한 번 통째로 돌린다. web 은 PR·CI 가 없어 **이것이 유일한 관문**이다. 그다음 codex 리뷰를 지나 APP → PRO squash, PRO → `dev` rebase, `dev` → `main` 순서로 넣고, push 는 단계마다 사용자 확인 뒤에 한다.

## 안 하는 것

- 토큰 발급 화면(`IssuedToken`)의 명령·문구 — spec 「범위 밖」
- 도움말 문서 — APP-1025
- 마지막 탭 기억하기 — spec 「무엇을 포기했나」
