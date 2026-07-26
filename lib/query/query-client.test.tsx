import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRefreshError } from "@/lib/api/fetcher";
import { makeQueryClient } from "@/lib/query/query-client";
import {
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function retryOf(client: ReturnType<typeof makeQueryClient>) {
  const retry = client.getDefaultOptions().queries?.retry;
  if (typeof retry !== "function") {
    throw new Error("retry는 함수여야 한다");
  }
  return retry;
}

describe("makeQueryClient 재시도 정책", () => {
  beforeEach(() => {
    resetSessionGate();
    toast.error.mockReset();
  });

  it("인증 오류는 재시도하지 않는다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new SessionExpiredError())).toBe(false);
    expect(retry(0, new AuthRefreshError(400))).toBe(false);
  });

  it("그 밖의 오류는 두 번까지 재시도한다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new Error("boom"))).toBe(true);
    expect(retry(1, new Error("boom"))).toBe(true);
    expect(retry(2, new Error("boom"))).toBe(false);
  });

  it("네트워크 갱신 실패는 재시도 대상으로 남는다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new AuthRefreshError(null))).toBe(true);
  });
});

describe("makeQueryClient mutation 토스트", () => {
  beforeEach(() => {
    resetSessionGate();
    toast.error.mockReset();
  });

  function renderFailingMutation() {
    const client = makeQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    return renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            throw new Error("실패");
          },
        }),
      { wrapper }
    );
  }

  it("게이트가 열려 있으면 토스트를 띄우지 않는다", async () => {
    openSessionGate();
    const { result } = renderFailingMutation();

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("평소 실패는 토스트를 띄운다", async () => {
    const { result } = renderFailingMutation();

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
