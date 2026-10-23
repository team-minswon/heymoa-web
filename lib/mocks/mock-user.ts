import type { CurrentUserResponseData } from "@/lib/api/generated/models";
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

/** 목 서버가 정한 지금 문서 버전. 계약의 `consents[].currentVersion` 이다. */
export const MOCK_CONSENT_VERSION = "2026-10-23";

/**
 * 내 정보 응답이 `AuthUser` 에 더해 싣는 칸(APP-1276 동의 · APP-1283 언어). **목 사용자는 이미 동의한 계정으로
 * 시작한다** — 로그인 뒤 동의 화면(APP-1277)이 목 모드의 모든 화면 앞에 서지 않게. 동의 화면은 이 값을 바꾸는
 * 시험이 따로 본다.
 */
export const MOCK_ACCOUNT: Pick<
  CurrentUserResponseData,
  "language" | "consentRequired" | "consents"
> = {
  language: null,
  consentRequired: false,
  consents: [
    { documentType: "PRIVACY", currentVersion: MOCK_CONSENT_VERSION, agreed: true },
    { documentType: "TERMS", currentVersion: MOCK_CONSENT_VERSION, agreed: true },
  ],
};
