# 에이전트 하네스 재구성 — heymoa-web · heymoa-server

> 대상 레포 둘. web이 형태를 먼저 정하고 server가 따른다.
> server 작업도 이 문서를 기준으로 한다 (server repo에 사본을 두지 않는다).

## 1. 배경

web과 server는 에이전트 지식을 `AGENTS.md` 한 파일에만 담아왔다. web은 145줄, server는 114줄이고, 그 안에 성격이 다른 셋이 섞여 있다.

- 항상 걸려야 하는 컨벤션 (아키텍처·데이터·명명)
- 특정 작업에서만 필요한 절차 (머지·PR·검증)
- 코드 리뷰를 어떻게 할 것인가

셋이 한 파일에 있으면 매 세션 전부 로드되고, 절차는 "읽으면 좋은 문서"로 남아 실제로 밟히지 않는다. 말로만 금지된 것(`middleware.ts` 생성, 생성 파일 편집)은 강제되지 않는다.

heymoa-ai는 같은 문제를 `harness/vNNN/` + 심링크 구조로 이미 풀었다. 그 **형식**을 web·server에 적용한다. ai의 내용을 복사하지 않는다 — 두 레포가 이미 가진 내용을 재배치하는 작업이다.

## 2. 목표와 비목표

**목표**

- `AGENTS.md`의 내용을 성격에 따라 CLAUDE.md · rules · skills · AGENTS.md로 나눈다
- 말로만 금지된 것 중 경로로 판정 가능한 것을 hook으로 막는다
- 하네스를 버전 디렉토리로 관리하고 `.claude`·`.codex`가 심링크로 가리키게 한다
- 옮기기 전에 각 규칙이 현재 코드와 맞는지 검증한다

**비목표**

- ai의 skill·rule·agent를 이식하는 것
- 무인 워커 루프, orchestrator, agent 로스터 (web·server에는 아직 없다)
- 코드 변경 (문서와 설정만 바꾼다)
- `docs/superpowers/specs|plans/` 경로 변경 (50개 넘게 쌓여 있어 옮기면 마이그레이션만 생긴다)

## 3. 배치 판정 기준

| 자리 | 기준 | 판정 |
|---|---|---|
| `CLAUDE.md` | 정체성·명령어·문서 지도. 항상 필요하고 짧은 것 | — |
| `rules/` | **skill을 안 열어도 걸려야 하는가.** 매 세션 로드되니 짧게 | 어겼는지 판정 가능해야 한다 |
| `skills/` | 부를 때만 필요한 절차 | — |
| `AGENTS.md` | codex가 리뷰할 때 읽는 것 | — |
| `hooks/` | 말로 해봐야 안 지켜지는 것. 경로로 판정 가능할 때만 | — |

두 가지 잣대를 함께 쓴다.

**어겼는지 판정할 수 있는가.** 판정할 수 없으면 규칙이 아니라 설명이다. 설명은 문서로 보내고 링크한다.

**값을 복사하고 있지 않은가.** 토큰 값·파일 목록·경로처럼 다른 곳이 원본인 것을 rule에 적으면 원본과 갈라진다. 기준만 적고 원본을 링크한다.

## 4. heymoa-web 배치

| 현재 AGENTS.md 섹션 | 옮길 자리 |
|---|---|
| `This is NOT the Next.js you know` 배너 | CLAUDE.md |
| Project Identity | CLAUDE.md |
| File Conventions | CLAUDE.md (문서 지도) |
| Verification Checklist | CLAUDE.md (명령어 + 각 명령이 왜 필요한지 한 줄) |
| Architecture + Next.js 16 + Hydration + 제품 내부 노출 금지 | rule `architecture.md` |
| 오류·로딩 표시 경계 (축소) | rule `error-loading.md` |
| API & Data + MSW Mocking | rule `api-data.md` |
| Git Workflow | skill `merging` |
| Styling | **`DESIGN.md`로 보낸다** |
| Authentication | **`docs/frontend-architecture.md`로 보낸다** |
| (없음 — 신설) | rule `docs-layout.md` · `issue-tracking.md`, skill `code-review`, `AGENTS.md` 리뷰 전용 신설 |

### Styling을 rule로 두지 않는 이유

값 목록(형태 스케일·타이포 스케일)의 원본은 `app/globals.css`의 `@theme inline`이고 `lib/design-tokens.test.ts`가 존재를 지킨다. rule에 복사하면 토큰이 바뀔 때마다 두 곳을 고쳐야 한다.

더 큰 문제는 매 세션 로드되는 목록이 **천장이 된다**는 것이다. "이 안에서 고르면 된다"로 읽혀 `DESIGN.md`와 실제 앱 실측을 건너뛰게 만든다. 디자인 판단의 원본은 `DESIGN.md`이고, 위반 감지는 `design-tokens.test.ts`와 codex 리뷰가 맡는다.

단 Styling 안에 섞여 있던 한 줄은 성격이 다르므로 건진다 — **제품 UI에 폴링·DB 라벨·세그먼트 수·세션 ID·환경 설정을 노출하지 않는다.** 이것은 디자인이 아니라 제품 정보 노출 규칙이라 `architecture.md`에 남긴다.

### Authentication을 rule로 두지 않는 이유

네 줄 모두 "이렇게 동작한다"이지 "이렇게 하라"가 없다. 어겼는지 판정할 대상이 없으므로 규칙이 아니다. mock user 값은 코드가 원본이라 바뀌면 즉시 갈라진다.

### 오류·로딩 경계에서 덜어낼 것

원칙 자체는 실제로 밟은 지뢰라 유지하되(APP-191의 DataBoundary·suspense 전환이 산출물), 두 부분을 덜어낸다.

- **suspense 예외 파일 목록 4개** — 새 컴포넌트를 만들 때 화이트리스트처럼 읽혀 "목록에 없으니 suspense를 써야 하나"가 된다. 기준 한 줄만 남기고 예시는 하나로 줄인다
- **opt-out 코드 블록 2개** — 한 줄 표기와 사유 두 가지로 압축한다

32줄에서 15줄 안팎이 된다.

## 5. heymoa-server 배치

| 현재 AGENTS.md 섹션 | 옮길 자리 |
|---|---|
| (없음 — CLAUDE.md 자체가 없다) | **CLAUDE.md 신설** — 정체성·핵심 규칙·명령어·문서 지도·커밋 형식 |
| 1. 아키텍처 (1)(2)(3)(6) | rule `architecture.md` |
| 1. 아키텍처 (4)(5) — API 계약·TSID | rule `api-contract.md` |
| 2. 테스트 (1)(4) — 스택·명명·우선순위 | rule `testing.md` |
| 2. 테스트 (2)(3) — RESTDocs·AsyncAPI 문서화 | **중첩 AGENTS.md 링크 한 줄로** (아래) |
| 3. Git/PR 규칙 | 커밋 형식·spotless는 CLAUDE.md, PR 절차·docs 미러는 skill `pr-flow` |
| 4. 코드 리뷰 지침 | `AGENTS.md`에 남기고 확장 |
| (없음 — 신설) | rule `docs-layout.md` · `issue-tracking.md`, skill `code-review` |

### 중첩 AGENTS.md 둘은 건드리지 않는다

`src/test/kotlin/com/heymoa/support/docs/AGENTS.md`와 그 아래 `asyncapi/AGENTS.md`는 이미 그 디렉토리에서 일할 때 읽히는 자리에 있다. 별도 skill로 올리면 "저것을 읽어라"만 하는 얇은 래퍼가 되어 같은 사실이 두 곳에 생긴다. rule `api-contract.md`에 링크 한 줄만 둔다.

(`bin/` 아래 사본은 gitignore된 빌드 산출물이고 내용도 동일하다. 조치하지 않는다.)

## 6. hook

`PreToolUse(Write|Edit)`로 걸리고 stdin에 `tool_input` JSON이 들어온다. 종료 코드 2가 차단이고 stderr가 이유로 전달된다.

### web — 스크립트 하나에 경로 규칙 셋

| 막을 것 | 지금 상태 |
|---|---|
| `middleware.ts` 생성 | 산문 금지 |
| `lib/api/generated/**` 편집 | 산문 금지 |
| `openapi3.yml` 손편집 | 산문 금지 |

셋 다 경로로 판정되고, 어기면 명백히 틀린다. `harness/v001-2026-07-26/hooks/block-forbidden-writes.sh` 하나에 담는다.

탈출구는 자연스럽게 열려 있다. hook은 `Write`와 `Edit`만 보므로 `pnpm orval` 재생성이나 미러 재복사(Bash)는 지나간다. 막히는 것은 에이전트가 손으로 고치는 경우뿐이다.

ai의 hook은 워커 worktree인지로 대상을 가리지만, web에는 무인 워커 루프가 없고 이 세 파일은 사람도 손편집하면 안 되므로 항상 걸리게 둔다.

### server — hook 없이 시작한다

server의 금지는 대부분 코드 구조라 경로로 판정할 수 없다.

| 금지 | 맞는 도구 |
|---|---|
| Service에서 Service 직접 호출 | ArchUnit / Konsist |
| `Projections.constructor` 사용, `@DisplayName` 사용 | ktlint 커스텀 룰 |
| build 산출물 커밋 | 이미 `.gitignore`가 한다 |

내용 grep hook으로 흉내내면 약한 강제와 오탐을 둘 다 얻는다. `hooks/`를 비워두고 rule에 남긴다. 두 레포의 hook 수가 다른 것이 정상이며, 대칭을 만들려고 없는 hook을 지어내지 않는다.

## 7. 옮기기 전 사실 검증 (필수)

**이 작업의 가장 큰 위험은 배치가 아니라 낡은 사실의 승격이다.** 산문일 때는 참고 문서지만 rule이 되는 순간 매 세션 로드되는 권위를 갖는다. 아래 셋은 실측에서 이미 어긋난 것이 확인됐다.

| # | 규칙이 말하는 것 | 실제 | 조치 |
|---|---|---|---|
| 1 | 미러 원본이 `docs/contracts/openapi3-server.yml` | docs repo가 2026-07-26에 재편됐고 루트 `contracts/`는 origin/main에 없다. 계약은 `develop/MVP1/contracts/`로 내려갔다 | **깊은 경로를 rule에 박지 않는다.** docs repo의 `INDEX.md`를 진입점으로 가리킨다 |
| 2 | `fetch()` 예외는 `lib/api/fetcher.ts`와 `lib/api/sse.ts` 둘뿐 | `lib/auth/api.ts`가 `/v1/users/me`와 `/v1/auth/logout`을, `lib/auth/server.ts`가 SSR 갱신을 직접 호출한다 | 예외를 넓히거나 코드를 고친다. 어긋난 채로 옮기지 않는다. auth는 fetcher와 순환을 피해야 하므로 정당한 예외일 가능성이 높다 |
| 3 | faker 사용 금지 | `lib/mocks/chat-stream.ts`가 시드를 고정해 정당하게 쓴다 | 문구를 "orval이 생성하는 기본 mock 응답(무작위 `success:false`)"으로 좁힌다 |

추가로 근거가 없는 것 하나를 정리한다. "proxy 변경 후 **항상** `rm -rf .next`"는 왜 필요한지가 적혀 있지 않다. 실제로 밟은 지뢰면 어떻게 터졌는지 한 줄을 붙이고, 아니면 "안 되면 지운다"로 완화한다.

**나머지 규칙도 같은 방식으로 대조한다.** 경로·파일명·예외 목록·명령어가 현재 코드와 맞는지 확인하고, 어긋나면 규칙을 고치거나 코드를 고친다.

검증된 것: `proxy.ts`만 존재하고 `middleware.ts`는 없다. `MutationCache.onError`가 실재한다. `DESIGN.md`·`docs/frontend-architecture.md`·`docs/generated-api-map.md`·`lib/design-tokens.test.ts` 넷 다 살아 있다. `openapi3.yml`에서 `/internal` 3경로가 제거돼 있다.

## 8. 하네스 골격

```
harness/
  v001-2026-07-26/
    README.md          rule·skill 표, 심링크 방법, 다음 버전으로 올리는 시점
    rules/
    skills/
    hooks/             web만
.claude/
  settings.json        web만 (hook 경로 때문에)
  rules  -> ../harness/v001-2026-07-26/rules
  skills -> ../harness/v001-2026-07-26/skills
.codex/
  skills -> ../harness/v001-2026-07-26/skills
CLAUDE.md
AGENTS.md
```

`agents/`와 `findings-ledger.md`는 만들지 않는다. 고를 orchestrator가 없고, 처음이라 쌓인 결함이 없다.

버전 전환은 심링크 세 줄이고, web은 `settings.json`의 hook 경로를 함께 고친다.

```bash
ln -sfn ../harness/v001-2026-07-26/rules  .claude/rules
ln -sfn ../harness/v001-2026-07-26/skills .claude/skills
ln -sfn ../harness/v001-2026-07-26/skills .codex/skills
```

git이 심링크를 mode `120000`으로 추적한다. 버전은 마일스톤마다 올리고, 오타나 문구 수정은 그 폴더 안에서 그대로 고친다.

## 9. 최종 구성

| | rules | skills | hooks |
|---|---|---|---|
| web | 5 — architecture · error-loading · api-data · docs-layout · issue-tracking | 2 — merging · code-review | 1 |
| server | 5 — architecture · api-contract · testing · docs-layout · issue-tracking | 2 — pr-flow · code-review | 0 |

`AGENTS.md`는 양쪽 다 리뷰 전용으로 축소한다. 리뷰 지침은 ai와 같이 2단이다.

| 자리 | 담는 것 |
|---|---|
| `AGENTS.md` | 태도와 형식 — 한국어 존댓말, mermaid로 그리기, 지적 하나에 셋(무엇이 잘못됐나·어떻게 터지나·왜 그렇게 되나), 이 레포에서 자주 걸리는 것 |
| `skills/code-review` | 판정 — 심각도와 위험도 라벨, 되풀이된 결함 렌즈, 출력 형식 |

server의 `4. 코드 리뷰 지침`은 이미 이 형태의 축약판이라 그 자리에서 확장한다. web은 리뷰 지침이 없는데 `codex exec review`가 유일한 머지 게이트이므로 신설한다.

## 10. 이슈 분할

| 이슈 | 레포 | 관계 |
|---|---|---|
| web 하네스 구축 | heymoa-web | 먼저 |
| server 하네스 구축 | heymoa-server | web에 blocked |

두 레포가 같은 형태를 갖는 것이 목적이므로 병렬로 하지 않는다. 병렬로 하면 형태가 갈린다. web이 hook까지 포함한 완전한 형태라 여기서 모양이 확정되면 server는 따라간다.

머지 경로는 각 레포의 규칙을 따른다. web은 PR 없이 로컬 squash로 `dev`에 넣고, server는 `feature/app-N-...` 브랜치에서 PR을 올린다.

## 11. 성공 기준

```bash
# 심링크가 v001을 가리킨다
readlink .claude/rules .claude/skills .codex/skills

# git이 심링크로 추적한다 (mode 120000)
git ls-files -s .claude .codex

# 기존 검증이 그대로 통과한다
# web:    pnpm test:run && pnpm lint && pnpm typecheck && pnpm build
# server: ./gradlew spotlessCheck build
```

- `AGENTS.md`에 리뷰 지침만 남고 컨벤션이 남아 있지 않다
- web hook이 실제로 막는다 — `middleware.ts` 쓰기를 시도하면 차단된다
- **내용 유실 0** — 4장·5장의 매핑표대로 기존 `AGENTS.md`의 모든 섹션이 새 자리에 있다
- **7장의 검증 항목 셋이 해소됐다** — 계약 경로, `fetch()` 예외 목록, faker 문구

## 12. 범위 밖

- `docs/superpowers/specs|plans/` 경로를 ai의 `docs/issues/APP-N-slug/` 형태로 통일하는 것. 옮기면 마이그레이션만 생기고 지금 얻는 것이 없다. 필요해질 때 별도로 결정한다
- server의 구조 규칙을 ArchUnit으로 강제하는 것. hook으로 못 하는 것을 적어만 두고, 실제 도입은 별도 이슈로 한다
- `heymoa-ai`의 하네스 변경. 이 작업은 web과 server만 건드린다
