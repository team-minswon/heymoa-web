import {
  getLogoutMockHandler,
  getRefreshTokensMockHandler,
} from "@/lib/api/generated/auth/auth.msw";

import { meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { projectTaskHandlers } from "@/lib/mocks/project-tasks";
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
  // 회의 뒤 흐름 목이 먼저다 — 검토 항목의 명제 이력을 답하지 못하면 실시간 정리 목으로 넘긴다.
  ...meetingFlowHandlers,
  ...projectTaskHandlers,
  ...restHandlers,
  ...chatSseHandlers,
  transcriptionWebSocketHandler,
];
