import { act, cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpHubInput, HelpHubProvider } from "@/components/help/help-hub-search";
import { intlWrapper } from "@/components/help/test-intl";

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: intlWrapper() });

let search = "q=%EB%85%B9%EC%9D%8C%20%EC%83%81%ED%83%9C";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const input = () =>
  screen.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" });

describe("허브 검색의 주소", () => {
  let replace: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]"))
    );
    replace = vi.spyOn(window.history, "replaceState");
  });
  afterEach(() => {
    cleanup();
    replace.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("마운트하면 주소의 검색어를 읽기만 하고 주소를 쓰지 않는다", () => {
    render(
      <HelpHubProvider>
        <HelpHubInput />
      </HelpHubProvider>
    );
    act(() => void vi.advanceTimersByTime(500));
    expect(input()).toHaveValue("녹음 상태");
    expect(replace).not.toHaveBeenCalled();
  });

  it("주소는 사용자가 입력한 뒤에만 한 번 바꾼다", () => {
    search = "";
    render(
      <HelpHubProvider>
        <HelpHubInput />
      </HelpHubProvider>
    );
    act(() => void vi.advanceTimersByTime(500));
    expect(replace).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: "녹음" } });
    act(() => void vi.advanceTimersByTime(500));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(String(replace.mock.calls[0][2])).toContain("q=%EB%85%B9%EC%9D%8C");
  });
});
