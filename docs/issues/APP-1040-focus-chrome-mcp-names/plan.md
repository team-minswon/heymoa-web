# APP-1040 동의·초대 화면의 옛 머리글과 설정 메뉴 이름 정리 — 구현 순서

- 이슈: [APP-1040](https://linear.app/minswon/issue/APP-1040)
- spec: docs `origin/main:projects/PRO-54-외부-에이전트-연결/spec/APP-1040/spec.md` @ `3f7cd7b`
- 프로젝트 브랜치: `pro-54/외부-에이전트-연결` ← `dev` (APP-1031 뒤 지웠다 — `dev` `0377487` 에서 새로 만든다. 워크트리 `.worktrees/pro-54`)
- APP 브랜치: `feat/app-1040/focus-chrome-mcp-names` ← `pro-54/외부-에이전트-연결`
- 병합: APP → PRO 는 squash(로컬, `merge-worktree.sh`), PRO → `dev` 는 rebase, 그 뒤 `dev` → `main`(Vercel 운영). 커밋 제목은 `[APP-1040] 제목`. push 는 단계마다 사용자 확인 뒤
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 계약을 건드리지 않는다. 화면 틀과 문구만 바뀐다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 크기 숫자(카드 480px, 글자 16·14px, 선택칸 44px, 버튼 40px)는 시안을 로컬에서 찍어 사용자가 확인한 값이다. 다른 서비스 이름표는 각 도움말에서 확인했다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | 경로 규칙(`lib/routes/app-route.ts`)을 보는 곳은 `NavbarGate`·`FooterGate` 둘이다. `CenteredCard` 는 동의 흐름 카드와 초대 화면만 쓴다. `AgentAccessNotice`·`AgentAccessBlockedNotice` 는 동의 화면과 「내 MCP 연결」 토큰 폼이 같이 쓰므로 크기는 `className` 으로 동의 화면에서만 키운다. 바뀌는 문구를 기대하는 시험은 컴포넌트 시험 넷(`settings-dialog`·`workspace-agent-access-settings`·`agent-connections-settings`·`agent-oauth-consent`)과 e2e 셋(`agent-connections`·`workspace-agent-access`·`agent-oauth/consent-flow`)이다. `/oauth`·`/invite` 를 지나는 e2e 는 OAuth e2e 하나다 |
| 되돌리기 | 복구 비용은 얼마인가 | 저장되는 데이터가 없다. `main` 커밋 하나를 revert 하면 된다 |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 열린 질문은 없다. 시안·이름·바꿀 범위·크기는 사용자가 로컬 화면으로 확인했다(docs#203) |

## 무엇을 건드리나

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `lib/routes/app-route.ts` | 크롬 없음 · 랜딩 크롬 두 규칙 | `isFocusChromeRoute`(`/invite`, `/oauth/*`) 추가 |
| `components/NavbarGate.tsx`·`components/FooterGate.tsx` | 그 밖 경로는 옛 `Navbar`·`Footer` | 위 경로에 `FocusTopBar`·`FocusFooter` |
| `components/layout/focus-chrome.tsx`(새) | — | 로고 + 로그인 시 「로그아웃」 머리글, 약관 링크 발 |
| `app/oauth/layout.tsx`·`components/workspace/invite-landing.tsx` | 떠 있는 Navbar 아래에서 화면 전체 높이로 가운데 | 머리글·발 사이를 채워 가운데. 초대 카드 글자·버튼 한 단계 크게 |
| `components/layout/centered-card.tsx` | 폭 420, 아이콘 원 40 | 폭 480, 여백·아이콘 원 48 |
| `components/agent-connections/agent-oauth-cards.tsx`·`agent-oauth-consent.tsx` | 로봇 아이콘, 작은 글자·버튼, 「이 에이전트가」 | HeyMoa 로고(`HEYMOA_MARK`), 한 단계 큰 글자·선택칸·버튼, 「이 앱이」, 한글 낱말 단위 줄바꿈 |
| `components/agent-connections/agent-access-notice.tsx`·`agent-access-blocked.tsx` | 글자 크기 고정(12px), 「에이전트」·「외부 에이전트」 | 크기를 바깥에서 받음(`className`), 「앱」·「MCP」 문구 |
| `components/settings/settings-dialog.tsx` | 두 메뉴 모두 「외부 에이전트」 | 「MCP 관리」·「내 MCP 연결」 |
| `components/settings/workspace-agent-access-settings.tsx` | 제목·설명·스위치 「외부 에이전트」 | 「MCP 관리」, 쉬운 설명 두 문장, 「MCP 연결 허용」 등 |
| `components/settings/agent-connections-settings.tsx` | 제목 「외부 에이전트」, 설명 「Claude Code·Codex CLI…」, 끊긴 사유 | 「내 MCP 연결」, 「Claude·ChatGPT 같은 AI 앱…」, 「MCP 연결을 막아 끊겼습니다」 |
| `components/heymoa/landing/safety.tsx` | 설정 화면 그림의 제목·설명이 옛 이름 | 「내 MCP 연결」 화면과 같게 |
| 시험 | 옛 이름·문구 | 새 이름·문구. `focus-chrome.test.tsx`(새), `app-route.test.tsx` 에 `isFocusChromeRoute` |

## 순서

로컬 확인용 워크트리 `.worktrees/focus-chrome`(브랜치 `local/focus-chrome-ai-app-names`, `dev` `1e754b7` 기준, 커밋 없음)에 변경이 다 있다. 이것을 APP 브랜치로 옮긴다. `1e754b7..0377487` 사이 `dev` 변경과 겹치는 파일은 없다(확인함).

### 1. 동의·초대 화면 틀

- 바꾸는 것: 경로 규칙, 두 게이트, `focus-chrome.tsx`, `app/oauth/layout.tsx`, `invite-landing.tsx` 높이
- 시험: 경로 규칙(`/invite`·`/oauth/consent`·`/oauth/authorize` 참, `/`·`/terms`·`/oauth`·`/invitations`·`/w/…` 거짓), 머리글(로그인 → 로고·로그아웃, 메뉴·링크 없음 / 로그인 전 → 버튼 없음), 발(약관·개인정보 두 링크)
- 검증: `pnpm test:run -- components/layout && pnpm typecheck`

### 2. 동의 카드와 초대 카드 크기·로고

- 바꾸는 것: `centered-card.tsx`, `agent-oauth-cards.tsx`, `agent-oauth-consent.tsx`, 두 안내 상자, `invite-landing.tsx` 글자
- 검증: `pnpm test:run -- agent-connections app/oauth && pnpm typecheck`

### 3. 설정 이름과 문구

- 바꾸는 것: `settings-dialog.tsx`, 두 설정 화면, 안내 상자 문구, `safety.tsx` 그림, 컴포넌트 시험·e2e 의 이름·문구
- 검증: `pnpm test:run && pnpm typecheck`

커밋은 단계마다 하나씩 `[APP-1040] …` 로 남긴다(APP → PRO 에서 squash 된다).

## 마지막 관문

세 단계를 커밋한 뒤 `pnpm test:run && pnpm verify`, `pnpm test:e2e`, OAuth e2e(`-c playwright.oauth.config.ts`)를 한 번 통째로 돌린다(프리뷰 서버는 먼저 끈다). web 은 PR·CI 가 없어 **이것이 유일한 관문**이다. 그다음 codex 리뷰(`codex exec review --base pro-54/외부-에이전트-연결`)를 지나 APP → PRO squash, PRO → `dev` rebase, `dev` → `main` 순서로 넣고, push 는 단계마다 사용자 확인 뒤에 한다. 운영 반영 뒤 `/oauth/consent` 응답과 Vercel Production 상태를 확인한다.

## 안 하는 것

- 「내 MCP 연결」 화면 안쪽의 「에이전트」 문구 — spec 「범위 밖」
- `/mock-oauth`·`/settings/integrations` 의 머리글 — spec 「범위 밖」
- 설정 창 토큰 폼의 안내 상자 크기 — spec 「범위 밖」
