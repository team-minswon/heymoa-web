import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SseEvent } from "@/lib/api/sse";

/** 열 때마다 새 가짜 스트림을 하나 돌려준다. 시험이 프레임을 밀어 넣고 끝내거나 실패시킨다. */
type Fake = {
  push: (event: string, data?: unknown) => void;
  end: () => void;
  fail: (error: unknown) => void;
};
const streams: Fake[] = [];
const failNext: unknown[] = [];

vi.mock("@/lib/api/sse", async (original) => ({
  ...(await original<typeof import("@/lib/api/sse")>()),
  getEventStream: (_url: string, { signal }: { signal?: AbortSignal } = {}) => {
    const queue: Array<SseEvent | "end" | { error: unknown }> = [];
    let notify: (() => void) | null = null;
    const fake: Fake = {
      push: (event, data = {}) => {
        queue.push({ event, data: JSON.stringify(data) });
        notify?.();
      },
      end: () => {
        queue.push("end");
        notify?.();
      },
      fail: (error) => {
        queue.push({ error });
        notify?.();
      },
    };
    streams.push(fake);
    const failure = failNext.shift();
    return (async function* () {
      if (failure !== undefined) throw failure;
      while (true) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        const next = queue.shift();
        if (next === undefined) {
          await new Promise<void>((resolve) => {
            notify = resolve;
            signal?.addEventListener("abort", () => resolve(), { once: true });
          });
          continue;
        }
        if (next === "end") return;
        if (typeof next === "object" && "error" in next) throw next.error;
        yield next;
      }
    })();
  },
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ status: "authenticated" }),
}));

import {
  UserEventProvider,
  useEventStreamHealthy,
} from "@/components/events/user-event-provider";

/** 지연은 짧게, 유휴 타이머(40초)는 안 울리게, 지터는 0. */
const timers = {
  setTimeout: (run: () => void, ms: number) =>
    setTimeout(run, ms >= 40_000 ? 1e9 : Math.min(ms, 5)),
  random: () => 0,
};

function Health() {
  return <span data-testid="health">{String(useEventStreamHealthy())}</span>;
}

let client: QueryClient;
let invalidated: string[];

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  streams.length = 0;
  failNext.length = 0;
  setVisibility("visible");
  client = new QueryClient();
  for (const key of [
    ["/v1/notes/N/analyses/flow"],
    ["/v1/notes/N"],
    ["/v1/workspaces/W/agent-chats"],
    ["/v1/notifications/unread-count"],
  ])
    client.setQueryData(key, 1);
  invalidated = [];
  const original = client.invalidateQueries.bind(client);
  client.invalidateQueries = ((filters) => {
    invalidated.push(
      client
        .getQueryCache()
        .findAll(filters)
        .map((query) => String(query.queryKey[0]))
        .join(",")
    );
    return original(filters);
  }) as typeof client.invalidateQueries;
});
afterEach(() => cleanup());

function renderProvider() {
  render(
    <QueryClientProvider client={client}>
      <UserEventProvider timers={timers}>
        <Health />
      </UserEventProvider>
    </QueryClientProvider>
  );
}

const flushed = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("UserEventProvider", () => {
  it("ready 면 건강해지고 소유 쿼리를 한 번 다시 검증하며, 힌트는 그 쿼리만 다시 읽는다. 모르는 이벤트에도 계속 돈다", async () => {
    renderProvider();
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].push("ready", { v: 1 }));
    await waitFor(() =>
      expect(screen.getByTestId("health")).toHaveTextContent("true")
    );
    await waitFor(() => expect(invalidated).toHaveLength(1));
    expect(invalidated[0].split(",")).toHaveLength(4);

    invalidated.length = 0;
    act(() => {
      streams[0].push("someday.changed", { x: 1 });
      streams[0].push("chats.changed", { workspaceId: "W", extra: true });
      streams[0].push("chats.changed", { workspaceId: "W" });
    });
    await flushed();
    // 같은 대상의 연속 힌트는 한 번으로 합친다.
    expect(invalidated).toEqual(["/v1/workspaces/W/agent-chats"]);
  });

  it("숨은 탭에서는 힌트를 모으기만 하고, 다시 보일 때 쿼리당 한 번 다시 읽는다", async () => {
    renderProvider();
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].push("ready"));
    await waitFor(() => expect(invalidated).toHaveLength(1));
    invalidated.length = 0;

    setVisibility("hidden");
    act(() => {
      streams[0].push("note.changed", {
        workspaceId: "W",
        noteId: "N",
        aspects: ["analysis"],
      });
      streams[0].push("note.changed", {
        workspaceId: "W",
        noteId: "N",
        aspects: ["analysis"],
      });
      streams[0].push("notifications.changed");
    });
    await flushed();
    expect(invalidated).toEqual([]);

    act(() => setVisibility("visible"));
    await flushed();
    expect(invalidated.sort()).toEqual([
      "/v1/notes/N/analyses/flow",
      "/v1/notifications/unread-count",
    ]);
  });

  it("끊겼다 다시 붙으면 소유 쿼리 전체를 다시 읽고, 끊긴 동안은 건강하지 않다", async () => {
    renderProvider();
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].push("ready"));
    await waitFor(() => expect(invalidated).toHaveLength(1));
    act(() => streams[0].fail(new TypeError("network")));
    await waitFor(() =>
      expect(screen.getByTestId("health")).toHaveTextContent("false")
    );
    await waitFor(() => expect(streams).toHaveLength(2));
    act(() => streams[1].push("ready"));
    await waitFor(() => expect(invalidated).toHaveLength(2));
    expect(invalidated[1].split(",")).toHaveLength(4);
  });

  it("degraded 면 건강하지 않다고 알리고, 깨끗한 종료는 곧바로 다시 붙는다", async () => {
    renderProvider();
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].push("ready"));
    await waitFor(() =>
      expect(screen.getByTestId("health")).toHaveTextContent("true")
    );
    act(() => streams[0].push("degraded", { reason: "subscription" }));
    await waitFor(() =>
      expect(screen.getByTestId("health")).toHaveTextContent("false")
    );
    act(() => streams[0].end());
    await waitFor(() => expect(streams).toHaveLength(2));
  });

  it("서버가 404 면 재시도를 멈추고, 5xx 면 계속 다시 붙는다", async () => {
    failNext.push({ httpStatus: 404, retryAfterMs: null });
    renderProvider();
    await waitFor(() => expect(streams).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(streams).toHaveLength(1);
    expect(screen.getByTestId("health")).toHaveTextContent("false");
    cleanup();

    streams.length = 0;
    failNext.push(
      { httpStatus: 503, retryAfterMs: 1 },
      { httpStatus: 500, retryAfterMs: null }
    );
    renderProvider();
    await waitFor(() => expect(streams.length).toBeGreaterThanOrEqual(3));
  });

  it("온라인으로 돌아오면 기다리던 재연결을 바로 깨워 다시 붙고, 소유 쿼리를 다시 읽는다", async () => {
    // 백오프(1초 이상)는 시험 안에서 끝나지 않게 둔다 — 온라인 복귀만이 깨울 수 있다.
    const slow = {
      setTimeout: (run: () => void, ms: number) =>
        setTimeout(run, ms >= 1_000 ? 1e9 : Math.min(ms, 5)),
      random: () => 0,
    };
    render(
      <QueryClientProvider client={client}>
        <UserEventProvider timers={slow}>
          <Health />
        </UserEventProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0].push("ready"));
    await waitFor(() => expect(invalidated).toHaveLength(1));
    act(() => streams[0].fail(new TypeError("offline")));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(streams).toHaveLength(1);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(streams).toHaveLength(2));
    act(() => streams[1].push("ready"));
    await waitFor(() => expect(invalidated).toHaveLength(2));
  });
});
