import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useReviewEditor } from "@/lib/notes/review/use-review-editor";

/** `vi.fn()` 은 거절하는 프라미스를 미처리 오류로 보고해 거절 시험을 깨뜨린다 — 손으로 쓴 대역을 쓴다. */
const update = vi.hoisted(() => ({
  impl: (async () => undefined) as (...args: unknown[]) => Promise<unknown>,
  calls: [] as unknown[][],
}));

vi.mock("@/lib/ui/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  getGetAnalysisFlowQueryKey: (noteId: string) => [`/notes/${noteId}/flow`],
}));
vi.mock("@/lib/api/generated/meeting-review/meeting-review", () => ({
  getGetMeetingReviewQueryKey: (noteId: string) => [
    `/notes/${noteId}/meeting-review`,
  ],
  getGetMeetingReviewSummaryQueryKey: (noteId: string) => [
    `/notes/${noteId}/meeting-review/summary`,
  ],
  useCreateMeetingReviewItem: () => ({ mutateAsync: async () => undefined }),
  useUpdateMeetingReviewItem: () => ({
    mutateAsync: (...args: unknown[]) => {
      update.calls.push(args);
      return update.impl(...args);
    },
  }),
}));

const KEY = ["/notes/n1/meeting-review"];
const item = (included: boolean, revision = 2) => ({
  itemId: "A",
  kind: "ACTION",
  content: "배포 일정을 정한다",
  revision,
  included,
  due: null,
  assignee: null,
  edited: false,
  replacements: [],
  taskChanges: [],
});
const review = (included: boolean, reviewVersion = 5, revision = 2) => ({
  status: 200,
  data: {
    success: true,
    data: { reviewVersion, items: [item(included, revision)] },
  },
});
const includedOf = (client: QueryClient) =>
  (client.getQueryData(KEY) as ReturnType<typeof review>).data.data.items[0]
    .included;

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(KEY, review(true));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useReviewEditor("n1"), { wrapper }) };
}

describe("useReviewEditor — 낙관적 적용", () => {
  beforeEach(() => {
    update.impl = async () => undefined;
    update.calls = [];
  });

  it("제외는 응답 전에 줄에 먼저 걸리고, 응답이 오면 서버 판으로 갈린다", async () => {
    let finish!: (value: unknown) => void;
    update.impl = () => new Promise((resolve) => (finish = resolve));
    const { client, result } = setup();

    let saved!: Promise<boolean>;
    act(() => {
      saved = result.current.updateItem("A", { included: false });
    });

    await waitFor(() => expect(includedOf(client)).toBe(false));
    // 보낸 판은 읽은 그대로다.
    await waitFor(() => expect(update.calls.length).toBe(1));
    expect(update.calls[0]?.[0]).toMatchObject({
      data: {
        expectedReviewVersion: 5,
        expectedItemRevision: 2,
        included: false,
      },
    });

    finish(review(false, 6, 3));
    await act(async () => void (await saved));
    expect(client.getQueryData(KEY)).toEqual(review(false, 6, 3));
  });

  it("실패하면 먼저 건 값을 되돌린다", async () => {
    update.impl = async () => {
      throw {
        success: false,
        data: null,
        error: { code: "SOMETHING_ELSE", message: "x" },
      };
    };
    const { client, result } = setup();

    let ok = true;
    await act(
      async () =>
        void (ok = await result.current.updateItem("A", { included: false }))
    );

    expect(ok).toBe(false);
    expect(includedOf(client)).toBe(true);
  });

  /** 저장 중에 다른 조회가 더 새 검토본(v6)을 가져왔으면, 실패해도 그 새 값은 지키고 이 항목의 칸만 되돌린다. */
  it("실패해도 그사이 들어온 더 새 검토본은 옛 판으로 덮지 않는다", async () => {
    let rejectSave!: (reason: unknown) => void;
    update.impl = () => new Promise((_, reject) => (rejectSave = reject));
    const { client, result } = setup();

    let saved!: Promise<boolean>;
    act(() => {
      saved = result.current.updateItem("A", { included: false });
    });
    await waitFor(() => expect(includedOf(client)).toBe(false));
    // 다른 조회가 v6 을 가져왔다(이 항목은 아직 낙관 값, 판은 6).
    client.setQueryData(KEY, review(false, 6, 3));

    rejectSave({
      success: false,
      data: null,
      error: { code: "X", message: "m" },
    });
    await act(async () => void (await saved));

    const data = (client.getQueryData(KEY) as ReturnType<typeof review>).data
      .data;
    expect(data.reviewVersion).toBe(6);
    expect(data.items[0]).toMatchObject({ included: true, revision: 3 });
  });

  it("내용 수정은 응답 전에 걸지 않는다", async () => {
    let finish!: (value: unknown) => void;
    update.impl = () => new Promise((resolve) => (finish = resolve));
    const { client, result } = setup();

    act(() => void result.current.updateItem("A", { content: "다른 내용" }));
    await waitFor(() => expect(update.calls.length).toBe(1));

    expect(
      (client.getQueryData(KEY) as ReturnType<typeof review>).data.data.items[0]
        .content
    ).toBe("배포 일정을 정한다");
    finish(review(true));
    await act(async () => void (await Promise.resolve()));
  });
});
