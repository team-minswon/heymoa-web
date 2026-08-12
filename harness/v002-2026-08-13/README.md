# harness v002 (2026-08-13)

에이전트가 이 레포에서 일할 때 읽는 것들입니다. 왜 이렇게 나눴는지는 여기 안 적습니다.
rule [`docs-layout`](rules/docs-layout.md)이 하네스 안에 설계 문서를 두는 것을 금지합니다.

## 매 세션 읽히는 rule

`.claude/rules/`는 CLAUDE.md와 같은 우선순위로 전부 로드됩니다. 매번 컨텍스트를 먹으니 짧게
쓰고, 절차는 skill로 내립니다. 기준은 **skill을 안 열어도 걸려야 하는가**입니다.

| rule | 무엇 |
|---|---|
| [`architecture`](rules/architecture.md) | 서버/클라이언트 경계, 의존 방향, 상태의 자리, 실시간 네 계층, URL, Next 16, hydration |
| [`error-loading`](rules/error-loading.md) | 실패를 토스트로 낼지 화면에 그릴지, skeleton과 spinner를 가르는 기준, `DataBoundary` |
| [`api-data`](rules/api-data.md) | 생성 훅으로 호출하기, 생성됐어도 못 쓰는 훅 셋, 계약 미러, MSW 목 |
| [`docs-layout`](rules/docs-layout.md) | plan을 어디에 어떤 이름으로 쓰나, spec은 왜 여기 없나 |
| [`issue-tracking`](rules/issue-tracking.md) | Linear 상태 전이, 워크트리 착수, 댓글을 다는 다섯 순간 |

## 부를 때 읽히는 skill

| skill | 언제 |
|---|---|
| [`merging`](skills/merging/SKILL.md) | 브랜치를 `dev`에 넣을 때. PR이 없어서 이 절차가 곧 게이트입니다 |
| [`code-review`](skills/code-review/SKILL.md) | 리뷰할 때. codex와 리뷰 subagent가 같이 씁니다. 리뷰 방법의 원본이고 루트 `AGENTS.md`는 여기로 보내기만 합니다 |

## 말 대신 막는 hook

| hook | 언제 | 무엇을 |
|---|---|---|
| [`block-forbidden-writes`](hooks/block-forbidden-writes.sh) | `PreToolUse(Write\|Edit)` | `middleware.ts` 생성, `lib/api/generated/**` 편집, `openapi3.yml` 손편집 |

셋 다 경로로 판정되고 어기면 명백히 틀립니다. 경로는 문자열로 자르지 않고 레포 루트 기준으로
정규화해서 비교합니다. `./openapi3.yml`이나 `app/../middleware.ts`로 우회되던 것이 실제
결함이었습니다. 자체 검사가 옆에 있습니다.

```bash
./harness/v002-2026-08-13/hooks/block-forbidden-writes.test.sh
```

탈출구는 열려 있습니다. hook은 `Write`와 `Edit`만 봅니다. `pnpm orval` 재생성이나 미러
재복사는 Bash라 지나갑니다. 막히는 것은 손으로 고치는 경우뿐입니다.

**codex는 이 hook에 안 걸립니다.** codex도 `PreToolUse`를 지원하지만 설정을 읽는 자리가
사용자 전역(`~/.codex/hooks.json`)이고, 레포가 들려 보낼 수 있는 프로젝트 hook 설정은
실측에서 동작하지 않았습니다. 그래서 codex 쪽 강제는 rule 문구와 리뷰 게이트가 맡습니다.
없는 대칭을 지어내지 않습니다.

## 여기 두지 않은 것

| 무엇 | 어디로 | 왜 |
|---|---|---|
| Styling | [`DESIGN.md`](../../DESIGN.md) | 값의 원본은 `app/globals.css`이고 `lib/design-tokens.test.ts`가 지킵니다. rule에 복사하면 갈라지고, 매 세션 로드되는 목록은 천장이 됩니다 |
| Authentication | [`CLAUDE.md`](../../CLAUDE.md)의 경로 표 | 네 줄 모두 "이렇게 동작한다"이지 "이렇게 하라"가 없습니다. 어겼는지 판정할 대상이 없으면 규칙이 아니라 코드 지도입니다 |

## 심링크

codex는 레포의 `.agents/skills/`를 프로젝트 skill로 자동 탐색합니다. 네 자리가 같은 폴더를
보게 해서 사본을 하나로 둡니다. 버전을 올릴 때 이 네 줄을 다시 걸고 `.claude/settings.json`의
hook 경로도 함께 고칩니다.

```bash
ln -sfn ../harness/v002-2026-08-13/rules  .claude/rules
ln -sfn ../harness/v002-2026-08-13/skills .claude/skills
ln -sfn ../harness/v002-2026-08-13/skills .codex/skills
ln -sfn ../harness/v002-2026-08-13/skills .agents/skills
```

## 다음 버전으로 올리는 시점

마일스톤마다, 그리고 rule이 실제로 안 걸리는 자리가 드러났을 때입니다. 오타나 문구 수정은
이 폴더 안에서 그대로 고칩니다. 지난 버전은 그날 상태로 얼려 둡니다.
