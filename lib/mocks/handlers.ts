import {
  getLogoutMockHandler,
  getRefreshTokensMockHandler,
} from "@/lib/api/generated/auth/auth.msw";

import { restHandlers } from "@/lib/mocks/rest-handlers";
import { chatSseHandlers } from "@/lib/mocks/sse-handler";
import { transcriptionWebSocketHandler } from "@/lib/mocks/websocket-handler";

export const handlers = [
  getRefreshTokensMockHandler({
    success: true,
    data: {
      message: "Tokens refreshed successfully",
    },
    error: null,
  }),
  getLogoutMockHandler({
    success: true,
    data: {
      message: "Logged out successfully",
    },
    error: null,
  }),
  ...restHandlers,
  ...chatSseHandlers,
  transcriptionWebSocketHandler,
];
