import {
  getPostV1AuthLogoutMockHandler,
  getPostV1AuthRefreshMockHandler,
} from "@/lib/api/generated/auth/auth.msw";
import { getGetV1UsersMeMockHandler } from "@/lib/api/generated/user/user.msw";

export const handlers = [
  getPostV1AuthRefreshMockHandler({
    success: true,
    data: {
      message: "Tokens refreshed successfully",
    },
  }),
  getPostV1AuthLogoutMockHandler({
    success: true,
    data: {
      message: "Logged out successfully",
    },
  }),
  getGetV1UsersMeMockHandler({
    success: true,
    data: {
      userId: "user-12345",
      name: "테스트 유저",
      email: "test@heymoa.com",
    },
  }),
];
