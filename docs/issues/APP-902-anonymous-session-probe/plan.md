# 첫 방문 로그인 탐침과 세션 보존

- 이슈: [APP-902](https://linear.app/minswon/issue/APP-902)
- spec: docs `origin/docs/app-902/anonymous-session-probe:projects/_미분류/APP-902/spec.md` @ `1e5767b`
- 프로젝트 브랜치: 없음
- APP 브랜치: `feat/app-902/anonymous-session-probe` ← local dev `a5f355e`
- 병합: docs main 반영 뒤 로컬 dev squash. 원격 작업 브랜치·PR 없이 부모가 승인된 dev/main 배포를 조율한다.
- 검증: `pnpm test:run && pnpm verify`, E2E·독립 리뷰

## spec 검토 결과

| 관점 | 확인 결과 |
|---|---|
| 계약 | APP901 서버 owner가 생성한 docs `origin/docs/app-901/session-probe:contracts/specs/openapi3-server.yml` @ `31e2fb9`를 읽었다. public mirror는 68 paths/89 schemas이며 Orval 타입을 생성했다. |
| 실측 | 코드의 첫 방문 refresh 분기를 확인했다. Grafana 실패 전체를 익명으로 단정하지 않는다. |
| 경계 | api getMe, provider refreshUser, callback, desktop 로그인 후 provider 재조회와 MSW·E2E를 확인한다. |
| 되돌리기 | web 소비자부터 revert하고 서버 신규 endpoint를 제거한다. DB 변경은 없다. |
| 사용자 결정 | 추가 쿠키 없이 서버 읽기 상태를 사용하고 일시 오류 캐시 보존을 승인했다. |

## 건드리는 것

- `openapi3.yml`·`lib/api/generated/`: 서버 owner 산출물에서 public 계약 미러 및 Orval 생성
- `lib/auth/api.ts`·새 세션 parser: nullable getMe 및 유효 상태 검증, 후보에서만 refresh
- `lib/auth/server.ts`: 읽기 계약 소비, SSR 부재를 브라우저 권위로 사용하지 않음
- `components/auth/`: provider 캐시 보존, callback 익명 성공 거부
- `lib/mocks/rest-handlers.ts` 및 관련 테스트·E2E: 세션 응답과 첫 방문 요청 행동

## 순서

### 1. 회귀와 provider 실패 경계

기존 refreshUser가 네트워크 실패에 캐시를 지우는 실패 회귀를 추가하고 confirmed null과 실패를 분리한다. callback null은 실패이며 제품 호출을 하지 않는다. 집중 provider/callback 테스트로 확인한다.

### 2. 서버 생성 계약 소비

APP901 owner의 OpenAPI 미러를 읽어 `/internal`을 제외하고 기존 public mirror 규칙으로 갱신한다. Orval 생성 타입만 사용한다. getMe는 세션 상태를 파싱하고 candidate일 때 refreshAuthOnce·단일 재조회를 수행한다. anonymous 및 dead refresh만 null, network/5xx/잘못된 데이터는 예외다. 반복 candidate는 추가 refresh 없이 실패한다.

### 3. mock과 브라우저 연결

MSW가 고정된 authenticated 세션을 제공하도록 바꾼다. 기존 SSR mock은 초기 사용자로 인증되어 익명 hydration을 숨기므로, 별도 `playwright.auth.config.ts`에서 mock을 끈 Next 서버로 first-visit refresh 요청 0회를 검증한다. SSR 전달 쿠키 부재가 client 탐침을 막지 않는지 확인하고 desktop 로그인 후 재조회·callback 동작을 유지한다.

## 마지막 관문

집중 회귀 후 `NODE_OPTIONS=--no-experimental-webstorage pnpm test:run --maxWorkers=2`, `pnpm verify`, `pnpm exec playwright test --workers=2` 및 `pnpm exec playwright test --config playwright.auth.config.ts`를 수행한다. 두 E2E 서버는 `.next`를 공유하므로 순차 실행한다. 독립 Codex 리뷰 뒤 docs main과 로컬 dev를 부모와 조율해 반영한다. 서버 endpoint 배포가 먼저며 web 배포는 부모가 맡는다. 확인하지 않은 운영 실패 감소나 실물 로그인은 성공으로 적지 않는다.

## 안 하는 것

제품 transport/SSE 401·MCP·proxy refresh 정책, OAuth·새 로그인 쿠키, 데스크톱 바이너리 변경과 외부 배포는 하지 않는다.

## 실행 결과

- owner 계약: APP901 docs checkpoint `31e2fb9`, docs main `232f8f0` 동일 생성 계약을 소비했다.
- 단위: `NODE_OPTIONS=--no-experimental-webstorage pnpm test:run --maxWorkers=2` — 155 files/2,071 tests 통과.
- `pnpm verify` — lint/typecheck/production build 통과.
- 기존 MSW E2E: `pnpm exec playwright test --workers=2` — 84 tests 통과.
- mock-disabled hydration: `pnpm exec playwright test --config playwright.auth.config.ts` — 3 tests 통과. API 응답은 합성 fixture이며 실제 운영 Google·native 로그인이나 쿠키 jar 검증을 대신하지 않는다.
- 독립 리뷰: `codex exec review --base a5f355ee47b52c3399ab7e6c5a811d9fed78c943` — 새 명확한 결함 없음, reviewer는 테스트를 실행하지 않았으며 위 검증은 구현 작업자가 실행했다.
- 첫 full unit 실행에서 새 공개 경로 수와 고정 mock 유저 이미지의 표본 목록을 갱신해야 하는 실패를 확인했고, 생성 계약과 동일 사용자 표본 근거를 반영한 뒤 전체를 다시 통과했다.
- 미확인: 실제 운영 Google 로그인 복귀와 배포 후 InvalidRefreshTokenException 감소. APP901 서버 선행 배포 및 웹 통합·배포는 부모 작업자가 조율한다.
