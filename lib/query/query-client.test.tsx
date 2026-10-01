import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, AuthRefreshError } from "@/lib/api/fetcher";
import { makeQueryClient } from "@/lib/query/query-client";
import {
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toast }));

function retryDelayOf(client: ReturnType<typeof makeQueryClient>) {
  const retryDelay = client.getDefaultOptions().queries?.retryDelay;
  if (typeof retryDelay !== "function") {
    throw new Error("retryDelay는 함수여야 한다");
  }
  return retryDelay;
}

function apiError(status: number, retryAfterMs: number | null = null) {
  return new ApiError(status, { code: `HTTP_${status}`, message: "실패" }, retryAfterMs);
}

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
    expect(retry(0, new AuthRefreshError(true))).toBe(false);
  });

  it("그 밖의 오류는 두 번까지 재시도한다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new Error("boom"))).toBe(true);
    expect(retry(1, new Error("boom"))).toBe(true);
    expect(retry(2, new Error("boom"))).toBe(false);
  });

  it("네트워크 갱신 실패는 재시도 대상으로 남는다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new AuthRefreshError(false))).toBe(true);
  });

  // 다시 보내도 답이 같다 — 오류만 늦게 보인다 (APP-783)
  it("4xx 는 재시도하지 않는다", () => {
    const retry = retryOf(makeQueryClient());

    for (const status of [400, 403, 404, 409]) {
      expect(retry(0, apiError(status))).toBe(false);
    }
  });

  it("5xx 는 지금처럼 두 번까지 재시도한다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, apiError(503))).toBe(true);
    expect(retry(1, apiError(503))).toBe(true);
    expect(retry(2, apiError(503))).toBe(false);
  });

  it("429 는 Retry-After 가 짧을 때만 한 번 다시 보낸다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, apiError(429, 5_000))).toBe(true);
    expect(retry(1, apiError(429, 5_000))).toBe(false);
    // 얼마나 기다릴지 모르거나 너무 길면 조회를 붙잡아 두지 않는다
    expect(retry(0, apiError(429))).toBe(false);
    expect(retry(0, apiError(429, 60_000))).toBe(false);
  });

  it("429 재시도는 Retry-After 만큼 기다리고, 그 밖은 기본 지수 백오프다", () => {
    const retryDelay = retryDelayOf(makeQueryClient());

    expect(retryDelay(0, apiError(429, 5_000))).toBe(5_000);
    expect(retryDelay(0, apiError(503))).toBe(1_000);
    expect(retryDelay(1, new Error("boom"))).toBe(2_000);
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

  // 위 두 테스트는 합성 `throw new Error("실패")`라 "토스트가 한 번 불렸다"만 본다.
  // `errorMessageOf`가 실제 문구를 뽑는지, 그 문구가 `toast.error`의 인자까지 도달하는지는
  // 아무도 못 잡는다. `apiFetch`(`lib/api/fetcher.ts`의 `parseResponse`)는 비-2xx일 때
  // `ApiError`를 throw한다 — 모양은 `{ success: false, data: null, error: { code, message } }`
  // (`lib/api/error-message.ts`의 `ApiErrorEnvelope`)에 상태 코드를 더한 것이다. 이 테스트는
  // 그 모양 그대로 던져서 실제 합성 사슬(fetcher가 던지는
  // 모양 → `errorMessageOf`가 뽑는 문구 → `toast.error`에 넘어가는 인자)을 검증한다.
  it("실제 API 오류 봉투(예: 409 LAST_WORKSPACE_ADMIN)를 던지면 서버 문구가 toast.error 인자까지 도달한다", async () => {
    const envelope = {
      success: false,
      data: null,
      error: {
        code: "LAST_WORKSPACE_ADMIN",
        message: "워크스페이스에는 관리자가 최소 한 명 있어야 합니다.",
      },
    };
    const client = makeQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            throw envelope;
          },
        }),
      { wrapper }
    );

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(
      "워크스페이스에는 관리자가 최소 한 명 있어야 합니다."
    );
  });
});
