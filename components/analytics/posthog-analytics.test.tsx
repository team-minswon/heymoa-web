import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PostHogAnalytics } from "./posthog-analytics";
import * as analytics from "@/lib/analytics/track";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: "test-user" } }),
}));
vi.mock("@/lib/api/generated/users/users", () => ({
  useGetCurrentUser: () => ({ data: undefined }),
}));
vi.mock("@/lib/analytics/track", () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  setSessionReplayConsent: vi.fn(),
  syncSessionReplay: vi.fn(),
}));

afterEach(cleanup);

it("공고 UI 없이 분석을 초기화하고 미확인 동의에서는 녹화를 허용하지 않는다", () => {
  const { container } = render(<PostHogAnalytics apiKey="test-key" />);
  expect(container).toBeEmptyDOMElement();
  expect(analytics.initAnalytics).toHaveBeenCalledWith("test-key");
  expect(analytics.identifyUser).toHaveBeenCalledWith("test-user");
  expect(analytics.setSessionReplayConsent).toHaveBeenCalledWith([]);
  expect(analytics.syncSessionReplay).toHaveBeenCalledOnce();
});
