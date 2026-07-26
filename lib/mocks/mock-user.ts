import type { AuthUser } from "@/lib/auth/types";

// Single source of truth for the mock identity. The SSR mock user
// (lib/auth/server.ts) and the client MSW store (lib/mocks/db.ts) MUST match,
// otherwise hydration sees two different users and auth breaks.
/**
 * 실서버는 Google 로그인이라 `image`가 사실상 항상 온다. 목이 `null`이면 dev와 테스트가
 * 아바타 fallback(이니셜)만 그려보고 **이미지가 있는 경로를 한 번도 지나지 않는다**.
 * 원격 URL은 오프라인에서 흔들리므로 인라인 data URI를 쓴다. `null` 경로는 목의 다른 멤버
 * (`한지원`)가 덮는다.
 */
const MOCK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#d8cfc0"/><circle cx="32" cy="25" r="11" fill="#8a7f6d"/><path d="M8 64c0-13 11-21 24-21s24 8 24 21z" fill="#8a7f6d"/></svg>'
  );

export const MOCK_USER: AuthUser = {
  userId: "user-12345",
  name: "테스트 유저",
  email: "test@heymoa.com",
  image: MOCK_AVATAR,
};
