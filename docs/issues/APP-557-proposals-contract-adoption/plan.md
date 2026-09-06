# 실시간 정리 레일의 proposals 계약 도입 — 여기는 순서에 관한 문서다

- 이슈: [APP-557](https://linear.app/minswon/issue/APP-557)
- spec: docs `docs/app-557/proposals-contract-adoption:projects/PRO-45-실시간-맥락-역할-경계-정리/spec/APP-557/spec.md` @ `7b8b686`
- 프로젝트 브랜치: `pro-45/실시간-맥락-역할-경계-정리` ← `dev`
- APP 브랜치: `feat/app-557/proposals-contract-adoption` ← `pro-45/실시간-맥락-역할-경계-정리`
- 병합: APP → PRO 는 squash (`merge-worktree.sh` 를 `.worktrees/pro-45` 안에서), PRO → dev 는 rebase. 마지막 관문을 통과한 뒤에만
- 검증: `pnpm test:run && pnpm verify`

`pnpm verify` 는 `lint · typecheck · build` 다. e2e 는 그 안에 없으므로 마지막 관문에서 `pnpm test:e2e` 를 따로 한 번 돌린다 — CLAUDE.md 의 머지 전 다섯 명령이 그렇게 정한다.

이 plan 의 경로와 브랜치 이름은 moa 레지스트리(`MOA_PLAN_PATH` · `MOA_BRANCH_PATTERN`)를 따른다. 이 레포의 `docs-layout.md` · `issue-tracking.md` 가 적어 둔 `docs/superpowers/plans/` 와 `feature/app-N-slug` 와 다르다. 두 규칙이 갈려 있고, 이번에는 이 이슈를 moa 흐름으로 잡았으므로 레지스트리를 따랐다. 두 문서를 맞추는 것은 이 이슈 밖이다.

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | web 은 계약을 발행하지 않는다. 지켜야 하는 정본은 docs `origin/main @ f8cecd9` 의 `openapi3-server.yml` · `asyncapi-web-server.yml` 이고, 둘을 파싱해 옛 미러와 대조했다. 두 REST operation(`getProposals` · `getProposalRevisions`)과 두 noteTopic 메시지(`proposal.changed` · `transcript-analysis-run.applied`)는 이름만 바뀌고 required · enum · 정렬 · 봉투가 같다. 같이 딸려 오는 public 경로 넷은 description 만 다르다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | spec 의 「옛 어휘 파일 31개」는 `git grep` 으로 센 값이고 아래 「건드리는 것」이 그 목록이다(생성물 제외 33개 — spec 이 센 뒤 `note-topic-protocol.ts` 와 `openapi-contract.test.ts` 를 더 찾았다). 지연·비율 같은 수치는 spec 에 없다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | REST 호출자는 `note-realtime-provider.tsx` 의 `snapshotQuery` 하나다. WS 소비자는 `note-topic-protocol.ts` 의 discriminatedUnion 하나다. 테스트 더블은 `lib/mocks/context-candidates.ts` (시드 데이터) · `rest-handlers.ts` (2 핸들러) · `websocket-handler.ts` (2 이벤트) · `__fixtures__/synthetic-ledger-snapshot.json` 이고, e2e 세 벌이 그 목을 지난다. 랜딩 데모 `use-demo.ts` 도 같은 목을 읽는다. 마이그레이션은 없다 — web 은 데이터를 갖지 않는다 |
| 되돌리기 | 복구 비용은 얼마인가 | PRO 로 들어가는 squash 커밋 하나를 revert 하면 web 은 돌아온다. 다만 그러면 dev 의 server(옛 경로 없음)와 다시 어긋나므로 되돌릴 이유가 생기면 server 를 같이 되돌려야 한다. spec 과 같다 |
| 사람에게 물은 것 | spec 의 열린 질문에 답이 났나 | 「합성 원장 픽스처를 새 계약으로 다시 받을 수 있는가」 — 지금 로컬에 server 가 떠 있지 않다(`ss -ltn` 에 8080 없음). spec 이 정한 대체안대로 **키 치환**으로 간다. 치환은 이름 여섯 개의 결정적 치환이고 값은 건드리지 않으므로 `synthetic-ledger-snapshot.test.ts` 의 판정(카드 수 · 포화 · coverage gap)이 그대로 유지돼야 한다. 그 사실을 완료 댓글에 적는다 |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `openapi3.yml` | server 계약 미러. `context-candidates` 두 경로와 `ContextCandidate*` · `ContextClassificationAppliedRange` 스키마 | `origin/main @ f8cecd9` 의 `openapi3-server.yml` 사본에서 `/internal/**` 경로, 거기서만 닿는 스키마, `internalToken` 보안 스킴을 참조 그래프로 걷어낸 것. `openapi-contract.test.ts` 가 판정한다 |
| `asyncapi.yml` | web ↔ server 비동기 미러. noteTopic 에 `context.candidate.changed` 등 | `asyncapi-web-server.yml` 사본 그대로 |
| `lib/api/generated/context-candidates/` | orval 생성물 | 삭제된다. `pnpm orval` 이 `lib/api/generated/proposals/` 를 만든다. 손으로 편집하지 않는다 |
| `lib/api/openapi-contract.test.ts` | 미러 검사. internal 전용 스키마 목록에 `ContextCandidateOperationsResponse` 등, 후보 경로 두 개와 `ContextCandidateRevision` 을 단언 | internal 전용 스키마 목록을 새 정본 이름으로, 경로 단언을 `proposals` 로, 스키마 단언을 `ProposalRevision` 으로 |
| `lib/notes/context-candidates/` (contract · select · reducer · timeline · scope · presentation · 테스트 · ADAPTER.md · 픽스처) | 후보 어휘의 zod 스키마 · selector · reducer · 표현 | `lib/notes/proposals/` 로 `git mv`. 식별자와 필드는 계약 이름(`proposalId` · `citations` · `runId` · `runs` · `resolvesProposalId`) 으로. `contract.ts` 의 방향성 가드는 `ProposalCitation` · `TranscriptAnalysisRunRange` · `ProposalRevision` 생성 타입에 묶는다. ADAPTER.md 는 경로와 이름만 바꾸고 절차 서술은 유지 |
| `lib/notes/note-topic-protocol.ts` | discriminatedUnion 에 `context.candidate.changed` · `context.classification.batch.applied` | `proposal.changed` · `transcript-analysis-run.applied`. payload 키 `candidate` → `proposal`, `range` 는 그대로 |
| `components/notes/note-realtime-provider.tsx` (+ test) | `useGetContextCandidates` + `selectContextSnapshot`, reducer 이벤트 배선 | `useGetProposals` + 새 select. 나머지 배선은 이름만 |
| `components/notes/context-rail.tsx` · `context-candidate-card.tsx` · `context-coverage-row.tsx` (+ tests) | 레일 · 카드 · coverage row. `candidateId` · `evidence` · `closeReason` 등 | 파일 이름은 `proposal-rail.tsx` · `proposal-card.tsx` · `proposal-coverage-row.tsx`. 화면 생김새와 문구는 그대로, 필드 이름만 |
| `components/notes/note-archive.tsx` · `transcript-view.tsx` (+ tests) | `appliedRanges` · `runKey` 를 읽어 커버리지를 그림 | `runs` · `runId` |
| `components/heymoa/landing/use-demo.ts` | 랜딩 데모가 후보 목 데이터를 읽음 | 새 목 모듈 이름과 필드 |
| `lib/mocks/context-candidates.ts` | 시드 고정 faker 후보 데이터 | `lib/mocks/proposals.ts`. 시드와 값은 유지, 키만 |
| `lib/mocks/rest-handlers.ts` · `websocket-handler.ts` · `nullable-coverage.test.ts` | 옛 경로 2개와 이벤트 2개를 흘림 | 새 경로 · 새 이벤트 이름 · 새 payload 키 |
| `e2e/context-candidates.spec.ts` · `synthetic-ledger-rail.spec.ts` · `live-partial.spec.ts` | MSW 로 레일을 검사 | `e2e/proposals.spec.ts` 로 이름 변경, 나머지 둘은 참조 이름만. 시나리오는 그대로 |

**배치 판단.** 새 디렉터리는 `lib/notes/proposals/` 하나다. 컴포넌트는 `components/notes/` 안에서 이름만 바꾼다 — feature 폴더를 새로 만들지 않는다(`CLAUDE.md` 의 「어디에 무엇이 있나」에서 노트 화면은 `components/notes/`). `context-` 접두사는 「맥락 레일」이라는 화면 이름이 아니라 옛 계약 어휘였으므로 `proposal-` 로 바꾼다. `lib/api/generated/` 는 절대 손대지 않는다.

## 순서

### 1. 계약 미러 갱신과 훅 재생성

- 바꾸는 것: `openapi3.yml` · `asyncapi.yml` 을 정본 사본에서 다시 뜬다. `pnpm orval` 로 `lib/api/generated/` 를 재생성한다. `openapi-contract.test.ts` 의 단언을 새 이름으로 고친다
- 검증: `pnpm vitest run lib/api/openapi-contract.test.ts lib/api/contract-consistency.test.ts` 와 `pnpm orval` 종료 코드 0, `ls lib/api/generated/proposals`. **이 단계에서 `pnpm typecheck` 는 빨갛다** — 소비처가 아직 옛 훅을 import 한다. 2·3 이 푼다
- 되돌리기: 이 커밋만 revert 하면 미러와 생성물이 옛 것으로 돌아온다

### 2. `lib/notes/proposals/` 이관

- 바꾸는 것: `git mv lib/notes/context-candidates lib/notes/proposals`. contract · select · reducer · timeline · scope · presentation 과 테스트, ADAPTER.md, 픽스처의 식별자·키를 계약 이름으로. `note-topic-protocol.ts` 의 union 을 새 메시지로
- 검증: `pnpm vitest run lib/notes` — 픽스처 테스트(`synthetic-ledger-snapshot.test.ts`)의 카드 수 · 포화 · coverage gap 판정이 변경 전과 같은 값이어야 한다. `pnpm typecheck` 는 아직 빨갛다(components · mocks)
- 되돌리기: 1 과 함께 revert

### 3. 화면 · provider · 목 · 데모 교체

- 바꾸는 것: `components/notes/` 의 provider · 레일 · 카드 · coverage row · archive · transcript-view 와 테스트, `lib/mocks/` 의 시드 · REST · WS 핸들러 · nullable-coverage 테스트, `components/heymoa/landing/use-demo.ts`
- 검증: `pnpm typecheck && pnpm vitest run components lib/mocks`. 여기서 처음 초록이 된다. 이어서 옛 어휘 검색이 0건인지 — `git grep -n 'ContextCandidate\|contextCandidate\|context-candidate\|candidateId\|context\.candidate\.changed\|classification\.batch\.applied\|appliedRanges\|runKey' -- app components lib e2e ':!lib/api/generated'`
- 되돌리기: 1·2 와 함께 revert

### 4. e2e 이름과 경로 교체

- 바꾸는 것: `e2e/context-candidates.spec.ts` → `e2e/proposals.spec.ts`, 나머지 두 spec 의 목 참조 이름
- 검증: `pnpm build && pnpm test:e2e`. `pnpm build` 와 dev 서버를 번갈아 돌린 뒤 무더기로 깨지면 `.next` 를 지우고 다시(`architecture.md` 의 Next.js 16 절)
- 되돌리기: 1~3 과 함께 revert

### 5. 손 확인

- 하는 것: server dev(또는 로컬 server pro-45 머지본)를 상대로 노트 화면을 열어 레일이 명제 목록을 그리는지, 새 명제가 생기면 새로고침 없이 카드가 나타나는지 본다. 결과를 완료 댓글에 한 줄로
- 검증: 사람 눈. 자동 검증이 없는 유일한 단계다
- 되돌리기: 해당 없음

1~4 는 결국 squash 커밋 하나로 PRO 에 들어간다. 단계를 나눈 것은 되돌리기 단위가 아니라 **어디서 빨간지 알기 위해서**다.

## 마지막 관문

4 가 끝난 뒤 `.worktrees/app-557` 에서 `pnpm test:run && pnpm verify` 를 통째로 한 번 돌리고, 이어서 `pnpm test:e2e` 를 돌린다. 둘 다 초록이면 `codex exec review` (skill `merging`) 를 받은 뒤 `.worktrees/pro-45` 안에서 `merge-worktree.sh .worktrees/app-557` 로 squash 한다.

PR 이 없는 레포라 **이게 유일한 관문**이다. CI 가 없으니 여기서 안 걸리면 아무 데서도 안 걸린다.

새 워크트리에서는 `pnpm install` 을 먼저 돌린다 — `node_modules` 는 공유되지 않는다.

## 안 하는 것

- 화면 문구·디자인 변경. 「후보」라는 사용자 문구가 있어도 이번엔 두고, 바꾸려면 별도 이슈
- `docs-layout.md` · `issue-tracking.md` 와 moa 레지스트리의 경로·브랜치 규칙 불일치 정정. 이슈 없음, 사람이 정한다
- PRO-45 PRD 원문의 깨진 전제 정정. finalize 가 docs `pro-45` 브랜치에서 한다
- 합성 원장 픽스처를 server 에서 다시 받는 일. 로컬 server 가 없어 키 치환으로 간다. 나중에 다시 받으면 픽스처만 갈아끼운다
