# 계약 어댑터 경계

APP-459의 실제 OpenAPI/AsyncAPI가 오면 **여기 적힌 것만 바뀝니다.** 화면 코드는 안 바뀝니다.

---

## 왜 이 문서가 있나

지금 `contract.ts`는 **임시 zod 계약**입니다. server가 아직 web용 조회를 안 냈고
(`v1/notes/{noteId}/context-candidates` grep 0건), 생성 `openapi3.yml`도 없습니다.

임시 계약이 코드 전체에 번지면 교체가 대공사가 됩니다. 그래서 **경계를 하나로 좁혀
두었고**, 이 문서가 그 경계와 교체 절차를 적습니다.

---

## 경계 — 세 파일이 전부입니다

> **정정(2026-08-25).** 앞선 판에 「`contract.ts`를 생성 타입 재수출로 바꾼다」고 적었는데
> **그대로는 불가능합니다.** `orval.config.ts`가 `client: "react-query"`라 TypeScript 타입·훅·
> MSW만 만들고 **zod runtime parser를 만들지 않습니다.** 그런데 `note-topic-protocol.ts`는
> WS JSON을 **실제로 파싱**하는 데 이 스키마를 씁니다 — 지우면 파싱할 것이 없어집니다.

| 파일 | 무엇 | 계약이 오면 |
|---|---|---|
| **`contract.ts`** | zod 스키마 · 파생 타입 | **zod는 남깁니다.** WS 파싱에 필요합니다. 대신 **생성 타입과 묶어** 드리프트를 막습니다(아래) |
| **`api.ts`** | `fetchContextCandidates()` — 공용 mutator를 지나는 직접 호출 | **삭제.** orval 생성 훅으로 대체 |
| **`query-keys.ts`** | 수동 쿼리 키 | **삭제.** orval 생성 키로 대체 |

REST(타입·훅·키)는 생성물로 가고, **WS runtime 파서만 손으로 남습니다.**

### 남는 zod가 생성 타입과 어긋나지 않게

`orval`이 파서를 안 주므로 **둘이 갈라질 수 있습니다.** 타입 가드로 막습니다.

**드라이런으로 실측했습니다** — app-459의 생성 `openapi3.yml`로 orval을 돌려(exit 0) 나온
타입에 실제로 대입해 봤습니다. 결과가 셋 다 같지 않았습니다.

| 스키마 | 생성 타입 | 양방향? |
|---|---|---|
| `contextEvidenceSchema` | `ContextCandidateEvidence` | **성립** |
| `appliedRangeSchema` | `ContextClassificationAppliedRange` | **성립** |
| `contextCandidateHeadSchema` | `ContextCandidateRevision` | **한 방향만** |

**head가 다른 이유는 `oneOf`입니다.** 생성 타입이 「교차타입 3개의 union」으로 나옵니다
(`{status:'OPEN', closeReason:null} & {…}` | `{status:'CLOSED', closeReason:'RETRACTED'} & {…}` | …).
제 zod는 평평한 `z.object`에 `.refine()`으로 같은 행렬을 강제하는데, **`refine`은 런타임
검사라 타입에 안 나타납니다.** 그래서 `z.infer`가 union의 어느 갈래에도 대입되지 않습니다.

```
Type '{ … kind: "AGENDA" | "DECISION" | … }' is not assignable to
     '{ kind: "QUESTION"; status: "CLOSED"; closeReason: "RESOLVED" } & { … }'
```

그러므로 **`z.ZodType<ContextCandidateRevision>`으로 묶으려 하지 마세요.** 안 붙습니다.
대신 **필요한 방향 하나**를 가드로 세웁니다 — 서버가 필드를 더하거나 타입을 바꾸면
그쪽이 깨지므로, 드리프트를 잡는 목적에는 이 방향이 맞습니다.

```ts
type Assert<_T extends true> = never;
type Extends<A, B> = [A] extends [B] ? true : false;

// 평평한 둘은 양방향
type _e1 = Assert<Extends<z.infer<typeof contextEvidenceSchema>, ContextCandidateEvidence>>;
type _e2 = Assert<Extends<ContextCandidateEvidence, z.infer<typeof contextEvidenceSchema>>>;
type _r1 = Assert<Extends<z.infer<typeof appliedRangeSchema>, ContextClassificationAppliedRange>>;
type _r2 = Assert<Extends<ContextClassificationAppliedRange, z.infer<typeof appliedRangeSchema>>>;

// head 는 「생성 → 내 타입」 한 방향만
type _h1 = Assert<Extends<ContextCandidateRevision, z.infer<typeof contextCandidateHeadSchema>>>;
```

**이 다섯 줄이 실제로 컴파일되는 것과, 드리프트를 잡는 것을 둘 다 확인했습니다.**
생성 evidence에 `speakerLabel: string`을 하나 끼워 넣자 `_e2`가
`Type 'false' does not satisfy the constraint 'true'`로 깨졌습니다.

그 밖은 안 건드립니다.

```
contract.ts ──┬── reducer.ts        (순수 함수. 타입만 봄)
              ├── timeline.ts       (순수 함수. 타입만 봄)
              ├── note-topic-protocol.ts   (WS union에 스키마를 얹음)
              ├── context-rail.tsx
              ├── context-candidate-card.tsx
              ├── context-coverage-row.tsx
              ├── note-realtime-provider.tsx
              └── lib/mocks/context-candidates.ts
```

**아래 여덟은 전부 `contract.ts`의 타입 이름만 봅니다.** 이름이 유지되면 교체에 안 걸립니다.

### 유지해야 하는 타입 이름

```ts
ContextCandidateHead     ContextEvidence     AppliedRange
ContextCandidateSnapshot ContextCandidateChanged  ContextBatchApplied
```

생성 타입 이름이 다르면 `contract.ts`에서 `export type ContextCandidateHead = Generated...`로
받아 넘깁니다. **이름을 바꾸지 않습니다** — 바꾸면 여덟 파일을 다 고쳐야 합니다.

---

## 교체 절차

```bash
# 1. 계약 미러 — 원본은 server 산출물이다. 손으로 고치지 않는다
cp <server>/build/api-spec/openapi3.yml openapi3.yml   # /internal/** 제거

# 2. 훅 생성
pnpm orval

# 3. api.ts · query-keys.ts 삭제, provider 의 useQuery 를 useGetContextCandidates 로 교체
#    contract.ts 의 zod 는 남기되 위 「타입 가드」 다섯 줄을 contract.test.ts 에 넣는다
#    AsyncAPI 의 event envelope 를 root asyncapi.yml 과 exact 대조
#      ※ 2026-08-25 기준 asyncapi.yml 에 candidate 언급이 0건이라 아직 대조 불가다

# 4. 다섯 게이트 (각각 독립 실행)
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e

# 5. 실서버 E2E — 아래 「RED로 준비된 것」이 초록으로 바뀌어야 한다
INTEGRATION_WEB_URL=... INTEGRATION_TOKEN_FILE=... \
  pnpm playwright test e2e/integration-candidates.spec.ts
```

---

## 지금 임시인 것 — 전수

교체 시 **하나도 남기지 않습니다.**

| # | 무엇 | 어디 | 임시인 이유 |
|---|---|---|---|
| 1 | zod 스키마 전체 | `contract.ts` | 계약이 `openapi3.yml`에 없어 orval이 훅을 못 만듦 |
| 2 | `fetchContextCandidates()` | `api.ts` | 생성 훅 부재. **공용 mutator(`apiFetch`)는 지납니다** — 401 refresh를 우회하지 않으려고 |
| 3 | 쿼리 키 두 개 | `query-keys.ts` | 생성 키 부재 |
| 4 | `useQuery` 직접 호출 | `note-realtime-provider.tsx` | 생성 훅이 오면 `useGetNoteContextCandidates`로 |
| 5 | MSW 목 응답 | `lib/mocks/rest-handlers.ts` · `context-candidates.ts` | 계약 확정 시 모양 재확인 |
| 6 | **프롬프트 파일 마운트** | `deploy/integration/compose.realtime.yml` | APP-452 수정이 APP-466에 병합되면 제거 (그 파일 주석에 조건 있음) |
| 7 | **오버레이 compose** | `deploy/integration/compose.realtime.yml` | 세 브랜치가 머지되면 기본 `compose.yml`만으로 lane이 섬 |

**관대함도 임시입니다.** `contract.ts`가 `z.object`(모르는 필드 무시)인 것은 **배포가 web을
마지막에 두기 때문**입니다. 계약이 생성 타입으로 굳으면 그 완화의 근거가 약해지므로 그때
다시 판단합니다 — 지금은 서버가 필드를 먼저 실어 보내는 창에서 레일이 통째로 비지 않게 하는
것이 우선입니다.

---

## 계약이 와도 안 만드는 것

| 무엇 | 왜 |
|---|---|
| revision 이력 화면 | 계약만 받습니다. 「변경 내역」 펼침은 v1 밖 |
| 채택 출처 링크 (`sourceCandidates`) | server 조회 계약 전 임의 구현 안 함. 후속 이슈 |
| 기각 목록·사유 UI | **v1 제외 확정.** `scope.test.ts`가 부재를 고정합니다 |
