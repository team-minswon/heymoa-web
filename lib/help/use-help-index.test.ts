import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useHelpIndex } from "@/lib/help/use-help-index";

afterEach(() => vi.unstubAllGlobals());

it("색인 요청이 실패한 뒤 다시 열어 성공하면 오류 표시가 걷힌다", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: true, json: async () => [{ path: "/a" }] });
  vi.stubGlobal("fetch", fetchMock);

  const { result, rerender } = renderHook(
    ({ enabled }) => useHelpIndex(enabled),
    { initialProps: { enabled: true } }
  );
  await waitFor(() => expect(result.current.failed).toBe(true));

  rerender({ enabled: false });
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  expect(result.current.failed).toBe(false);
});
