import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FeedbackDialog,
  UnseenCount,
  composeFeedback,
} from "@/components/workspace/feedback-dialog";
import { useFeedbackAnswers } from "@/components/workspace/use-feedback-answers";

const mutate = vi.fn();
const markOnServer = vi.fn<() => Promise<unknown>>();
let state: "ok" | "loading" | "error" = "ok";
let client: QueryClient;

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthUserId: () => "u1",
}));
vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api/generated/feedbacks/feedbacks", () => ({
  getGetMyFeedbacksQueryKey: () => ["feedbacks"],
  useCreateFeedback: () => ({ mutate, isPending: false }),
  // 캐시는 진짜 QueryClient 다 — 낙관적 갱신과 되돌림을 실제 캐시에서 본다.
  useGetMyFeedbacks: () => {
    const query = useQuery({
      queryKey: ["feedbacks"],
      queryFn: () => new Promise(() => {}),
      enabled: state === "ok",
    });
    if (state === "loading")
      return {
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
        data: undefined,
      };
    if (state === "error")
      return {
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
        data: undefined,
      };
    return query;
  },
  // 화면이 넘기는 낙관적 갱신·되돌림 옵션을 그대로 진짜 useMutation 에 싣는다.
  useMarkFeedbackAnswersSeen: (options: {
    mutation: Parameters<typeof useMutation>[0];
  }) => useMutation({ ...options.mutation, mutationFn: markOnServer }),
}));

const answered = {
  feedbackId: "A",
  kind: "INCIDENT",
  message: "전사가 멈췄어요\n\n---\n화면: /w/1\n환경: x",
  answer: "고쳤습니다",
  answeredAt: "2026-10-17T09:30:00.000Z",
  answerSeen: false,
  createdAt: "2026-10-17T08:12:00.000Z",
};

afterEach(cleanup);

function seed(feedbacks: unknown[]) {
  client.setQueryData(["feedbacks"], {
    status: 200,
    data: { success: true, data: { feedbacks } },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function cachedSeen() {
  const cached = client.getQueryData<{
    data: { data: { feedbacks: { answerSeen?: boolean }[] } };
  }>(["feedbacks"]);
  return cached?.data.data.feedbacks.map((item) => item.answerSeen);
}

describe("FeedbackDialog", () => {
  beforeEach(() => {
    mutate.mockReset();
    markOnServer.mockReset().mockResolvedValue(undefined);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    state = "ok";
    seed([]);
  });
  afterEach(cleanup);

  it("내용이 비면 보내기를 막는다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />, { wrapper });
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("고른 분류와 내용을 화면 경로와 함께 서버로 보낸다", () => {
    window.history.replaceState({}, "", "/w/1/notes/2?view=full");
    render(<FeedbackDialog open onOpenChange={vi.fn()} />, { wrapper });
    fireEvent.click(screen.getByRole("radio", { name: /장애·오류/ }));
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "저장이 안 돼요" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    const { data } = mutate.mock.calls[0][0];
    expect(data.kind).toBe("INCIDENT");
    expect(data.message).toContain("저장이 안 돼요");
    expect(data.message).toContain("화면: /w/1/notes/2\n");
    expect(data.message).not.toContain("view=full");
  });

  it("글자 수를 보여 주고 1200자에서 멈춘다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />, { wrapper });
    const box = screen.getByLabelText("내용");
    expect(box).toHaveAttribute("maxlength", "1200");
    fireEvent.change(box, { target: { value: "가나다" } });
    expect(screen.getByText("3 / 1200")).toBeTruthy();
  });

  it("내 문의 탭에 답변을 보여 주고 꼬리는 숨긴다", async () => {
    seed([answered]);
    render(<FeedbackDialog open onOpenChange={vi.fn()} />, { wrapper });
    expect(screen.getByLabelText("새 답변 1개")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));

    expect(screen.getByText("답변 완료")).toBeTruthy();
    expect(screen.getByText("고쳤습니다")).toBeTruthy();
    expect(screen.getByText("전사가 멈췄어요")).toBeTruthy();
    expect(screen.queryByText(/환경: x/)).toBeNull();
    // 본 뒤에는 서버 응답을 기다리지 않고 새 답변 표시가 사라진다.
    await waitFor(() =>
      expect(screen.queryByLabelText("새 답변 1개")).toBeNull()
    );
    expect(markOnServer).toHaveBeenCalledTimes(1);
  });

  it("조회 중에는 빈 상태가 아니라 불러오는 중을 보여 준다", () => {
    state = "loading";
    render(<FeedbackDialog open onOpenChange={vi.fn()} />, { wrapper });
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));
    expect(screen.getByLabelText("내 문의를 불러오는 중")).toBeTruthy();
    expect(screen.queryByText("아직 보낸 문의가 없어요.")).toBeNull();
  });

  it("조회에 실패하면 빈 상태가 아니라 오류와 다시 시도를 보여 준다", () => {
    state = "error";
    render(<FeedbackDialog open onOpenChange={vi.fn()} />, { wrapper });
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));
    expect(screen.getByText("내 문의를 불러오지 못했어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(screen.queryByText("아직 보낸 문의가 없어요.")).toBeNull();
  });

  it("보낸 문의가 없으면 빈 상태를 보여 준다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />, { wrapper });
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));
    expect(screen.getByText("아직 보낸 문의가 없어요.")).toBeTruthy();
  });
});

describe("useFeedbackAnswers", () => {
  beforeEach(() => {
    markOnServer.mockReset().mockResolvedValue(undefined);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    state = "ok";
  });

  it("한 곳에서 읽으면 같은 캐시를 보는 다른 곳의 숫자도 바로 줄고 서버에 한 번 알린다", async () => {
    seed([
      answered,
      { ...answered, feedbackId: "B", answer: null, answeredAt: null },
    ]);
    const sidebar = renderHook(() => useFeedbackAnswers(), { wrapper });
    const dialog = renderHook(() => useFeedbackAnswers(), { wrapper });
    expect(sidebar.result.current.unseen).toBe(1);

    act(() => dialog.result.current.markSeen());

    // 답 없는 문의는 그대로 둔다. 서버 응답을 기다리지 않는다(markOnServer 는 아직 끝나지 않아도 된다).
    await waitFor(() => expect(cachedSeen()).toEqual([true, false]));
    await waitFor(() => expect(sidebar.result.current.unseen).toBe(0));
    act(() => dialog.result.current.markSeen());
    expect(markOnServer).toHaveBeenCalledTimes(1);
  });

  it("보내는 중에 다시 불러도 한 번만 보낸다", async () => {
    let finish = () => {};
    markOnServer.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => (finish = () => resolve(undefined)))
    );
    seed([answered]);
    const hook = renderHook(() => useFeedbackAnswers(), { wrapper });

    act(() => hook.result.current.markSeen());
    await waitFor(() => expect(markOnServer).toHaveBeenCalledTimes(1));
    // 낙관적으로 0 이 됐어도 새 미읽음이 들어온 상황을 만든다.
    seed([
      { ...answered, answerSeen: true },
      { ...answered, feedbackId: "N" },
    ]);
    await waitFor(() => expect(hook.result.current.unseen).toBe(1));
    act(() => hook.result.current.markSeen());

    expect(markOnServer).toHaveBeenCalledTimes(1);
    finish();
  });

  it("서버가 실패하면 낙관적으로 바꾼 항목을 되돌린다", async () => {
    let fail = () => {};
    markOnServer.mockImplementation(
      () =>
        new Promise<unknown>(
          (_resolve, reject) => (fail = () => reject(new Error("HTTP_404")))
        )
    );
    seed([answered, { ...answered, feedbackId: "C", answerSeen: true }]);
    const hook = renderHook(() => useFeedbackAnswers(), { wrapper });

    act(() => hook.result.current.markSeen());
    await waitFor(() => expect(hook.result.current.unseen).toBe(0));
    expect(cachedSeen()).toEqual([true, true]);

    await act(async () => fail());

    await waitFor(() => expect(hook.result.current.unseen).toBe(1));
    expect(cachedSeen()).toEqual([false, true]);
  });

  it("읽음 처리 때문에 멈춘 조회는 끝난 뒤 다시 돌린다", async () => {
    seed([answered]);
    const refetch = vi.spyOn(client, "refetchQueries");
    const hook = renderHook(() => useFeedbackAnswers(), { wrapper });
    // 마운트한 조회는 끝나지 않는 상태다(시험의 queryFn) — 보낸 문의를 받아 오던 조회라고 본다.
    await waitFor(() => expect(client.isFetching()).toBe(1));

    act(() => hook.result.current.markSeen());

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(refetch).toHaveBeenCalledWith({ queryKey: ["feedbacks"] });
  });

  it("보내는 사이 다시 받은 목록은 실패해도 덮지 않는다", async () => {
    let fail = () => {};
    markOnServer.mockImplementation(
      () =>
        new Promise<unknown>(
          (_resolve, reject) => (fail = () => reject(new Error("HTTP_500")))
        )
    );
    seed([answered]);
    const hook = renderHook(() => useFeedbackAnswers(), { wrapper });
    act(() => hook.result.current.markSeen());
    await waitFor(() => expect(markOnServer).toHaveBeenCalled());

    // 다른 기기에서 읽어 서버가 이미 읽음을 돌려준 목록이 도착했다.
    seed([{ ...answered, answerSeen: true }]);
    await act(async () => fail());

    expect(cachedSeen()).toEqual([true]);
    expect(hook.result.current.unseen).toBe(0);
  });

  it("실패를 전역 토스트로 알리지 않는다", () => {
    seed([answered]);
    const hook = renderHook(() => useFeedbackAnswers(), { wrapper });
    act(() => hook.result.current.markSeen());
    const [mutation] = client.getMutationCache().getAll();
    expect(mutation.meta).toEqual({ suppressErrorToast: true });
  });

  it("옛 서버라 answerSeen 이 없으면 숫자를 그리지 않고 서버도 부르지 않는다", () => {
    const { answerSeen: _drop, ...legacy } = answered;
    void _drop;
    seed([legacy]);
    window.localStorage.setItem("heymoa:u:u1:feedback-seen", "");
    const hook = renderHook(() => useFeedbackAnswers(), { wrapper });

    expect(hook.result.current.unseen).toBe(0);
    act(() => hook.result.current.markSeen());
    expect(markOnServer).not.toHaveBeenCalled();
  });
});

describe("FeedbackDialog 읽음 처리 실패", () => {
  beforeEach(() => {
    markOnServer.mockReset().mockRejectedValue(new Error("HTTP_404"));
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    state = "ok";
  });

  it("되돌린 숫자가 곧바로 다시 부르지 않고 창을 다시 열 때 한 번 더 시도한다", async () => {
    seed([answered]);
    const view = render(<FeedbackDialog open onOpenChange={vi.fn()} />, {
      wrapper,
    });
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));
    await waitFor(() =>
      expect(screen.getAllByLabelText("새 답변 1개")).toHaveLength(1)
    );
    await act(async () => {});
    expect(markOnServer).toHaveBeenCalledTimes(1);

    view.rerender(<FeedbackDialog open={false} onOpenChange={vi.fn()} />);
    view.rerender(<FeedbackDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(markOnServer).toHaveBeenCalledTimes(2));
  });
});

describe("UnseenCount", () => {
  it("0 이 되면 마지막 숫자를 남긴 채 흐려지고 읽기 도구에서는 빠진다", () => {
    const view = render(<UnseenCount count={2} />);
    expect(screen.getByLabelText("새 답변 2개")).toHaveClass("opacity-100");

    view.rerender(<UnseenCount count={0} />);

    expect(screen.queryByLabelText(/새 답변/)).toBeNull();
    const faded = screen.getByText("2");
    expect(faded).toHaveClass("opacity-0", "motion-reduce:transition-none");
    expect(faded).toHaveAttribute("aria-hidden", "true");
  });

  it("숫자가 없었으면 아무것도 그리지 않는다", () => {
    const { container } = render(<UnseenCount count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("composeFeedback", () => {
  it("화면은 경로만 싣고 쿼리·회의 내용은 안 싣는다", () => {
    window.history.replaceState({}, "", "/w/1/notes/2?view=full&tab=summary");
    const text = composeFeedback("  안녕  ");
    expect(text.startsWith("안녕\n")).toBe(true);
    expect(text).toContain("화면: /w/1/notes/2\n");
    expect(text).not.toContain("view=full");
  });
});
