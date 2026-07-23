# APP-144 API 맥락 맵 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/api-surface.md` 하나를 만든다 — 44 operation, 실패 목록, shadcn 매핑.

**Architecture:** 문서 한 개. 코드 변경 없음. 훅 이름은 `lib/api/generated/`에서 확인해 옮기고, 화면·상태는 계약과 APP-111~117의 요구에서 도출한다.

**Spec:** `docs/superpowers/specs/2026-07-23-app-144-api-surface-design.md`

## Global Constraints

- 행 단위는 **operation**이다 (34경로 / 44 operation).
- 훅 이름은 **생성 파일에서 확인한 실제 이름**만 쓴다. 추정 금지.
- `v4 프레임 ID`는 전부 `없음`으로 둔다 — APP-145가 그리면서 채운다.
- 생성 훅을 쓸 수 없는 셋(`sendAgentChatMessage`, `sendNoteSharedChatMessage`, `startWorkspaceIntegration`)은 그 사실을 표에 적는다.
- 리뷰 게이트는 로컬 `codex exec review --base dev` 한 번.
- 완료 시 PR 없이 `dev`로 squash-merge하고 Linear를 Done으로.

---

### Task 1: 맵 작성

**Files:**
- Create: `docs/api-surface.md`

- [ ] **Step 1: operation 목록을 뽑는다**

```bash
ruby -ryaml -Ku -e '
d=YAML.load_file("openapi3.yml")
d["paths"].sort.each do |p,ops|
  ops.each do |m,o|
    next unless o.is_a?(Hash) && o["operationId"]
    codes = (o["responses"]||{}).keys.reject{|c| %w[200 201 202 204].include?(c)}.sort
    puts "#{m.upcase}\t#{p}\t#{o["operationId"]}\t#{codes.join(",")}"
  end
end'
```

기대: 44행.

- [ ] **Step 2: 훅 이름을 확인한다**

```bash
grep -rhoE "^export (const|function) use[A-Za-z]+" lib/api/generated/*/[a-z]*.ts \
  | sed 's/export \(const\|function\) //' | sort -u
```

기대: 44개. operation 수와 같아야 한다 — 다르면 생성이 어긋난 것이다.

- [ ] **Step 3: `docs/api-surface.md`를 쓴다**

기능 영역별로 묶는다(알파벳순이 아니라). 디자인 에이전트가 자기 행을 찾기 쉬워야 한다.

형식:

```markdown
| operation | 훅 | 쓰는 화면 | 응답이 만드는 상태 | v4 프레임 |
|---|---|---|---|---|
```

`쓰는 화면`은 APP-111~117의 요구에서 가져온다. `응답이 만드는 상태`에는 그 operation이 실제로 만드는 것만 적는다 — 로딩·빈·에러·권한없음을 기계적으로 반복하지 않는다.

실패는 별도 절에 화면 관점으로 정리한다. shadcn 매핑표를 같은 문서 끝에 둔다.

- [ ] **Step 4: 행 수를 확인한다**

```bash
grep -c "^| \`" docs/api-surface.md
```

기대: 44 (표 헤더·구분선 제외).

- [ ] **Step 5: 커밋**

```bash
git add docs/api-surface.md docs/superpowers
git commit -m "docs: API 맥락 맵 — 44 operation과 실패·shadcn 매핑"
```

- [ ] **Step 6: codex 게이트와 merge**

```bash
codex exec review --base dev
```

지적을 판단·기록한 뒤:

```bash
git checkout dev
git merge --squash feature/app-144-api-맥락-맵-shadcn-매핑표
git commit
git push origin dev
```

Linear APP-144를 Done으로 옮긴다.
