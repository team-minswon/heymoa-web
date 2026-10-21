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
    ({ enabled }) => useHelpIndex(enabled, "ko"),
    { initialProps: { enabled: true } }
  );
  await waitFor(() => expect(result.current.failed).toBe(true));

  rerender({ enabled: false });
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  expect(result.current.failed).toBe(false);
});

it("언어판마다 자기 색인 주소를 받고 따로 둔다", async () => {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => [{ path: url }],
  }));
  vi.stubGlobal("fetch", fetchMock);
  // 앞 시험이 모듈 캐시에 둔 색인을 비운다
  vi.resetModules();
  const { useHelpIndex } = await import("@/lib/help/use-help-index");

  const en = renderHook(() => useHelpIndex(true, "en"));
  await waitFor(() => expect(en.result.current.entries).toHaveLength(1));
  expect(fetchMock).toHaveBeenCalledWith("/en/help/search-index.json");

  // 영어판 색인을 먼저 받아 두어도 한국어 화면은 한국어 색인을 따로 받는다
  const ko = renderHook(() => useHelpIndex(true, "ko"));
  await waitFor(() => expect(ko.result.current.entries).toHaveLength(1));
  expect(fetchMock).toHaveBeenCalledWith("/help/search-index.json");
  expect(ko.result.current.entries?.[0].path).toBe("/help/search-index.json");
  expect(en.result.current.entries?.[0].path).toBe(
    "/en/help/search-index.json"
  );
});
