# harness v001 (2026-07-26)

heymoa-web의 첫 하네스입니다. rule 5개, skill 2개, hook 1개입니다.

`AGENTS.md` 145줄 한 파일을 성격에 따라 나눈 것이고, **새 규칙을 지어낸 것이 아닙니다.**
형식은 heymoa-ai의 `harness/vNNN/` + 심링크를 따랐고 내용은 web이 이미 가진 것입니다.
설계는 [`docs/superpowers/specs/2026-07-26-app-200-agent-harness-restructure-design.md`](../../docs/superpowers/specs/2026-07-26-app-200-agent-harness-restructure-design.md)에 있습니다.

## 매 세션 읽히는 rule

`.claude/rules/`는 CLAUDE.md와 같은 우선순위로 전부 로드됩니다. 매번 컨텍스트를 먹으니 짧게
쓰고, 자세한 절차는 skill로 내립니다. **skill을 안 열어도 걸려야 하는가**가 기준입니다.

| rule | 무엇 |
|---|---|
| [`architecture`](rules/architecture.md) | 서버/클라이언트 경계, 상태의 자리, Next.js 16, hydration, 제품 내부 노출 금지 |
| [`error-loading`](rules/error-loading.md) | 실패를 토스트로 낼지 화면에 그릴지. `DataBoundary`와 전역 토스트 opt-out |
| [`api-data`](rules/api-data.md) | 생성 훅으로 호출하기, 계약 미러, MSW 목 |
| [`docs-layout`](rules/docs-layout.md) | 설계·계획·리뷰 기록을 어디에 쓰나 |
| [`issue-tracking`](rules/issue-tracking.md) | Linear 상태 전이, 워크트리 착수, 댓글을 다는 다섯 순간 |

## 부를 때 읽히는 skill

| skill | 언제 | 상태 |
|---|---|---|
| [`merging`](skills/merging/SKILL.md) | 브랜치를 `dev`에 넣을 때. PR이 없어서 이 절차가 곧 게이트입니다 | 기존 절차를 옮긴 것 |
| [`code-review`](skills/code-review/SKILL.md) | 리뷰할 때. codex와 리뷰 subagent가 같이 씁니다 | 신규 |

`code-review`의 되풀이된 결함 목록은 `docs/codex-review-app-*.md` 10건에서 **실제로 다시
나타난 것**만 뽑았습니다. 겪어보지 않고 쓴 항목은 없습니다.

## 말 대신 막는 hook

| hook | 언제 | 무엇을 |
|---|---|---|
| [`block-forbidden-writes`](hooks/block-forbidden-writes.sh) | `PreToolUse(Write\|Edit)` | `middleware.ts` 생성, `lib/api/generated/**` 편집, `openapi3.yml` 손편집 |

셋 다 경로로 판정되고 어기면 명백히 틀립니다. 원래 산문으로만 금지돼 있었습니다.

경로는 문자열로 자르지 않고 레포 루트 기준으로 **정규화해서** 비교합니다 —
`./openapi3.yml`이나 `app/../middleware.ts`로 우회되던 것이 실제 결함이었습니다
(codex 리뷰 2·3회차). 자체 검사가 옆에 있습니다.

```bash
./harness/v001-2026-07-26/hooks/block-forbidden-writes.test.sh
```

**탈출구는 열려 있습니다** — hook은 `Write`·`Edit`만 봅니다. `pnpm orval` 재생성이나 미러
재복사(Bash)는 지나갑니다. 막히는 것은 손으로 고치는 경우뿐입니다.

**codex는 이 hook에 안 걸립니다.** codex도 `PreToolUse`를 지원하지만 설정을 읽는 자리가
`~/.codex/hooks.json`(사용자 전역)이고, 레포가 들려 보낼 수 있는 프로젝트 hook 설정은
실측에서 동작하지 않았습니다(`.agents/hooks.json`에 hook을 두고 `codex exec`를 돌려도
발화 기록이 안 남았습니다). 그래서 codex 쪽 강제는 rule 문구와 리뷰 게이트가 맡습니다.
없는 대칭을 지어내지 않습니다 — 방법이 생기면 그때 겁니다.

heymoa-ai의 hook은 워커 worktree인지로 대상을 가리지만, web에는 무인 워커 루프가 없고 이 셋은
사람도 손편집하면 안 되므로 항상 걸립니다. 그래서 두 레포의 hook 수가 다릅니다 — 대칭을
만들려고 없는 hook을 지어내지 않습니다.

## 여기 두지 않은 것

| 무엇 | 어디로 | 왜 |
|---|---|---|
| Styling | [`DESIGN.md`](../../DESIGN.md) | 값의 원본은 `app/globals.css`이고 `lib/design-tokens.test.ts`가 지킵니다. rule에 복사하면 갈라지고, 매 세션 로드되는 목록은 천장이 됩니다 |
| Authentication | [`docs/frontend-architecture.md`](../../docs/frontend-architecture.md) | 네 줄 모두 "이렇게 동작한다"이지 "이렇게 하라"가 없습니다. 어겼는지 판정할 대상이 없으면 규칙이 아닙니다 |
| `agents/` · `findings-ledger.md` | 안 만듭니다 | 고를 orchestrator가 없고, 처음이라 쌓인 결함이 없습니다 |

## 옮기면서 고친 낡은 사실

**이 작업의 가장 큰 위험은 배치가 아니라 낡은 사실의 승격입니다.** 산문일 때는 참고 문서지만
rule이 되는 순간 매 세션 로드되는 권위를 갖습니다. 실측으로 여덟 건이 어긋나 있었습니다.

| # | `AGENTS.md`가 말하던 것 | 실제 | 조치 |
|---|---|---|---|
| 1 | 미러 원본이 `docs/contracts/openapi3-server.yml` | docs repo가 재편돼 루트 `contracts/`가 `origin/main`에 없습니다 (`develop/MVP1/contracts/`로 이동) | 깊은 경로를 박지 않고 docs repo `INDEX.md`를 진입점으로 가리킵니다. `openapi3.yml` 헤더 주석도 같이 고쳤습니다 |
| 2 | `fetch()` 예외는 `lib/api/fetcher.ts`·`lib/api/sse.ts` 둘뿐 | `lib/auth/api.ts`·`lib/auth/server.ts`·`proxy.ts`·`components/mocks/mock-oauth-consent.tsx`도 직접 부릅니다 | 파일 목록 대신 **왜 예외인가** 세 줄로 넓혔습니다. 판정선은 "제품 컴포넌트가 API 경로를 직접 `fetch()`하면 위반" |
| 3 | faker 사용 금지 | `lib/mocks/db.ts`와 `lib/mocks/chat-stream.ts`가 시드를 고정해 정당하게 씁니다 | 금지 대상을 "orval이 생성하는 기본 목 응답(무작위 `success:false`)"으로 좁혔습니다 |
| 4 | `--clay-*`는 legacy alias — 쓰지 말 것 | 코드 어디에도 `clay`가 없습니다 (`AGENTS.md`와 죽은 `.agents/` skill에만 남아 있었습니다) | 지웠습니다. 없는 것을 금지하는 규칙은 소음입니다 |
| 4b | `.agents/skills/` skill 5개 | **codex가 실제로 읽습니다** (아래 실측). 내용은 이미 갈려 있었습니다 — `design-sync`가 존재하지 않는 `--clay-*`를 설명합니다 | 파일 5개는 지우고 `.agents/skills`를 하네스로 심링크했습니다. codex는 계속 프로젝트 skill을 찾고, 사본은 하나만 남습니다 |
| 5 | `codex exec review --base dev --title "..."` | codex-cli 0.145.0에 `--title` 옵션이 없습니다 | `codex exec review --base dev`로 고쳤습니다. 프롬프트는 위치 인자입니다 |
| 6 | proxy 변경 후 **항상** `rm -rf .next` | 왜 필요한지가 어디에도 안 적혀 있습니다 | "옛 동작이 보이면 `pnpm dev:clean`"으로 완화했습니다. 이미 있는 스크립트입니다 |
| 7 | MSW REST/WebSocket 두 파일 | `lib/mocks/sse-handler.ts`도 있습니다 | 셋 다 적었습니다 |
| 8 | 계약이 바뀌면 `lib/mocks/handlers.ts`를 고친다 | `handlers.ts`는 레지스트리라 응답이 거기 없습니다. 그대로 따르면 목이 계약과 갈립니다 | 응답을 정의하는 핸들러 파일을 고치라고 바꿨습니다. `handlers.ts`는 경로가 새로 생겼을 때만 |

검증한 것: `proxy.ts`만 있고 `middleware.ts`는 없습니다. `MutationCache.onError`가 실재합니다.
`DESIGN.md`·`docs/frontend-architecture.md`·`docs/generated-api-map.md`·`lib/design-tokens.test.ts`가
살아 있습니다. `openapi3.yml`에서 `/internal` 3경로가 제거돼 있습니다. SSE 생성 훅 이름
`sendAgentChatMessage`·`sendNoteSharedChatMessage`가 실재합니다. `MOCK_USER`의 단일 출처는
`lib/mocks/mock-user.ts`입니다.

## 심링크 연결

| 종류 | 연결 |
|---|---|
| rule | `.claude/rules` → `harness/v001-2026-07-26/rules` |
| skill | `.claude/skills` → `harness/v001-2026-07-26/skills` |
| skill (codex) | `.codex/skills` → 같은 폴더. 리뷰어도 같은 문서를 읽습니다 |
| skill (codex 프로젝트 자동탐색) | `.agents/skills` → 같은 폴더 |
| hook | `.claude/settings.json`이 `${CLAUDE_PROJECT_DIR}/harness/v001-2026-07-26/hooks/...`를 직접 가리킵니다 |

**심링크가 넷인 이유.** codex 0.145.0은 레포의 `.agents/skills/`를 프로젝트 skill로 자동
탐색합니다 — 실측했습니다(`.agents/skills/`에 마커를 넣은 probe 레포에서 `codex exec`가
파일을 안 읽고 마커를 답했습니다). 원래 그 자리에 아무도 관리하지 않는 skill 5개가 있었고,
지우기만 하면 codex가 프로젝트 skill을 잃습니다. 세 자리가 같은 폴더를 보게 해서 사본을
하나로 만들었습니다.

버전을 바꾸려면 심링크 네 줄을 다시 걸고 `settings.json`의 hook 경로를 함께 고칩니다.

```bash
ln -sfn ../harness/v001-2026-07-26/rules  .claude/rules
ln -sfn ../harness/v001-2026-07-26/skills .claude/skills
ln -sfn ../harness/v001-2026-07-26/skills .codex/skills
ln -sfn ../harness/v001-2026-07-26/skills .agents/skills
```

git이 심링크를 mode `120000`으로 추적합니다.

## 다음 버전으로 올리는 시점

마일스톤마다 올립니다. 오타나 문구 수정은 이 폴더 안에서 그대로 고칩니다 — git이 이미
추적합니다. 다음 후보는 rule이 실제로 안 걸리는 자리가 드러날 때, 또는 hook으로 올릴 금지가
하나 더 생길 때입니다.
