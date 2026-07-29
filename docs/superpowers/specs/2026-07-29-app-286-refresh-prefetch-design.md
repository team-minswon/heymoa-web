# APP-286 Next Proxy prefetch refresh 경쟁 방지 설계

## 문제

`proxy.ts`는 access token이 없거나 만료 30초 전이면 `/v1/auth/refresh`를 호출한다.
현재 matcher는 정적 자산만 제외해서 Next `<Link>`가 보내는 prefetch 요청도 Proxy를
통과한다. 같은 refresh cookie를 가진 요청이 병렬로 들어오면 서버의 첫 요청이 토큰을
회전시키고 나머지는 이전 토큰으로 실패한다. 실패 응답은 인증 쿠키를 지우므로 정상
갱신 응답과 순서가 뒤집히면 로그인 상태도 잃을 수 있다.

브라우저 `apiFetch`의 `refreshPromise`와 session gate는 한 문서 안의 API 요청만 묶는다.
Next Proxy 요청에는 적용되지 않는다.

## 선택

Proxy matcher를 객체 형식으로 바꾸고 다음 요청 헤더가 없는 경우에만 실행한다.

- `next-router-prefetch`
- `purpose: prefetch`

설치된 Next.js 16.2.11이 제공하는 `unstable_doesMiddlewareMatch`로 matcher 자체를 검증한다. 직접 `proxy()`를
호출하는 테스트만으로는 프레임워크가 matcher에서 요청을 거르는 동작을 증명할 수 없다.
일반 문서 요청은 기존처럼 Proxy를 통과하고 refresh를 정확히 한 번 호출한다.

## 검토한 대안

### Proxy 함수 안에서 prefetch를 반환

동작은 막지만 모든 prefetch가 Proxy 실행 비용을 지불한다. matcher가 같은 조건을
지원하므로 실행 전에 제외한다.

### 서버 refresh token에 grace window 추가

병렬 갱신을 서버가 받아줄 수 있지만 회전·재사용 탐지 의미가 바뀌고 서버 계약과 저장
모델까지 넓어진다. 관측된 원인은 불필요한 prefetch 호출이므로 서버는 변경하지 않는다.

### Proxy 전역 single-flight 또는 분산 락

프로세스 전역 Map은 여러 인스턴스를 묶지 못하고 토큰을 메모리 키로 보관한다. 분산 락은
인프라와 실패 복구를 추가한다. 둘 다 이번 문제보다 크다.

## 동작

1. 일반 문서 요청은 matcher를 통과한다.
2. access token이 없거나 만료 직전이면 refresh API를 한 번 호출한다.
3. Next prefetch 헤더가 있는 요청은 matcher에서 제외되어 refresh API를 호출하지 않는다.
4. 일반 요청의 refresh가 400/401이면 기존대로 access·refresh cookie를 만료시킨다.
5. 일시 네트워크 오류나 5xx에서는 기존대로 쿠키를 유지한다.

## 검증

- `next-router-prefetch` 요청이 matcher에서 제외된다.
- `purpose: prefetch` 요청이 matcher에서 제외된다.
- 같은 경로의 일반 요청은 matcher에 포함된다.
- 일반 요청이 refresh API를 정확히 한 번 호출한다.
- 기존 Proxy 오류·쿠키 회귀 테스트가 통과한다.
- 전체 `test:run`, `lint`, `typecheck`, `build`, `test:e2e`가 통과한다.

## 의도적으로 남기는 범위

여러 탭에서 실제 문서 이동이 정확히 동시에 발생하는 드문 경쟁은 이번 변경이 직렬화하지
않는다. 관측된 대량 burst를 만드는 자동 prefetch만 제거한다. 실제 문서 요청만으로 같은
패턴이 다시 관측되면 별도 이슈에서 다중 인스턴스까지 포함한 갱신 소유권을 설계한다.
