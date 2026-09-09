# 명제 기반 검토·확정 화면과 프로젝트 개념 요약 — 여기는 순서에 관한 문서다

- 이슈: [APP-464](https://linear.app/minswon/issue/APP-464)
- spec: docs `docs/app-464/proposal-review-commit-ui:projects/PRO-34-회의-결과-확정과-프로젝트-연결/spec/APP-464/spec.md` @ `3241741` (소비자 계약 제안 `spec/APP-464/docs/openapi.yaml` 같은 SHA)
- 프로젝트 브랜치: `pro-34/회의-결과-확정과-프로젝트-연결` ← `dev`
- APP 브랜치: `feat/app-464/proposal-review-commit-ui` ← `pro-34/회의-결과-확정과-프로젝트-연결`
- 병합: APP → PRO 는 squash (`merge-worktree.sh` 를 `.worktrees/pro-34` 안에서), PRO → dev 는 rebase. 마지막 관문을 통과한 뒤에만
- 검증: `pnpm test:run && pnpm verify`

`pnpm verify` 는 `lint · typecheck · build` 다. e2e 는 그 안에 없으므로 마지막 관문에서 `pnpm test:e2e` 를 따로 한 번 돌린다. 조율 지시대로 **커밋마다 전체 테스트를 돌리지 않는다** — 단계마다 해당 디렉터리의 vitest 와 typecheck 만 돌리고 전문은 마지막에 한 번이다.

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | web 은 계약을 발행하지 않는다. 정본 `openapi3-server.yml`(docs main @ ebb25ac)에는 이 화면이 부를 public 경로가 없고, spec 의 `docs/openapi.yaml` 은 검토용 제안이다. 그래서 **미러와 orval 생성물을 건드리지 않는다** — `openapi-contract.test.ts` 가 세는 경로 45개와 스키마 62개가 그대로여야 한다. 제안 경로의 호출은 `lib/notes/meeting-review/api.ts` 가 공용 mutator(`lib/api/fetcher.ts` 의 `apiFetch`)로 임시로 하고, 실제 계약이 오면 orval 훅으로 갈아끼운다. 이 절차는 APP-459 때 `lib/notes/context-candidates/ADAPTER.md` 가 밟은 것과 같다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 수치 근거는 없다. spec 의 파일·필드 사실은 코드에서 확인했다: `NoteResponse.data.meetingStartedBy` 있음, 노트 탭 4종(`context · details · transcript · summary`), 프로젝트 route 없음(`app/w/[workspaceId]` · `notes/[noteId]` 뿐), `ProjectResponse.data.description` 있음, `useTranscriptFocus` · `proposal-card.tsx` 재사용 가능 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | `summary` 탭의 유일한 호출자는 `note-panel.tsx` 의 `<NoteSummary>` 다. 사이드바 프로젝트 항목(`workspace-sidebar.tsx`)이 route 진입점이 된다. 목은 `lib/mocks/db.ts` 의 노트 셋(`meetingStartedBy` 가 MOCK_USER 인 것과 null 인 것이 있다)과 프로젝트 둘을 그대로 쓰고 검토본·요약 시드만 더한다. e2e 는 `smoke.spec.ts` 가 summary 탭을 지나므로 「이전 분석」 접기가 그 시나리오를 깨지 않아야 한다. 마이그레이션은 없다 |
| 되돌리기 | 복구 비용은 얼마인가 | PRO 로 들어가는 squash 커밋 하나를 revert 하면 옛 `summary` 탭과 사이드바로 돌아온다. 데이터는 server 에 있어 잃는 것이 없다. 실제 계약이 제안과 다르면 되돌리는 것이 아니라 어댑터(`contract.ts` · `api.ts` · `select.ts`)만 고친다 — 화면은 화면용 타입만 읽는다 |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 계약·준비 신호·무음 회의·참석자 읽기·프로젝트 승인 목록 다섯이 열려 있고 전부 server 몫이다. 조율자가 「제안 위에서 독립 구현을 계속하고 미확정 wire 는 server 에 묶어 전달」로 정했다. 이 plan 은 그 결정 위에 선다. 참석자 읽기 허용은 서버 판정을 따르되 **읽기 전용 화면을 기본으로 만든다** — `canApprove` 와 편집 권한이 없으면 편집 컨트롤을 그리지 않으면 되고, 그 반대(허용을 가정)는 되돌리기 비싸다 |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `lib/notes/meeting-review/contract.ts` | (신규) | 제안의 zod 스키마 · 파생 타입. `z.object` 로 모르는 필드는 무시(APP-557 의 이유와 같다). 계약이 오면 생성 타입과 방향성 가드로 묶는다 |
| `lib/notes/meeting-review/api.ts` | (신규, 임시) | 8경로를 `apiFetch` 로 부른다. 파일 머리에 「계약이 오면 orval 훅으로 대체」를 적는다. `api-data.md` 의 예외 셋에 없으므로 주석에 근거(ADAPTER 선례)를 남긴다 |
| `lib/notes/meeting-review/query-keys.ts` | (신규, 임시) | 수동 쿼리 키. 같은 이유로 임시 |
| `lib/notes/meeting-review/select.ts` | (신규) | 응답 → 화면용 타입(`ReviewScreen`). 영역별 준비 상태, 항목 by id, 관계 by 항목, 미검토 집합, 승인 가능 여부. 화면 컴포넌트는 이것만 읽는다 |
| `lib/notes/meeting-review/edits.ts` | (신규) | 미저장 편집·충돌 대조의 순수 reducer. 「저장 → 응답 revision 이 현재보다 클 때만 반영」 「충돌은 서버 값 보관」 「승인 전 미저장 있음 판정」 |
| `lib/notes/meeting-review/relation-web.ts` | (신규) | 선택 항목의 1-hop 배치를 계산하는 순수 함수. 입력은 항목·관계, 출력은 노드·간선 좌표. React 를 모른다 |
| `lib/notes/meeting-review/ADAPTER.md` | (신규) | 임시 어댑터의 경계와 계약 도착 시 교체 절차. `context-candidates/ADAPTER.md` 와 같은 양식 |
| `lib/mocks/meeting-review.ts` | (신규) | 시드 고정 검토본·평가·관계·승인·개념 요약. `db.ts` 의 노트·프로젝트 ID 를 참조한다 |
| `lib/mocks/rest-handlers.ts` | REST 핸들러 | 8경로 추가. CAS 불일치 409, 회의 시작자 아님 403, 승인 거부 409(미검토 남음), 재검토 202 → 폴링 뒤 READY 를 흉내낸다 |
| `components/notes/meeting-review/provider.tsx` | (신규) | 조회·폴링·mutation·편집 상태의 소유자. `summary` 탭 아래에서만 산다 |
| `components/notes/meeting-review/review-regions.tsx` · `review-item.tsx` | (신규) | 영역과 항목. 기하는 `proposal-card.tsx` 를 따르되 편집(내용 · 제외/복원 · 추가)이 붙는다 |
| `components/notes/meeting-review/evaluation-panel.tsx` | (신규) | AI 해석 배지 · 본문 · 근거 · 한계 · 버전 · 오래됨/실패 |
| `components/notes/meeting-review/relations-panel.tsx` · `relation-compare.tsx` · `relation-web.tsx` | (신규) | 관계 목록 · 양쪽 비교 · 1-hop SVG. `kind` 분기 없음 |
| `components/notes/meeting-review/review-gate.tsx` | (신규) | 미검토·충돌·오래됨 목록, 저장 상태, 승인 버튼(회의 시작자), 거부 사유, 확정 뒤 승인 정보 |
| `components/notes/note-summary.tsx` | 구식 analysis 화면 | 회의가 끝났으면 `<MeetingReview>` 를 그리고 구식 analysis 를 「이전 분석」 접이식으로 아래에 둔다. 끝나기 전 분기는 그대로 |
| `app/w/[workspaceId]/projects/[projectId]/page.tsx` | (신규) | Server Component. params 만 읽고 `<ProjectConceptSummary>` 를 그린다 |
| `components/workspace/project-concept-summary.tsx` | (신규) | 프로젝트 이름·원본 설명 · 요약 상태 6종 · 네 묶음 · 설명별 근거 · 갱신 버튼 |
| `components/workspace/workspace-sidebar.tsx` | 프로젝트 필터 목록 | 프로젝트 항목에 route 링크를 더한다. 필터 동작은 그대로 |
| `e2e/meeting-review.spec.ts` · `e2e/project-summary.spec.ts` | (신규) | MSW 위에서 검토 → 충돌 → 승인, 요약 상태 전환 |

**배치 판단.** 새 feature 폴더는 `lib/notes/meeting-review/` 와 `components/notes/meeting-review/` 다. 프로젝트 요약은 `components/workspace/` 에 둔다 — 워크스페이스 셸의 화면이고 노트를 모른다. `components/ui/` 에는 아무것도 더하지 않는다. 1-hop 뷰의 좌표 계산은 `lib/` 순수 함수이고 SVG 그리기만 컴포넌트다. 어댑터 파일 셋(`contract` · `api` · `query-keys`)이 계약 도착 시 바뀌는 전부여야 한다.

## 순서

### 1. 계약 어댑터와 화면용 selector

- 바꾸는 것: `lib/notes/meeting-review/` 의 `contract.ts` · `api.ts` · `query-keys.ts` · `select.ts` · `edits.ts` · `relation-web.ts` · `ADAPTER.md` 와 각 테스트. 제안 YAML 의 예제 형태를 픽스처로 써서 파싱·selector·reducer·배치를 검사한다
- 검증: `pnpm vitest run lib/notes/meeting-review && pnpm typecheck`
- 되돌리기: 이 커밋만 revert 하면 아무 화면도 안 바뀐다

### 2. MSW 목

- 바꾸는 것: `lib/mocks/meeting-review.ts` 시드, `rest-handlers.ts` 의 8경로. 시드에는 미검토 항목 · 오래된 관계 · 사람 추가 항목 · 프로젝트 레벨 대체 제안 · 근거 없는 관계 · 실패한 평가가 하나씩 들어 있어야 화면 상태를 다 지난다
- 검증: `pnpm vitest run lib/mocks lib/api` — `openapi-contract.test.ts` 가 여전히 45경로여야 한다(미러 불변)
- 되돌리기: 1 과 함께 revert

### 3. 검토·확정 화면

- 바꾸는 것: `components/notes/meeting-review/*` 와 `note-summary.tsx` 배선. 편집은 완료 단위 저장, 충돌은 인라인 대조, 승인은 미저장 저장 뒤. 각 컴포넌트 테스트는 「승인 전 배지가 확정처럼 보이지 않는다」 「충돌 시 로컬 편집이 남는다」 「비시작자에게 승인 버튼 없음」 「모르는 kind 도 그린다」를 고정한다
- 검증: `pnpm vitest run components/notes && pnpm typecheck && pnpm lint`
- 되돌리기: 1·2 와 함께 revert

### 4. 프로젝트 개념 요약 route

- 바꾸는 것: `app/w/[workspaceId]/projects/[projectId]/page.tsx`, `project-concept-summary.tsx`, 사이드바 링크. 상태 6종과 근거 열기, 갱신 요청
- 검증: `pnpm vitest run components/workspace && pnpm build`
- 되돌리기: 1~3 과 함께 revert

### 5. e2e

- 바꾸는 것: `e2e/meeting-review.spec.ts` · `e2e/project-summary.spec.ts`. 기존 `smoke.spec.ts` 의 summary 시나리오가 그대로 통과해야 한다
- 검증: `pnpm build && pnpm test:e2e`. `.next` 가 섞이면 지우고 다시(`architecture.md`)
- 되돌리기: 1~4 와 함께 revert

1~5 는 squash 커밋 하나로 PRO 에 들어간다. 단계는 어디서 빨간지 알기 위한 것이다.

### 계약이 도착하면 (이 이슈 안에서, 도착 시점에 따라 6 또는 후속)

- 바꾸는 것: 미러 갱신 → `pnpm orval` → `api.ts` · `query-keys.ts` 삭제, `contract.ts` 를 생성 타입 가드로 묶기, `select.ts` 의 입력 타입 교체, 목을 생성 MSW 와 대조. `ADAPTER.md` 절차 그대로
- 검증: 마지막 관문 전문
- 계약이 이 이슈 머지 전에 안 오면 임시 어댑터인 채로 머지하고 교체를 후속 이슈로 만든다. 그 사실을 완료 댓글 「안 된 것」에 적는다

## 마지막 관문

5 가 끝난 뒤 `.worktrees/app-464` 에서 `pnpm test:run && pnpm verify` 를 통째로 한 번, 이어서 `pnpm test:e2e`. 둘 다 초록이면 `codex exec review --base pro-34/회의-결과-확정과-프로젝트-연결`, P1·P2 를 고친 뒤 `.worktrees/pro-34` 안에서 `merge-worktree.sh .worktrees/app-464`.

PR 이 없는 레포라 **이게 유일한 관문**이다. 새 워크트리에서는 `pnpm install` 을 먼저 돌린다.

## 안 하는 것

- 미러·orval 생성물 변경. 계약이 없다
- 2-hop 이상 연결 뷰, 드래그, 자동 배치 라이브러리
- 검토 재개 시 마지막 위치 복원
- 프로젝트 route 에 승인 항목 목록. server public 조회가 생기면 별도 이슈
- 구식 analysis 화면 삭제. 「이전 분석」으로 접어 둔다
