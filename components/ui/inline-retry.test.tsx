import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineRetry } from "@/components/ui/inline-retry";

afterEach(cleanup);

describe("InlineRetry", () => {
  it("기본 문구를 보여주고 다시 시도로 onRetry를 부른다", () => {
    const onRetry = vi.fn();
    render(<InlineRetry onRetry={onRetry} />);

    expect(screen.getByText("불러오지 못했습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("label을 덮어쓴다", () => {
    render(
      <InlineRetry onRetry={() => {}} label="알림을 불러오지 못했습니다" />
    );
    expect(screen.getByText("알림을 불러오지 못했습니다")).toBeInTheDocument();
  });
});
