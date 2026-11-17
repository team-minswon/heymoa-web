import {
  getLogoutMockHandler,
  getRefreshTokensMockHandler,
} from "@/lib/api/generated/auth/auth.msw";

import { billingHandlers } from "@/lib/mocks/billing";
import { meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { projectTaskHandlers } from "@/lib/mocks/project-tasks";
import { restHandlers } from "@/lib/mocks/rest-handlers";
import { chatSseHandlers } from "@/lib/mocks/sse-handler";
import { termHandlers } from "@/lib/mocks/terms";
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
  ...meetingFlowHandlers,
  ...projectTaskHandlers,
  ...restHandlers,
  ...termHandlers,
  ...billingHandlers,
  ...chatSseHandlers,
  transcriptionWebSocketHandler,
];
