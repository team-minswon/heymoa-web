# APP-115 codex 게이트 기록

`codex exec review --base dev`. 지적은 전부 실재해 전부 반영했다.

## R1 — 2건 P2

### 1. 목 연결이 authorize로 가 실패한다 (workspace-integrations-settings.tsx)

connect가 `buildUrl(authorize)`로 최상위 이동하는데 **MSW는 최상위 내비게이션을 못 가로챈다**
(app/mock-oauth·rest-handlers에 명시). 목에서는 authorize가 302를 못 주고 연결이 실패한다.

**반영:** `shouldEnableMocking()`이면 목 승인 화면(`/mock-oauth?...`)으로 바로 보내고, 실서버면
`buildUrl(authorize)`로 이동한다.

### 2. 역할 조회 실패가 조작을 영영 숨긴다 (workspace-integrations-settings.tsx)

`useGetWorkspaceMembers` 실패를 빈 멤버 목록으로 접어 `roleKnown`이 거짓이 되면, ADMIN이
연결·해제를 영영 못 보고 오류·재시도도 없다.

**반영:** `membersQuery.isError`를 잡아 조작을 숨기고 "권한을 확인하지 못했습니다 + 다시 시도"
안내를 보인다. MEMBER 안내(관리자만)도 역할 불명일 땐 뜨지 않게 했다.

## R2 — 1건 P2

### 겹친 해제가 상태를 stale로 남긴다 (workspace-integrations-settings.tsx)

per-call `onSuccess`에 무효화를 걸어, 두 provider를 연달아 해제하면 TanStack이 마지막 것만
콜백을 돌려 앞이 성공·뒤가 실패하면 무효화가 안 돌고 성공한 해제가 "연결됨"으로 남는다.

**반영:** 무효화를 **훅 레벨 `onSuccess`**로 옮기고(모든 mutation에서 실행), 해제가 도는 동안엔
**모든** 카드의 연결·해제 버튼을 잠근다(겹침 방지).

## R3 — 2건 P2

### 1. void한 무효화가 조작을 일찍 연다 (workspace-integrations-settings.tsx)

훅 onSuccess가 `invalidateQueries`를 `void`해 mutation이 재조회 전에 pending을 벗어나, 느린
재조회 동안 카드는 연결됨인데 버튼이 다시 열려 중복 해제가 나갈 수 있었다.

**반영:** 무효화 promise를 돌려줘 새 상태가 올 때까지 pending을 유지한다.

### 2. OAuth 이동이 토큰 갱신을 건너뛴다 (workspace-integrations-settings.tsx)

액세스 토큰이 만료됐어도 리프레시가 살아 있을 때, authorize로의 최상위 이동이 proxy·apiFetch의
401 갱신을 안 타 백엔드 401 화면에 떨어졌다.

**반영:** 실서버 이동 전에 `refreshAuthOnce()`로 먼저 갱신한다(목은 인증 없이 /mock-oauth).

## R4 — 1건 P2

### 리프레시 실패해도 authorize로 내보낸다 (workspace-integrations-settings.tsx)

`refreshAuthOnce()` 실패(리프레시 토큰 만료)를 `catch`로 삼키고도 보호된 authorize로 이동해,
계약상 리다이렉트가 아니라 JSON 401을 주는 그 엔드포인트의 raw 오류 화면에 사용자가 떨어졌다.

**반영:** 갱신 실패 시 이동을 중단하고 `notifyAuthStateChanged({reason:"unauthenticated"})`로
기존 미인증 흐름(재로그인)을 태운다.

## R5 — 2건 P2

R4의 `notifyAuthStateChanged` 접근이 낳은 두 문제:

### 1. 일시 실패에도 인증을 지운다

`refreshAuthOnce()`는 401(만료)과 네트워크·5xx(일시)를 구분 못 해, 일시 실패에도 unauthenticated로
멀쩡한 인증을 지웠다.

### 2. 만료여도 로그인으로 이동하지 않는다

`unauthenticated` 이벤트는 상태만 지우고 이동하지 않아, 다이얼로그가 열린 채 조작만 사라져
사용자가 갇혔다.

**반영:** 갱신을 직접 fetch해 **status로 가른다** — 2xx면 authorize로 이동, 401이면 `/`로 실제
이동(proxy가 미인증 처리), 그 밖(네트워크·5xx)이면 인증을 지우지 않고 재시도 토스트.

## R6 — 2건 P2

### 1. refresh 400도 만료다 (fetcher.ts)

계약은 리프레시 쿠키가 없거나 무효면 400 BAD_REQUEST를 준다(proxy도 400·401 둘 다 무효로
본다). 401만 만료로 봐서 400이 일시 오류로 새어 재시도 토스트 루프에 갇혔다.

### 2. 직접 fetch가 단일 비행 락을 우회한다 (workspace-integrations-settings.tsx)

connect가 `refreshAuthOnce`를 안 쓰고 직접 refresh해, 다른 요청·더블클릭과 겹치면 로테이팅
리프레시 토큰으로 중복 갱신이 나가 하나가 인증을 무효화할 수 있었다.

**반영:** `refreshAuthOnce`를 **status-aware**로(400/401 → `AuthRefreshError.expired`) 만들고
connect가 그 공유 단일 비행을 쓴다. 만료면 `/`로 이동, 일시면 인증 유지+토스트.

## R7 — 통과

"consistent with the API contract and project conventions." 6라운드 / 지적 11건 전부 반영.
대부분이 authorize 최상위 이동의 토큰 갱신 경계(만료 vs 일시, 단일 비행, 400/401).
