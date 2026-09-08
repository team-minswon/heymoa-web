# 계약 어댑터 경계 — 검토·확정·개념 요약

> **아직 계약이 없다.** server public 계약(`contracts/specs/openapi3-server.yml`)에 검토본·
> 승인·개념 요약 경로가 없다. 이 폴더의 세 파일이 docs
> `projects/PRO-34-…/spec/APP-464/docs/openapi.yaml`(검토용 소비자 제안)을 임시로 옮긴
> 것이고, 실제 계약이 docs 에 checkpoint 되면 아래 절차로 갈아끼운다.
> 선례는 `lib/notes/proposals/ADAPTER.md`(APP-454 → APP-459).

## 경계 — 세 파일이 전부다

| 파일 | 무엇 | 계약이 오면 |
|---|---|---|
| `contract.ts` | 제안의 zod 스키마 · 파생 타입 | **zod 는 남긴다**(응답을 런타임에 한 번 더 검사). 생성 타입과 방향성 가드로 묶는다 |
| `api.ts` | 공용 mutator(`apiFetch`)를 지나는 임시 호출 | **삭제.** orval 생성 훅으로 대체 |
| `query-keys.ts` | 수동 쿼리 키 | **삭제.** orval 생성 키로 대체 |

나머지(`select.ts` · `edits.ts` · `relation-web.ts`)와 `components/notes/meeting-review/` 는
**화면용 타입만 읽는다.** 계약이 제안과 달라도 `select.ts` 의 변환만 고치면 컴포넌트는
그대로여야 한다. 컴포넌트가 `contract.ts` 를 import 하기 시작하면 이 경계가 깨진 것이다.

## 교체 절차

1. docs `origin/main` 의 `openapi3-server.yml` 에서 미러를 다시 뜬다(`/internal/**` 제거).
   `openapi-contract.test.ts` 가 경로·스키마 수를 판정한다
2. `pnpm orval`. 생성 디렉터리 이름은 server 태그가 정한다
3. `api.ts` · `query-keys.ts` 를 지우고 provider 의 호출을 생성 훅·키로 바꾼다. 두 겹 봉투는
   provider 의 `select` 에서 벗긴다(`lib/notes/proposals/select.ts` 와 같은 방식)
4. `contract.ts` 의 스키마를 생성 타입과 `Assert<Extends<…>>` 가드로 묶는다. `oneOf` 가 있는
   스키마는 「생성 → 내 타입」 한 방향만 붙는다(선례 문서의 함정)
5. `lib/mocks/meeting-review.ts` 를 생성 MSW 의 형태와 대조한다. 목이 계약과 갈리면
   e2e 가 통과해도 실제로는 깨진다
6. 이 문서 머리의 「아직 계약이 없다」를 지우고 교체 완료를 적는다

## 제안과 달라질 가능성이 큰 자리

- 준비 상태 enum 이름(`NOT_READY | GENERATING | READY | EMPTY | FAILED | STALE`)
- CAS 필드 이름(`expectedReviewVersion` · `expectedItemRevision`)과 409 봉투의 `current`
- 승인 거부 사유 코드
- 개념 요약 상태 6종과 `basis`/`current` 버전 쌍
- 준비 완료 신호. 지금은 폴링(`select.ts` 의 `needsPolling`)이고 noteTopic 메시지가 생기면
  `note-topic-protocol.ts` 에 붙인다

이 목록은 이슈 댓글로 server 에 넘겼다.
