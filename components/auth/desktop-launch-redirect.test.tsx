import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesktopLaunchRedirect } from "./desktop-launch-redirect";

const state = vi.hoisted(() => ({
  status: "authenticated",
  replace: vi.fn(),
  report: vi.fn().mockResolvedValue(undefined),
  query: {
    data: undefined as unknown,
    isSuccess: true,
    isFetching: false,
    isError: false,
    isPending: false,
  },
  options: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ status: state.status }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: (options: unknown) => {
    state.options(options);
    return state.query;
  },
}));
const data = (ids: string[]) => ({
  status: 200,
  data: {
    success: true,
    data: { workspaces: ids.map((workspaceId) => ({ workspaceId })) },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  state.status = "authenticated";
  Object.assign(state.query, {
    data: data(["first", "last"]),
    isSuccess: true,
    isFetching: false,
    isError: false,
    isPending: false,
  });
  localStorage.setItem("heymoa:last-workspace", "last");
  Object.assign(window, {
    heymoaDesktop: {
      getCapabilities: vi.fn(),
      reportMeetingList: state.report,
    },
  });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  Reflect.deleteProperty(window, "heymoaDesktop");
});
it("일반 브라우저는 자동 조회와 이동을 하지 않습니다", () => {
  Reflect.deleteProperty(window, "heymoaDesktop");
  render(<DesktopLaunchRedirect />);
  expect(state.options.mock.calls[0][0].query.enabled).toBe(false);
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.report).not.toHaveBeenCalled();
});
it("소속을 확인한 마지막 워크스페이스로 이동합니다", () => {
  render(<DesktopLaunchRedirect />);
  expect(state.replace).toHaveBeenCalledWith("/w/last");
});
it("저장한 주소가 소속 목록에 없으면 첫 워크스페이스를 엽니다", () => {
  localStorage.setItem("heymoa:last-workspace", "https://untrusted.invalid");
  render(<DesktopLaunchRedirect />);
  expect(state.replace).toHaveBeenCalledWith("/w/first");
});
it("캐시가 있어도 서버 확인 중에는 이동하지 않습니다", () => {
  state.query.isFetching = true;
  render(<DesktopLaunchRedirect />);
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.report).toHaveBeenCalledWith({
    workspaceId: null,
    status: "loading",
    meetings: [],
  });
});
it("조회가 실패하면 캐시로 이동하지 않고 실패 상태를 보냅니다", () => {
  state.query.isSuccess = false;
  state.query.isError = true;
  render(<DesktopLaunchRedirect />);
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.report).toHaveBeenCalledWith({
    workspaceId: null,
    status: "failed",
    meetings: [],
  });
});
it.each(["anonymous", "authenticated"])(
  "%s에서 소속이 없으면 랜딩의 로그인·생성 진입점을 유지합니다",
  (status) => {
    state.status = status;
    state.query.data = data([]);
    render(<DesktopLaunchRedirect />);
    expect(state.replace).not.toHaveBeenCalled();
    expect(state.report).toHaveBeenCalledWith({
      workspaceId: null,
      status: "no-workspace",
      meetings: [],
    });
  }
);
it("실패 봉투를 워크스페이스 0개로 간주하지 않습니다", () => {
  state.query.data = { status: 200, data: { success: false } };
  render(<DesktopLaunchRedirect />);
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.report).toHaveBeenCalledWith({
    workspaceId: null,
    status: "failed",
    meetings: [],
  });
});
