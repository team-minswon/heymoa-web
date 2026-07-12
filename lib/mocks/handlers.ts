import {
  getPostV1AuthLogoutMockHandler,
  getPostV1AuthRefreshMockHandler,
} from "@/lib/api/generated/auth/auth.msw";
import { getGetCurrentUserMockHandler } from "@/lib/api/generated/user/user.msw";

import { restHandlers } from "@/lib/mocks/rest-handlers";
import { transcriptionWebSocketHandler } from "@/lib/mocks/websocket-handler";

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
  getGetCurrentUserMockHandler({
    success: true,
    data: {
      userId: "01K0000000003",
      name: "테스트 유저",
      email: "test@heymoa.com",
    },
  }),
  ...restHandlers,
  transcriptionWebSocketHandler,
];
