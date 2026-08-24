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

| 파일 | 무엇 | 계약이 오면 |
|---|---|---|
| **`contract.ts`** | zod 스키마 · 파생 타입 | **생성 타입 재수출로 바뀝니다.** 타입 이름은 그대로 유지합니다 |
| **`api.ts`** | `fetchContextCandidates()` — 공용 mutator를 지나는 직접 호출 | **삭제.** orval 생성 훅으로 대체 |
| **`query-keys.ts`** | 수동 쿼리 키 | **삭제.** orval 생성 키로 대체 |

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

# 3. contract.ts 를 재수출로 바꾸고 api.ts · query-keys.ts 삭제
#    provider 의 useQuery 를 생성 훅으로 교체

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
