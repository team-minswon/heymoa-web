# 제품 면 언어 결정과 계정 언어 연동 — 구현 순서

- 이슈: [APP-1285](https://linear.app/minswon/issue/APP-1285)
- spec: docs `docs/app-1285/product-language:projects/PRO-66-웹-국제화/spec/APP-1285/spec.md` @ `3329ebb`
- 프로젝트 브랜치: `pro-66/웹-국제화` ← `dev`
- APP 브랜치: `feature/app-1285/product-language` ← `pro-66/웹-국제화`
- 병합: APP → `pro-66/웹-국제화`는 squash, `pro-66/웹-국제화` → `dev`는 rebase. 아래 마지막 관문을 통과하고 사용자 검토를 받은 뒤입니다
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 어긋나지 않습니다. web 미러 `openapi3.yml`에 `CurrentUserResponse.data.language`, `AuthSessionResponse.data.user.language`, `updateCurrentUser`(`PATCH /v1/users/me`)가 이미 있습니다. 생성 훅은 `lib/api/generated/users/users.ts`에 있고, 세션 파서 `lib/auth/session-probe.ts`의 `userSchema`도 `language`를 읽습니다. web이 새로 발행하는 계약은 없습니다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | spec은 건수를 적지 않고 `rg` 명령을 가리킵니다. 이번에 돌린 결과는 `formatAppDate`·`"ko-KR"` 호출부 19파일입니다(`lib/format/date.ts` 제외). 브라우저 `Accept-Language` 자동 전송은 spec에 짐작으로 적혀 있고, 이 plan도 그 전제에 기대지 않습니다. 헤더를 명시로 덮어씁니다 |
| 경계 | 영향받는 호출자·마이그레이션·테스트 더블을 모두 확인했나 | **spec과 코드가 한 군데 달랐고 spec을 먼저 고쳤습니다.** 랜딩 홈이 `dynamic = "force-static"`(APP-1418)이라 페이지에서 헤더를 읽을 수 없어서, 첫 방문 이동을 `next.config.ts` redirects로 옮겼습니다(`3329ebb`). 테스트 더블: MSW에 `PATCH /v1/users/me` 핸들러가 없고(`lib/mocks/rest-handlers.ts`), 목 유저의 `language`는 `null`입니다(`lib/mocks/mock-user.ts`). 4단계에서 더합니다. 마이그레이션은 없습니다 |
| 되돌리기 | 복구 비용은 얼마인가 | web 커밋 revert로 화면은 돌아갑니다. 계정 `language`는 server에 남고 AI가 계속 읽습니다. 이 어긋남은 spec 「실패와 되돌리기」가 받아들였습니다. 단계 1~4는 계정을 쓰지 않아 되돌려도 남는 데이터가 없습니다. 계정을 쓰기 시작하는 것은 5단계(첫 로그인 저장)부터입니다 |
| 사람에게 물은 것 | spec의 열린 질문에 답이 났나 | 둘 다 코드로 답했습니다. ① 데스크톱 회의 녹음도 메인 웹 창의 `RecordingProvider`가 소유합니다(`components/transcription/recording-provider.tsx`가 `lib/desktop/recording-runtime.ts`의 `createRecordingSession`을 씁니다). 그래서 `isRecordingLive` 하나로 잠금이 걸립니다. ② `apiFetch`는 `RequestInit`의 나머지 필드(`...requestOptions`)를 `fetch`에 넘기므로 `keepalive`가 실립니다. 다만 문서가 떠난 뒤에는 401 → refresh → 재시도가 돌 수 없습니다. 랜딩은 `AuthProvider`가 로드 때 세션을 확인해 토큰이 대개 새것이라, spec이 받아들인 "푸터 저장 실패 미감지"의 범위 안입니다 |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `lib/i18n/accept-language.ts` | (신규) | `localeFromAcceptLanguage(header)` 순수 함수, 그리고 같은 규칙의 정규식 문자열 `ACCEPT_LANGUAGE_EN_ONLY`(next.config가 읽습니다). Next 서버 API를 들이지 않습니다 |
| `lib/i18n/cookie.ts` | (신규) | `writeLocaleCookie(locale)`. 지금 `language-switcher.tsx` 안에 있는 `rememberLocale`을 옮겨 설정·동기화·푸터가 같이 씁니다 |
| `lib/i18n/current.ts` | `cookieLocale()`·`marketingLocale()` | `productLocale()` 추가: `getCurrentUserForSsr()`의 `language` → 쿠키 → `Accept-Language` → ko |
| `lib/i18n/display-locale.ts` | (신규) | `displayLocale(locale)`: ko → `ko-KR`, en → `en-US`. 날짜 호출부가 씁니다 |
| `i18n/request.ts` | `lang()`이 없으면 ko | 제품 루트에서 `productLocale()` |
| `app/(product)/layout.tsx` | `AppShell locale="ko"` | `locale={await productLocale()}` |
| `lib/auth/server.ts` | SSR 세션 조회가 `Cookie`만 보냄 | `Accept-Language`에 쿠키 → 요청 헤더 판정 언어를 실음 |
| `lib/api/fetcher.ts`, `lib/api/sse.ts` | `Accept-Language` 없음 | `document.documentElement.lang`을 `Accept-Language`로. 호출부 헤더가 있으면 그것을 씁니다. 서버 환경에서는 붙이지 않습니다 |
| `lib/mocks/rest-handlers.ts`, `lib/mocks/db.ts` | `PATCH /v1/users/me` 없음 | 핸들러와 `mockDb.updateCurrentUserLanguage()`. 세션·`users/me` 응답이 저장된 값을 실음 |
| `components/auth/language-sync.tsx` | (신규) | `AuthProvider` 아래에서 사용자가 확정되면 한 번 계정·쿠키를 맞춥니다. 판정은 `lib/i18n/account-sync.ts`(신규, 순수)의 `decideLanguageSync(account, cookie, screen)` |
| `app/providers.tsx` | `AuthProvider` 등 | `LanguageSync`를 `AuthProvider` 안쪽에 마운트 |
| `lib/workspace/settings-url.ts` | `SETTINGS_SECTIONS` | `"language"` 추가 |
| `components/settings/settings-dialog.tsx` | 계정 묶음: 내 계정·알림·내 MCP 연결 | 「내 계정」 다음에 「언어 · Language」(`Languages` 아이콘) |
| `components/settings/language-settings.tsx` | (신규) | 선택, pending, 녹음 중 잠금 안내, AI 적용 안내. 성공하면 쿠키를 쓰고 `location.reload()` |
| `components/heymoa/landing/language-switcher.tsx` | 쿠키만 씀 | 로그인 상태면 `updateCurrentUser`를 `keepalive`로 함께 보냄 |
| `next.config.ts` | 언어 이동 없음 | `/` → `/en` 307. 조건은 `has` 헤더 `accept-language` = `ACCEPT_LANGUAGE_EN_ONLY`, `missing` 쿠키 `heymoa-lang` |
| `components/auth/auth-provider.tsx` | 로그아웃 뒤 `/` | `localePath(현재 언어, "/")` |
| `formatAppDate`·`"ko-KR"` 호출부 19파일 | 대부분 locale 생략 | 호출부가 `displayLocale(useLocale())`를 넘깁니다. 순수 함수(`lib/notes/minutes/model.ts` 등)는 `locale` 인자를 받게 바꿉니다. 목록은 `rg -n 'formatAppDate\(\|"ko-KR"' app components lib -g '!*.test.*' -g '!lib/format/date.ts'` |
| `app/(product)/not-found.tsx`, `app/(product)/error.tsx` | `locale="ko"` 고정 | 제품 루트 언어(`productLocale`·`useLocale`). 문구는 이미 `common.notFound`·`common.error`에 있습니다 |
| `messages/ko/common.json`, `messages/en/common.json` | `language` 등 | `language.settings.*`, 제품 셸 키 추가 |
| `harness/v002-2026-08-13/rules/error-loading.md` | 서버 문구 정책 | "서버 문구는 `Accept-Language`(화면 언어)로 온다" 한 줄 |
| `e2e/product-language.spec.ts` | (신규) | spec 성공 기준 중 e2e 항목 |

배치를 정한 것:

- 언어 판정은 두 군데로 나뉩니다. 서버용 `lib/i18n/current.ts`는 `next/headers`를 쓰고, `lib/i18n/accept-language.ts`는 의존성이 없어 `next.config.ts`·클라이언트·테스트가 같이 읽습니다.
- 계정 동기화는 `AuthProvider` 안에 넣지 않고 형제 컴포넌트로 둡니다. `AuthProvider`는 세션 게이트·로그아웃 상태를 소유하는 모듈이라, mutation을 섞으면 테스트 더블이 늘어납니다.
- 설정의 언어 탭 문구는 새 이름공간을 만들지 않고 `common`에 둡니다. 설정 화면 전체 이름공간은 APP-1286이 정합니다.

## 순서

### 1. 브라우저 언어 판정 함수와 쿠키 헬퍼

- 바꾸는 것: `lib/i18n/accept-language.ts`, `lib/i18n/cookie.ts`, `lib/i18n/display-locale.ts`와 각 테스트. `language-switcher.tsx`가 새 쿠키 헬퍼를 씁니다(동작은 같음)
- 검증: `pnpm vitest run lib/i18n components/heymoa/landing`. 표본 헤더 표(`en-US,en`, `en-US,en;q=0.9,ko;q=0.8`, `ko-KR`, `ja`, 빈 값, `EN-us`)에서 함수 결과와 정규식 결과가 같은지 대조합니다
- 되돌리기: revert 한 번. 아직 아무도 판정을 쓰지 않습니다

### 2. 제품 루트 언어 결정

- 바꾸는 것: `lib/i18n/current.ts`의 `productLocale()`, `i18n/request.ts`, `app/(product)/layout.tsx`, `lib/auth/server.ts`의 `Accept-Language`
- 검증: `pnpm vitest run lib/i18n i18n app/\(product\)`, `pnpm typecheck`. 목 모드 dev에서 `curl -H 'Accept-Language: en' -b 'heymoa-lang=' localhost:3000/w`의 `<html lang>`을 봅니다
- 되돌리기: revert 한 번. 화면 문구는 대부분 아직 한국어라, 영어 브라우저에서도 `lang`·next-intl 키만 바뀝니다

### 3. 클라이언트 요청의 `Accept-Language`

- 바꾸는 것: `lib/api/fetcher.ts`, `lib/api/sse.ts`와 테스트
- 검증: `pnpm vitest run lib/api`. `document.documentElement.lang = "en"`에서 요청 헤더가 `en`이고, 호출부가 헤더를 주면 그것이 이기는지 봅니다
- 되돌리기: revert 한 번

### 4. 목의 계정 언어 저장

- 바꾸는 것: `lib/mocks/rest-handlers.ts`, `lib/mocks/db.ts`와 `rest-handlers.test.ts`. 잘못된 값은 400 봉투(계약의 `BAD_REQUEST`)로 응답합니다
- 검증: `pnpm vitest run lib/mocks`
- 되돌리기: revert 한 번

### 5. 로그인 뒤 계정·쿠키 맞추기

- 바꾸는 것: `lib/i18n/account-sync.ts`, `components/auth/language-sync.tsx`, `app/providers.tsx`와 테스트. 계정 저장은 `meta: { suppressErrorToast: true }`로 보냅니다
- 검증: `pnpm vitest run lib/i18n components/auth`. 판정 표 세 줄(계정 있음·쿠키 다름 / null·쿠키 / null·없음)과 "같은 문서에서 한 번만"을 확인합니다
- 되돌리기: revert 한 번. 이미 저장된 계정 값은 남습니다(spec이 받아들임)

### 6. 설정의 「언어 · Language」 탭

- 바꾸는 것: `lib/workspace/settings-url.ts`, `components/settings/settings-dialog.tsx`, `components/settings/language-settings.tsx`, `messages/<ko|en>/common.json`과 테스트
- 검증: `pnpm vitest run components/settings lib/workspace`. 녹음 중 비활성과 안내, pending 중 다른 선택지 비활성, 성공 뒤 `location.reload` 호출, 실패 시 미호출을 확인합니다. 1440·1024 목 모드에서 탭 목록과 안내 문장의 줄바꿈을 렌더해 봅니다(rule `ui-text-layout`)
- 되돌리기: revert 한 번

### 7. 랜딩 푸터 계정 저장과 홈 첫 방문 이동

- 바꾸는 것: `components/heymoa/landing/language-switcher.tsx`, `next.config.ts`
- 검증: `pnpm vitest run components/heymoa/landing`, 목 모드 dev에서 `curl -sI -H 'Accept-Language: en-US,en' localhost:3000/`가 `307 location: /en`이고, `ko`가 섞이거나 쿠키가 있으면 200인지 봅니다
- 되돌리기: revert 한 번. 이동은 307이라 캐시에 남지 않습니다

### 8. 로그아웃 목적지

- 바꾸는 것: `components/auth/auth-provider.tsx`와 테스트
- 검증: `pnpm vitest run components/auth`
- 되돌리기: revert 한 번

### 9. 날짜 표시 locale

- 바꾸는 것: 위 `rg` 목록의 19파일. 순수 함수는 `locale` 인자를 추가하고 호출부를 고칩니다
- 검증: `pnpm vitest run lib components`, `pnpm typecheck`. `lib/format/date.test.ts`에 서울 자정 전후 시각을 en으로 포맷해도 날짜 키가 같은지 확인하는 테스트를 더합니다
- 되돌리기: revert 한 번

### 10. 제품 404·오류 화면의 언어

- 바꾸는 것: `app/(product)/not-found.tsx`, `app/(product)/error.tsx`. 사이드바·토스트 fallback은 아래 「안 하는 것」으로 옮겼습니다
- 검증: `pnpm vitest run app i18n`, 11단계 e2e에서 영어 계정으로 없는 노트 주소를 엽니다
- 되돌리기: revert 한 번

### 11. 규칙 문서와 e2e

- 바꾸는 것: `harness/v002-2026-08-13/rules/error-loading.md`, `e2e/product-language.spec.ts`
- 검증: `pnpm exec playwright test e2e/product-language.spec.ts` 단독 실행(전체 e2e는 마지막 관문에서 한 번)
- 되돌리기: revert 한 번

## 마지막 관문

11단계가 끝난 뒤 한 번, 레포의 다섯 게이트를 통째로 돌립니다. 레지스트리 검증 `pnpm test:run && pnpm verify`는 e2e를 포함하지 않으므로 `pnpm test:e2e`를 더합니다(레포 `CLAUDE.md`).

```
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

이 레포는 PR과 CI가 없어서 **이것이 유일한 관문입니다.** 여기서 걸리지 않으면 아무 데서도 걸리지 않습니다. `pnpm build`와 dev를 번갈아 돌린 뒤 e2e가 무더기로 깨지면 `.next`를 지우고 다시 봅니다(rule `architecture`).

그 뒤 `codex exec review --base pro-66/웹-국제화`로 리뷰를 받고, P1·P2를 고친 다음 사용자 검토를 받습니다. 실제 server로 확인하는 항목(영어 오류 문구)은 로컬 server를 띄워 수동으로 봅니다.

## 안 하는 것

- 사이드바(`components/workspace/workspace-sidebar.tsx`)와 토스트 fallback(`lib/query/query-client.ts`) 문구: 구현 중에 APP-1286으로 옮겼습니다. 사이드바 문구는 대부분 제품 용어(프로젝트·노트·할 일)라 APP-1286이 먼저 정하는 용어집 없이 옮기면 다시 고치게 됩니다. 토스트 fallback은 React 밖 모듈이라 fetcher의 web 자체 오류 문구와 같은 방식으로 함께 옮깁니다
- 날짜를 한국어 문장으로 조립하는 순수 함수(`dayLabel`, `note-groups`, 회의록 모델 등)의 locale: APP-1286. Linear ③ 댓글 참고

- 화면별 문구 번역과 윤문: APP-1286. 이번에는 셸 세 파일만 옮깁니다
- `lib/api/fetcher.ts`의 web 자체 오류 문구(시한 초과 등) 영어판: React 밖 모듈이라 메시지를 받는 방식이 따로 필요합니다. APP-1286에서 web 자체 오류를 옮길 때 같이 합니다
- 데스크톱 `reportLanguage`: APP-1287
- 프로젝트 문서(`architecture.md` 1·5절) 갱신: 마무리(`finalizing-an-issue`)에서 합니다
