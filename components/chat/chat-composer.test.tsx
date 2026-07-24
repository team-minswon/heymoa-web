import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatComposer } from "@/components/chat/chat-composer";

const base = {
  draft: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onStop: vi.fn(),
  isBusy: false,
  isStreaming: false,
  placeholder: "물어보세요",
};

describe("ChatComposer", () => {
  afterEach(cleanup);

  it("shows the send control when idle and submits the form", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer {...base} draft="안녕" onSubmit={onSubmit} />);

    const send = screen.getByRole("button", { name: "보내기" });
    expect(send).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "중지" })).toBeNull();
    fireEvent.submit(send.closest("form")!);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("swaps send for stop while streaming", () => {
    const onStop = vi.fn();
    render(<ChatComposer {...base} isStreaming onStop={onStop} />);

    fireEvent.click(screen.getByRole("button", { name: "중지" }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();
  });

  it("disables the input and send while busy", () => {
    render(<ChatComposer {...base} isBusy />);
    expect(screen.getByRole("textbox", { name: "메시지" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("renders a context footer (e.g. 승인 대기 안내)", () => {
    render(<ChatComposer {...base} footer={<p>승인 대기</p>} />);
    expect(screen.getByText("승인 대기")).toBeInTheDocument();
  });
});
