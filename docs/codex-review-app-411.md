# APP-411 codex 게이트 기록

`codex exec review --base dev`. 1회차, P2 1건 **수용**.

## R1 — P2 1건

### 1. [P2] 바뀐 정렬 계약이 이 레포의 OpenAPI 미러에 없다 — 수용

> 이 주석은 `openapi3.yml`에 동일한 정렬 설명이 있다고 단정하지만, 현재
> `GET /v1/projects/{projectId}/notes` 설명에는 `meetingStartedAt ?? createdAt` 기준이
> 없습니다. (…) 이후 이 미러를 기준으로 클라이언트를 생성하거나 검토하면 정렬 계약을 알 수
> 없어 다른 키로 다시 구현하게 됩니다. `rules/api-data.md:25-35`

**맞다.** 그리고 지적이 가리키는 곳이 정확하다 — `noteOrderedAt`의 주석이 "서버의 정렬 기준과
같은 식이다(`openapi3.yml`의 노트 목록 설명)"라고 **이 레포의 파일을 인용**하는데, 그 파일에는
그 문장이 없었다. 없는 것을 근거로 대는 주석이었다.

APP-410(server)에서 description을 고치고 docs repo 미러까지 옮겼지만, 이 레포 사본은
"차이가 operation description 한 줄이라 orval 생성물이 안 바뀐다"는 이유로 미뤘다.
**그 판단이 틀렸다** — orval은 description을 훅의 JSDoc으로 옮긴다.

```diff
- * 프로젝트의 노트 목록을 조회한다.
+ * 프로젝트의 노트 목록을 조회한다. 회의를 기록하기 시작한 시각 내림차순이고, 한 번도 기록하지 않은 노트는 만든 시각으로 선다.
```

`openapi3.yml`의 그 줄만 원본과 맞추고 `pnpm orval`을 돌렸다. 생성물 차이는
`lib/api/generated/notes/notes.ts`의 JSDoc 한 줄뿐이다.

**전체 복사 대신 그 줄만 고쳤다.** 규칙(`api-data.md`)은 원본에서 복사한 뒤 `/internal/**`을
지우라고 하는데, 이 사본은 그 과정에서 이미 YAML 인용 스타일까지 달라져 있어(원본은
`description: "..."`, 사본은 인용 없음) 통째로 덮으면 이번 변경과 무관한 diff가 파일 전체에
생긴다. 두 파일의 public 부분 차이가 이 한 줄뿐인 것을 확인하고 움직였다.

## 리뷰가 짚지 않았지만 같이 한 것

`formatRelativeTime`은 행의 `15분 전`을 걷어내면서 부르는 곳이 없어졌다. 자기 테스트만 남은
모듈이라 테스트와 함께 지웠다.

## 검증

정렬·묶음 테스트가 실제로 회귀를 잡는지 확인했다 — `noteOrderedAt`을 `updatedAt`으로 되돌려
돌리니 그 8건이 빨개졌다.

게이트 5종 전부 통과: `pnpm test:run` (858) · `pnpm lint` · `pnpm typecheck` · `pnpm build` ·
`pnpm test:e2e` (29).
