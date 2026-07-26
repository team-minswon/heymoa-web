import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataBoundary } from "@/components/ui/data-boundary";

afterEach(cleanup);

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

// 첫 호출은 reject, 리셋 후 재호출은 성공 — resetErrorBoundary가 재요청을 유발함을 검증.
function makeFlakyChild() {
  let attempt = 0;
  return function Child() {
    const { data } = useSuspenseQuery({
      queryKey: ["flaky"],
      queryFn: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("boom");
        return "성공 데이터";
      },
    });
    return <div>{data}</div>;
  };
}

describe("DataBoundary", () => {
  it("로딩 중 fallback을, 실패 시 InlineRetry를, 재시도 후 데이터를 보여준다", async () => {
    const Child = makeFlakyChild();
    wrap(
      <DataBoundary
        fallback={<div>로딩중</div>}
        errorLabel="목록을 불러오지 못했습니다"
      >
        <Child />
      </DataBoundary>
    );

    expect(screen.getByText("로딩중")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("목록을 불러오지 못했습니다")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.getByText("성공 데이터")).toBeInTheDocument()
    );
  });
});
