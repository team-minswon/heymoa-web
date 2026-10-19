import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./track", () => ({ track: vi.fn() }));
import { track } from "./track";
import { useSummaryViewed } from "./use-summary-viewed";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("준비 전에는 보내지 않고 요약이 준비되면 한 번만 보냅니다", () => {
  const { rerender } = renderHook(
    ({ ready, noteId }) => useSummaryViewed(noteId, "W1", ready),
    {
      initialProps: { ready: false, noteId: "N1" },
    }
  );
  expect(track).not.toHaveBeenCalled();
  rerender({ ready: true, noteId: "N1" });
  rerender({ ready: false, noteId: "N1" });
  rerender({ ready: true, noteId: "N1" });
  expect(track).toHaveBeenCalledExactlyOnceWith("summary_viewed", {
    workspace_id: "W1",
  });
  rerender({ ready: true, noteId: "N2" });
  expect(track).toHaveBeenCalledTimes(2);
});
