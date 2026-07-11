import { getAuthMock } from "@/lib/api/generated/auth/auth.msw";
import { getGetV1UsersMeMockHandler } from "@/lib/api/generated/user/user.msw";

export const handlers = [
  ...getAuthMock(),
  getGetV1UsersMeMockHandler({
    success: true,
    data: {
      userId: "user-12345",
      name: "테스트 유저",
      email: "test@heymoa.com",
    },
  }),
];
