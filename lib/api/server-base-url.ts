/**
 * **서버가 부를 API 주소.** 브라우저가 부를 주소와 다를 수 있다.
 *
 * `NEXT_PUBLIC_API_BASE_URL`은 클라이언트 번들에 박히므로 **브라우저가 도달할 수 있는
 * 주소**여야 한다. 그런데 SSR과 proxy는 그 값을 **서버 안에서** 쓴다. 한 호스트에서 dev로
 * 돌 때는 둘이 같아서 문제가 없지만, **컨테이너에서는 갈라진다** — 브라우저의
 * `http://localhost:18080`이 컨테이너 안에서는 자기 자신이라 아무것도 없다.
 *
 * 실제로 통합 스택에서 밟았다. web 컨테이너 안에서 `fetch('http://localhost:18080/...')`이
 * `fetch failed`였고 `http://server:8080/...`은 401(=도달)이었다. SSR 유저 조회가 조용히
 * 실패해 모든 보호 경로가 로그인으로 튕겼다.
 *
 * 그래서 서버 쪽만 `API_BASE_URL`로 덮을 수 있게 한다. **`NEXT_PUBLIC_` 접두사가 없어
 * 브라우저 번들에 안 실리고, 런타임 환경변수로 바꿀 수 있다** — 이미지 재빌드가 필요 없다.
 * 안 주면 기존 값을 그대로 쓰므로 로컬 개발과 기존 배포는 변화가 없다.
 */
export function serverApiBaseUrl() {
  return (
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  );
}
