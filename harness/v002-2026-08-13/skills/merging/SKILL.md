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

P1·P2를 고치고 다시 돌립니다. **레포에 리뷰 기록 파일을 만들지 않습니다** — 회차는 이슈 댓글 ④로 남깁니다.

### 3. dev에 squash 머지합니다

**메인 워크트리에서 합니다.** 워크트리(`.worktrees/app-N`) 안에서 `git checkout dev`를 하면
git이 거부합니다 — `dev`는 이미 메인 트리가 잡고 있고 같은 브랜치를 두 곳에 체크아웃할 수
없습니다. 1·2단계까지가 워크트리 몫이고 여기서부터는 레포 루트입니다.

```bash
cd <레포 루트>
git checkout dev && git pull --ff-only
git merge --squash feature/app-N-slug
git commit -m "[APP-N] 제목"
```

`pull --ff-only`를 빼지 않습니다. 브랜치를 딴 뒤 `dev`가 움직였으면 push가 non-fast-forward로
거절되고, 그때는 이미 squash 커밋을 만든 뒤라 되돌리기가 번거롭습니다.

**아직 push하지 않습니다.** `pull`이 실제로 커밋을 가져왔으면 **1·2단계를 여기서 다시
돌립니다** — 검증도, codex 리뷰도 옛 `dev`를 기준으로 통과한 것이라 그 사이 들어온 변경과의
조합은 아무도 안 봤습니다. 충돌 없이 squash되는 것과 합쳐서 도는 것은 다릅니다.

리뷰는 **`--base dev`가 아니라 `--commit HEAD`**입니다. 지금은 `dev`에 서 있어서 `--base dev`가
자기 자신을 비교해 빈 diff를 리뷰합니다.

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
codex exec review --commit HEAD
git push
```

PR을 올리지 않습니다. 머지된 직후 Linear 이슈를 Done으로 옮기고 완료 댓글을 답니다
(rule [`issue-tracking`](../../rules/issue-tracking.md) ⑤).

### 4. main으로 올릴 때

```bash
git checkout main && git merge --ff-only dev
git push
git checkout dev          # 메인 트리는 dev로 되돌려 둡니다
```

**rebase 머지(fast-forward)입니다. squash가 아닙니다** — `dev`의 커밋을 보존합니다.
fast-forward가 안 되면 `dev`가 뒤처진 것이니 `main`을 먼저 `dev`에 반영합니다.

### 5. 워크트리를 지웁니다

**`main` 승격까지 끝난 뒤입니다.** `dev` 머지 직후에 지우면 승격 중 문제가 생겼을 때
검증 환경이 없습니다.

```bash
git worktree remove .worktrees/app-N
```

## 자주 틀리는 것

- `dev`로 squash, `main`으로 ff. 반대로 하면 `main`에 커밋이 뭉개지거나 `dev`에 잡음이 쌓입니다.
- 워크트리 안에서 3단계를 실행하기. `dev`가 메인 트리에 잡혀 있어 git이 거부합니다.
- 검증을 건너뛰고 리뷰부터 돌리기. codex가 타입 에러를 지적하는 데 시간을 씁니다.
- `pnpm build`만 돌리고 넘어가기. `.test.tsx`는 build가 안 봅니다 — `pnpm typecheck`가 따로 필요합니다.
