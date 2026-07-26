---
name: merging
description: Use when a feature branch is ready to integrate — this repo has no pull requests, so the local squash-merge into dev and the codex review gate are the whole procedure
metadata:
  short-description: 브랜치를 dev에 넣고 main으로 올리는 절차
---

# 브랜치를 dev에 넣는 절차

**이 레포에는 GitHub 이슈도 PR도 없습니다.** 이슈/PR 템플릿과 CI 워크플로가 없습니다.
그래서 머지 게이트가 GitHub이 아니라 여기 적힌 로컬 절차입니다. 밟지 않으면 아무도 안 막습니다.

## 브랜치

| 브랜치 | 무엇 |
|---|---|
| `main` | 안정 |
| `dev` | 통합 |
| `feature/*` | `dev`에서 따서 `dev`로 돌아갑니다 |

커밋과 브랜치 제목은 `[APP-N] 제목` 형식입니다. `feat(app-N):`·`feat:` 같은 conventional
prefix는 쓰지 않습니다. 이슈 없는 잡일만 `chore:`·`docs:` bare를 허용합니다.

## 순서

### 1. 검증을 통과시킵니다

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

각 명령이 왜 필요한지는 [`CLAUDE.md`](../../../../CLAUDE.md)에 있습니다. 하나라도 실패하면
여기서 멈춥니다.

### 2. codex 리뷰를 받습니다

```bash
codex exec review --base dev
```

**이것이 이 레포의 유일한 코드 리뷰 게이트입니다.** GitHub 원격 `@codex` 봇 리뷰는
요청하지도 반영하지도 않습니다. 무엇을 어떤 라벨로 적는지는 skill
[`code-review`](../code-review/SKILL.md)가 정합니다.

`--base`와 함께 프롬프트를 위치 인자로 넘길 수 있습니다. `--title` 옵션은 없습니다
(codex-cli 0.145.0 실측).

P1·P2를 고치고 다시 돌립니다. 회차 기록이 필요하면 `docs/codex-review-app-N.md`에 남깁니다.

### 3. dev에 squash 머지합니다

```bash
git checkout dev && git merge --squash feature/app-N-slug
git commit -m "[APP-N] 제목"
git push
```

PR을 올리지 않습니다. 머지된 직후 Linear 이슈를 Done으로 옮기고 완료 댓글을 답니다
(rule [`issue-tracking`](../../rules/issue-tracking.md) ⑤).

### 4. main으로 올릴 때

```bash
git checkout main && git merge --ff-only dev
git push
```

**rebase 머지(fast-forward)입니다. squash가 아닙니다** — `dev`의 커밋을 보존합니다.
fast-forward가 안 되면 `dev`가 뒤처진 것이니 `main`을 먼저 `dev`에 반영합니다.

## 자주 틀리는 것

- `dev`로 squash, `main`으로 ff. 반대로 하면 `main`에 커밋이 뭉개지거나 `dev`에 잡음이 쌓입니다.
- 검증을 건너뛰고 리뷰부터 돌리기. codex가 타입 에러를 지적하는 데 시간을 씁니다.
- `pnpm build`만 돌리고 넘어가기. `.test.tsx`는 build가 안 봅니다 — `pnpm typecheck`가 따로 필요합니다.
