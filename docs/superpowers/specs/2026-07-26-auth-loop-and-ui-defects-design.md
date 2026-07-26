# 인증 만료 루프 · 로그 관측 · UI 결함 조사

> 결함 넷을 함께 조사한 기록이다. 넷은 독립 이슈로 나가고, 이 문서는 **실측 사실과 분할 근거**를 담는다.
> 서로 얽힌 곳이 하나 있어(A ↔ B) 순서를 정하려면 같이 봐야 했다.

## 1. 조사한 것

| 증상 | 어디서 |
|---|---|
| refresh 토큰이 없는데 갱신 요청을 무한히 보낸다 | 노트 상세 화면 |
| CloudWatch를 붙이고 싶다 — 월 비용, 도입 방법, docker 변경, 배포 주의, 로그 적정성 | heymoa-server |
| 개인·노트 챗봇이 스크롤도 안 되고 하단으로 따라가지도 않는다 | 챗봇 패널 2종 |
| 노트 full 화면에서 사이드바를 눌러도 화면이 안 바뀐다 | 워크스페이스 사이드바 |

## 2. 이슈 분할

| 이슈 | 레포 | 관계 |
|---|---|---|
| A. 인증 만료 시 무한 refresh 루프 | heymoa-web(주) + heymoa-server | 먼저 |
| B. CloudWatch 도입 + 로그 감량 | heymoa-server | **A에 blocked** |
| C. 챗봇 패널 스크롤 | heymoa-web | 독립 |
| D. 노트 full에서 사이드바 프로젝트 선택 무반응 | heymoa-web | 독립 |

**B가 A에 blocked인 이유가 이 분할의 핵심이다.** CloudWatch 요금은 ingestion(GB당)이 지배하는데, 지금 로그량은 A의 루프와 스택트레이스 노이즈가 섞인 값이다. 이 상태로 도입하면 비정상 로그량 기준으로 요금을 산정하게 되고, A를 고치는 순간 그 숫자가 무의미해진다. **감량 → 측정 → 도입** 순서여야 한다.

**C와 D를 합치지 않는다.** 둘 다 "워크스페이스 UI가 이상하다"지만 원인 계층이 다르다. C는 CSS 한 줄이고, D는 상태 소유권과 라우팅 설계(`docs/frontend-architecture.md`의 상태 경계)를 건드린다. 한 PR에 묶으면 무관한 두 수정이 섞이고 리뷰 성격도 다르다.

## 3. 검증 이력 — 틀렸던 주장 둘

**이 조사의 1차 분석은 두 곳이 틀렸다.** codex 리뷰 두 번으로 잡았고, 기록해 둔다. 고친 사실을 그대로 이슈에 옮기지 않기 위해서다.

| 처음 주장 | 실제 | 어떻게 잡았나 |
|---|---|---|
| `clearAuthenticatedState()`의 `removeQueries`가 즉시 재요청을 유발해 **자기순환 루프**가 된다 | **성립하지 않는다.** `removeQueries`는 활성 쿼리를 즉시 재요청시키지 않고, 두 번째 `setUser(null)`은 값·status가 같아 재렌더가 없어 고리가 끊긴다 | codex(web) Q1 |
| `InvalidRefreshTokenException`이 400 **또는** 401로 나간다 | **항상 400이다.** 전용 `AppErrorType` 매핑이 없어 fallback `BAD_REQUEST`로 떨어진다. E2E 테스트도 400을 고정한다 | codex(server) 주장 3 |

두 번째는 수정 방향에 영향이 있다 — 웹의 만료 판정이 **fallback 매핑에 의존**하고 있다는 뜻이다. 나중에 누가 전용 매핑을 다른 상태로 붙이면 판정이 조용히 깨진다.

## 4. A — 인증 만료 시 무한 refresh 루프

### 실측

`fetcher.ts`의 1회 재시도 가드(`hasRetried`)와 `refreshAuthOnce`의 동시요청 dedupe는 **정상이다.** 문제는 그 위에 있다.

| # | 무엇 | 실측값 |
|---|---|---|
| 1 | **폴링이 오류를 모른다** | `refetchInterval` 5곳이 지속 오류에도 계속 돈다. `note-panel`은 실패해도 5초, `note-summary`는 마지막 상태가 PENDING/RUNNING이면 계속, `transcript-view`·`recording-provider`·`shared-chat-panel`은 로컬 상태만 유지되면 오류와 무관하게 계속 |
| 2 | **전역 재시도 정책이 없다** | `makeQueryClient()`에 `queries.retry`가 없어 TanStack Query v5 기본 3회가 적용된다. 쿼리 호출부 **31곳 중 `retry` 지정은 2곳**(`auth-provider`·`note-summary`) |
| 3 | **서킷 브레이커가 없다** | `refreshPromise`가 `.finally`에서 `null`로 돌아가 "이미 만료됐다"는 기억이 없다. 매 파도가 새로 시작한다 |
| 4 | **에러 타입이 뭉개진다** | `AuthRefreshError.expired`를 400/401로 계산해놓고 `fetcher.ts`의 `request()`가 버리고 문자열 `Error`를 새로 던진다. 상위에서 만료와 일시 오류를 구분할 수단이 `error.message` 문자열뿐이다 |

1이 동력, 2가 증폭기, 3이 정지 장치 부재, 4가 정책을 못 쓰게 막는 선행 조건이다.

정상으로 확인된 것: SSE(`lib/api/sse.ts`)와 auth API(`lib/auth/api.ts`)는 401 재시도 1회. `proxy.ts`와 `useChatStream`에는 자동 재시도 루프가 없다.

### 서버 쪽

리프레시 쿠키가 없으면 `InvalidRefreshTokenException` → `GlobalExceptionHandler.handleBaseException`이 `log.warn("BaseException: {}", e.message, e)`로 **전체 스택트레이스**를 찍는다.

**다만 A 루프의 실제 로그 경로는 여기가 아니다.** 만료된 access 쿠키로 보호 API를 때리는 401이 훨씬 많고, 그건 `RestAuthenticationEntryPoint`·`RestAccessDeniedHandler`에서 요청마다 전체 스택을 남긴다. 보호 API 기본값이 `authenticated`라 대상이 외부 API 전체다.

이 둘은 4xx 로그 정책이라는 한 덩어리라서 **B에서 함께 다룬다.** A에서 인증 경로만 떼어 고치면 같은 파일을 두 이슈가 건드린다.

### 수정 방향

**① 세션 게이트 (`lib/auth/session-gate.ts` 신설)**

`live` / `expired` 두 상태. `refreshAuthOnce`가 **`expired`로** 실패하면 연다. 여는 동작은 **멱등**이라 몇 곳에서 불리든 뒤따르는 처리는 한 번만 일어난다 — 토스트가 최대 29개 뜨는 것을 1개로 만드는 장치다.

네트워크 오류(`status === null`)로는 **열지 않는다.** 지하철에서 잠깐 끊긴 사용자가 작업 중인 노트에서 튕기면 안 된다. `AuthRefreshError.expired`가 이미 이 구분을 계산해두고 있다.

**② 게이트가 열리면 (딱 한 번)**

폴링·재시도 중단 → `POST /v1/auth/logout` (best-effort) → sonner 토스트 1개 → `router.replace("/")`.

HttpOnly 쿠키는 **JS가 못 지운다.** `logout`이 유일한 수단이고, `LogoutService`가 토큰 없음·세션 없음 모두 조용히 `return`하므로 안전하다(예외를 안 던져 서버 로그도 안 더럽힌다). 호출이 실패해도 이동은 진행하고, 남은 쿠키는 다음 SSR에서 `proxy.ts`의 `clearAuthCookies()`가 정리한다.

로그인 전용 페이지가 없으므로 목적지는 `/`다.

**③ 전역 재시도 정책 (`makeQueryClient()`)**

```ts
retry: (failureCount, error) =>
  isAuthError(error) ? false : failureCount < 2
```

31곳을 개별로 고치지 않는다. **선행 조건은 ④다** — 지금은 판별할 타입이 없다.

**④ 에러 타입 보존** — `request()`가 `AuthRefreshError`를 버리지 않고 올린다. ①과 ③이 여기서 만난다.

**⑤ 폴링이 게이트를 본다** — 게이트가 열리면 `refetchInterval`이 멈춰야 한다. 1이 동력이므로 이것이 빠지면 나머지가 다 들어가도 루프가 남는다.

**⑥ mutation 토스트 겹침 제거** — 게이트가 열린 동안 전역 `MutationCache.onError`는 조용히 넘어간다. 세션 만료 토스트가 이미 떴는데 "요청을 처리하지 못했습니다"가 겹칠 이유가 없다.

**⑦ sonner 전역** — `position="top-right"`(현재 `position` 미지정이라 기본값 bottom-right) + `closeButton`.

**⑧ 서버: 만료 계약 못박기** — `InvalidRefreshTokenException`에 전용 `AppErrorType` 매핑을 추가해 400을 fallback이 아니라 명시 계약으로 만든다. 웹의 만료 판정이 fallback에 의존하지 않게 한다.

### 안 하는 것

- `returnTo` 복귀 경로 — home 이동으로 정했다. 인증 플로우를 건드리지 않는다
- 갱신 백오프·다중 재시도 — 1회로 충분하고 이미 그렇다
- 호출부 31곳 개별 수정 — 전역 정책 한 곳으로 끝낸다

### 검증

만료 시 갱신 요청이 **정확히 1회**인지, 토스트가 **정확히 1개**인지, **네트워크 오류로는 게이트가 안 열리는지** 셋이 회귀 방지의 핵심이다.

## 5. B — CloudWatch 도입 + 로그 감량

### 비용은 추정하지 않고 측정한다

ingestion(GB당)이 지배하고 저장은 부수적이다. 그래서 "월 얼마"는 **로그량**을 알아야 나온다.

측정할 데이터가 이미 EC2에 있다 — logback이 `/var/log/heymoa/`에 14일치를 롤링으로 쌓고 있다. 압축분을 포함해 일평균 바이트를 내면 GB/월이 바로 나온다. 추정이 아니라 실측이다.

**서울(ap-northeast-2) 단가를 이 문서에 적지 않는다.** AWS 요금 페이지가 리전별 표를 내주지 않고 조사 시점에 자격증명이 없어 권위 있게 가져오지 못했다. 기억으로 쓴 숫자를 문서에 박으면 그게 근거로 굳는다. 단가는 작업 시점에 콘솔에서 리전을 골라 확인하거나 `aws pricing get-products --service-code AmazonCloudWatch`로 가져온다.

### 순서: 감량 → 측정 → 도입

지금 측정하면 아래가 다 섞인 값이 나온다.

| 감량 대상 | 성격 |
|---|---|
| 모든 4xx의 전체 스택트레이스 (`handleBaseException`) | 정상 업무 흐름인 403·404·409까지 |
| 401/403의 전체 스택트레이스 (`RestAuthenticationEntryPoint`·`RestAccessDeniedHandler`) | **보호 API 전체가 대상.** A 루프의 실제 경로 |
| `analyses/latest` 폴링의 404 스택 | 분석 잡 생성 전 폴링마다 `AnalysisJobNotFoundException`. **A와 무관한 독립적 로그 홍수** |
| OAuth2 실패 스택 (`OAuth2AuthenticationFailureHandler`) | 사용자가 동의를 취소한 정상 흐름 |
| 갱신 성공 INFO (`RefreshTokensService`) | 사용자당 갱신 횟수만큼 |

**판정 기준 한 줄: 스택트레이스는 *예상 못 한* 실패에만.** `AppErrorType`으로 매핑되는 업무 예외와 인증 거절은 메시지 한 줄이면 충분하다. 예상 못 한 것(`handleException`의 500)은 그대로 스택을 남긴다.

과하지 않다고 확인된 것: 1분 주기 watchdog 둘(`RetryStaleAnalysisJobsService`·`ExpireStaleToolApprovalsService`)은 처리 대상이 있을 때만 INFO를 남긴다. 빈 폴링은 로그를 만들지 않는다.

### 수집 방식 — 2배 과금 함정

**prod는 같은 로그를 콘솔과 파일에 둘 다 쓴다.** 에이전트가 양쪽을 수집하면 **전량이 두 번 과금된다.** 수집원을 하나만 고르는 것이 이 이슈에서 돈이 걸린 결정이다.

| | `awslogs` 로그 드라이버 | CloudWatch Agent가 파일 tail |
|---|---|---|
| compose 변경 | `logging.driver`를 `json-file`→`awslogs` | 무변경. 호스트에 agent 설치 |
| 대가 | **`docker logs`가 죽는다** | 호스트 관리 대상이 하나 는다 |
| 배포 중 유실 | 컨테이너 교체 시점이 안전 | 파일이 호스트에 남아 안전 |

**Agent가 파일을 tail 하는 쪽을 권한다.** 지금 구조가 의도적으로 "실시간은 `docker logs`, 보존은 호스트 파일"로 나뉘어 있고(compose 주석에 근거가 적혀 있다), 이 방식이 그 구조를 보존하며 이미 있는 바인드 마운트를 그대로 쓴다.

### 배포 주의

- IAM은 EC2 Role에 `logs:CreateLogStream`·`logs:PutLogEvents` 추가. 기존 `secretsmanager:GetSecretValue`와 같은 방식이라 Access Key를 새로 만들지 않는다
- **로그 그룹 보존 기간을 반드시 설정한다.** 기본값이 "만료 없음"이라 안 걸면 저장 비용이 영구 누적된다
- 감량 전후의 로그량을 같은 방법으로 재서 효과를 기록한다

## 6. C — 챗봇 패널 스크롤

### 원인

`personal-chat.tsx`와 `shared-chat-panel.tsx`의 `<ScrollArea className="flex-1">`에 **`min-h-0`이 없다.** flex 아이템의 기본 `min-height: auto`가 콘텐츠 높이 아래로 줄어드는 것을 막아, 뷰포트가 콘텐츠만큼 커진다. 그러면 `scrollHeight === clientHeight`라 **스크롤도 자동 하단 이동도 둘 다 죽는다.**

**이 레포는 `min-h-0 flex-1`을 이미 관용구로 쓴다** — `note-panel.tsx`에만 5곳, `sidebar.tsx`, `settings-dialog.tsx`, `note-route-surface.tsx`. 대조군이 같은 폴더에 있다. 깨진 두 곳만 맨 `flex-1`이다.

스크롤 JS(바닥 48px 안에서만 따라가는 로직)는 멀쩡하므로 건드리지 않는다.

### 검증

MSW로 실제 앱에서 긴 대화를 만들어 **실측한다.** CSS 수정은 눈으로 봐야 확정되고, 이 레포의 규칙이기도 하다.

## 7. D — 노트 full에서 사이드바 프로젝트 선택 무반응

### 원인

프로젝트 선택이 `onSelectProject={setSelectedProjectId}` — **순수 로컬 `useState`라 URL을 바꾸지 않는다.** 노트 full 화면은 URL로 떠 있으니 그대로 남고, 필터링된 노트 목록이 그 **뒤에서** 바뀐다. 그래서 아무 일도 안 일어난 것처럼 보인다.

워크스페이스 전환은 `router.push`라 정상이다. **프로젝트 선택만** 그렇다.

### 방향 둘

`docs/frontend-architecture.md`가 이미 "workspace 선택: 현재 project 선택은 workspace shell의 지역 상태다. **URL 공유가 필요해질 때만 search param으로 승격한다**"고 적어 뒀다. 지금이 그 판단 시점이다.

1. **search param으로 승격** — 선택이 URL에 들어가고 노트 화면도 그에 반응한다. 공유·뒤로가기가 자연스러워지지만 범위가 크다
2. **선택 시 노트를 닫는다** — 프로젝트를 고르면 `/w/{id}`로 이동한다. 작고 확실하지만 선택 상태는 여전히 URL 밖이다

이슈에는 증상·원인·판정 기준을 적고 둘을 제시한다. 어느 쪽인지는 구현 단계에서 정한다.

### 판정 기준

노트 full 화면에서 사이드바의 프로젝트나 "모든 노트"를 눌렀을 때 **화면이 눈에 띄게 바뀌어야 한다.**

## 8. 범위 밖

- 인증 플로우 자체의 재설계(로그인 페이지 신설, `returnTo`)
- 폴링을 SSE/WebSocket으로 바꾸는 것. 지금 필요한 것은 "오류를 아는 폴링"이지 전송 방식 교체가 아니다
- ArchUnit 등 서버 구조 규칙 강제 (별도 이슈)
- CloudWatch 이후의 알람·대시보드 구성. 먼저 로그가 들어가야 한다
