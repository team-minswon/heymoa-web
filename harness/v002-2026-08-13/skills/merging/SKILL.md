---
name: merging
description: Use when a feature branch is ready to integrate — this repo has no pull requests, so the local squash-merge into dev (or a pro-N branch) and the batched push to origin/main are the whole procedure
metadata:
  short-description: 브랜치를 dev에 넣고 main으로 올리는 절차
---

# 브랜치를 dev에 넣는 절차

**이 레포에는 GitHub 이슈도 PR도 없습니다.** 이슈/PR 템플릿과 CI 워크플로가 없습니다.
그래서 머지 게이트가 GitHub이 아니라 여기 적힌 로컬 절차입니다. 밟지 않으면 아무도 안 막습니다.

## 브랜치

| 브랜치 | 무엇 |
|---|---|
| `main` | 안정. 원격에 올리는 것은 이것뿐입니다 |
| `dev` | 통합. **로컬에만 둡니다** |
| `pro-N/슬러그` | PRO 프로젝트 하나의 이슈를 모읍니다. `dev`에서 따서 `dev`로 돌아갑니다 |
| `feature/*` | `dev`(또는 `pro-N/…`)에서 따서 거기로 돌아갑니다 |

커밋 제목은 잡일까지 **항상 `[APP-N] 제목`**입니다. `feat:`·`chore:`·`docs:` 같은 prefix는 쓰지
않습니다. PR이 없어서 커밋 제목이 이슈로 돌아가는 유일한 연결입니다.

**원격 PR을 열지 않고 `dev`를 push하지 않습니다.** push마다 Vercel 배포가 하나씩 생기고
(Hobby 일일 한도에 실제로 걸렸습니다), GitHub Actions 한도도 같이 씁니다. 여러 이슈를 로컬
`dev`에 모았다가 4단계에서 `origin/main`에 한 번 올립니다.

## 순서

### 1. 검증을 통과시킵니다

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

각 명령이 왜 필요한지는 [`CLAUDE.md`](../../../../CLAUDE.md)에 있습니다. 하나라도 실패하면
여기서 멈춥니다.

`pnpm test:e2e` 전체 실행에서 깨진 spec은 그 파일만 `--workers=1`로 다시 돌립니다. 단독으로
통과하면 병렬 실행에서만 흔들리는 테스트이니 이슈 댓글 ④에 파일:줄을 남기고 넘어갑니다
(예: `meeting-review.spec.ts:147`). 단독에서도 깨지면 진짜 실패입니다.

### 2. codex 리뷰 — 사용자가 요청할 때만

기본으로 돌리지 않습니다. 오래 걸리고, 1단계 게이트와 화면 확인으로 충분하다는 것이 사용자
판단입니다. 요청받았을 때는 이렇게 돌립니다.

```bash
codex exec review --base dev
```

GitHub 원격 `@codex` 봇 리뷰는 요청하지도 반영하지도 않습니다. 무엇을 어떤 라벨로 적는지는 skill
[`code-review`](../code-review/SKILL.md)가 정합니다.

`--base`·`--commit`·`--uncommitted` 는 **프롬프트(위치 인자)와 함께 못 씁니다.** 셋 중 하나를
쓰면 리뷰 지시를 따로 못 넣습니다 — `error: the argument '--base <BRANCH>' cannot be used with
'[PROMPT]'` 로 끊깁니다. `--title` 은 **있지만** 리뷰 요약에 표시할 제목일 뿐이라 리뷰 방향을
바꾸지 않습니다 (codex-cli 0.149.1 실측).

> **버전이 올라가며 뒤집힌 자리입니다.** 0.145.0 에서는 `--base` 와 프롬프트를 함께 넘길 수
> 있었고 `--title` 이 없었습니다. 안 되면 `codex exec review --help` 로 확인하고 이 줄을
> 고칩니다.

P1·P2를 고치고 다시 돌립니다. **레포에 리뷰 기록 파일을 만들지 않습니다** — 회차는 이슈 댓글 ④로 남깁니다.

### 3. dev(또는 pro 브랜치)에 squash 머지합니다

**메인 워크트리에서 합니다.** 워크트리(`.worktrees/app-N`) 안에서 `git checkout dev`를 하면
git이 거부합니다 — `dev`는 이미 메인 트리가 잡고 있고 같은 브랜치를 두 곳에 체크아웃할 수
없습니다. 1·2단계까지가 워크트리 몫이고 여기서부터는 레포 루트입니다.

```bash
cd <레포 루트>
git checkout dev && git pull --ff-only
git merge --squash feature/app-N-slug
git commit -m "[APP-N] 제목"
```

`pull --ff-only`는 다른 곳에서 `dev`를 올린 경우를 위해 남겨 둡니다. `dev`를 push하지 않으니
대개 받을 것이 없습니다. `pull`이 실제로 커밋을 가져왔으면 **1단계를 여기서 다시 돌립니다** —
옛 `dev` 기준으로 통과한 것이라 합친 조합은 아무도 안 봤습니다. (codex 리뷰를 요청받은 작업이면
`--base dev`가 아니라 `--commit HEAD`로 다시 돌립니다. `dev`에 서 있어서 `--base dev`는 빈 diff입니다.)

**push하지 않습니다.** 머지된 직후 Linear 이슈를 Done으로 옮기고 완료 댓글을 답니다
(rule [`issue-tracking`](../../rules/issue-tracking.md) ⑤). 아직 운영에 안 나갔다는 것을 댓글에 적습니다.

**PRO 묶음이면** 위 `dev` 자리에 `pro-N/슬러그`를 넣어 squash합니다. 프로젝트가 끝나면 pro 브랜치를
최신 `dev`에 rebase하고 `dev`로 merge commit(또는 ff)합니다. **pro 전체를 한 커밋으로 squash하지
않습니다** — `dev`에서 APP 커밋이 하나씩 보여야 합니다. pro 브랜치는 지우지 않고 둡니다.

```bash
git switch pro-N/슬러그 && git rebase dev
git switch dev && git merge --no-ff pro-N/슬러그 -m "[PRO-N] 제목 병합"
```

### 4. origin/main으로 올릴 때 — 모아서 한 번

사용자가 올리라고 하거나 의미 있는 묶음이 찼을 때만 합니다. 애매하면 묻습니다. 올리기 전에
1단계 전체 게이트를 한 번 돌립니다 — CI를 확인 도구로 쓰지 않습니다.

```bash
git fetch origin
git merge-base --is-ancestor origin/main dev && echo ok   # ok가 아니면 멈춥니다
git push origin dev:main
```

`origin/main`이 로컬 `dev`의 조상이 아니면 누가 `main`에 따로 올린 것입니다. 강제로 덮지 말고
사용자에게 알립니다. 로컬 `main` 브랜치는 체크아웃할 필요가 없습니다. `dev`는 그래도 push하지
않습니다.

### 5. 워크트리를 지웁니다

`dev` 머지가 끝나면 지워도 됩니다. push는 여러 이슈를 모아 한참 뒤에 하므로 기다리지 않습니다.

```bash
git worktree remove .worktrees/app-N
```

## 자주 틀리는 것

- `dev`로 squash, `main`으로 ff. 반대로 하면 `main`에 커밋이 뭉개지거나 `dev`에 잡음이 쌓입니다.
- 머지마다 push하기, `dev`를 push하기. 배포 한도를 씁니다.
- 잡일이라고 `chore:` 커밋을 쓰기. 나중에 이력을 다시 써야 합니다.
- 워크트리 안에서 3단계를 실행하기. `dev`가 메인 트리에 잡혀 있어 git이 거부합니다.
- 검증을 건너뛰고 리뷰부터 돌리기. codex가 타입 에러를 지적하는 데 시간을 씁니다.
- `pnpm build`만 돌리고 넘어가기. `.test.tsx`는 build가 안 봅니다 — `pnpm typecheck`가 따로 필요합니다.
