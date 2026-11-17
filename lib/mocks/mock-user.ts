import type { CurrentUserResponseData } from "@/lib/api/generated/models";
import type { AuthUser } from "@/lib/auth/types";

const MOCK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#d8cfc0"/><circle cx="32" cy="25" r="11" fill="#8a7f6d"/><path d="M8 64c0-13 11-21 24-21s24 8 24 21z" fill="#8a7f6d"/></svg>'
  );

export const MOCK_ACCOUNT_LANGUAGE_COOKIE = "heymoa-mock-account-lang";

export const MOCK_USER: AuthUser = {
  userId: "0MEMBER000001",
  name: "테스트 유저",
  email: "test@heymoa.com",
  image: MOCK_AVATAR,
  language: null,
};

export const MOCK_CONSENT_VERSION = "2026-10-23";

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
