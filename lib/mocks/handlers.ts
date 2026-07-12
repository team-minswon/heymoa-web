import {
  getPostV1AuthLogoutMockHandler,
  getPostV1AuthRefreshMockHandler,
} from "@/lib/api/generated/auth/auth.msw";

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
  ...restHandlers,
  transcriptionWebSocketHandler,
];
