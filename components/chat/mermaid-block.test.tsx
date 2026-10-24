import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Markdown } from "@/components/chat/markdown";
import { renderMermaid } from "@/components/chat/mermaid-block";
import { messagesFor } from "@/i18n/messages";
import { onTrack } from "@/lib/analytics/track";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="ko" messages={messagesFor("ko")}>
    {children}
  </NextIntlClientProvider>
);

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));
vi.mock("mermaid", () => ({ default: mermaid }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const FENCE = "```mermaid\ngraph TD\n  A-->B\n```";

describe("mermaid 코드펜스", () => {
  it("동적으로 불러온 뒤 SVG 도표로 바뀌고 strict 로 그린다", async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 100 50"><text>A</text></svg>',
    });
    const { container } = render(<Markdown content={FENCE} />, { wrapper });

    const diagram = await screen.findByTestId("mermaid-diagram");
    expect(diagram.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("pre")).toBeNull();
    expect(mermaid.render).toHaveBeenCalledWith(
      expect.any(String),
      "graph TD\n  A-->B\n"
    );
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: "strict",
        htmlLabels: false,
      })
    );
    expect(screen.getByRole("button", { name: "크게 보기" })).toBeTruthy();
  });

  it("스트리밍 중에는 그리지 않고 코드로 둔다", async () => {
    render(<Markdown content={FENCE} streaming />, { wrapper });
    await Promise.resolve();
    expect(screen.getByText("mermaid")).toBeTruthy();
    expect(screen.queryByTestId("mermaid-diagram")).toBeNull();
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it("문법 오류면 코드블록으로 되돌리고 한 줄 알린다", async () => {
    mermaid.render.mockRejectedValue(new Error("Parse error"));
    const { container } = render(<Markdown content={FENCE} />, { wrapper });

    expect(await screen.findByText("도표를 그리지 못했어요")).toBeTruthy();
    expect(container.querySelector("pre")?.textContent).toContain("A-->B");
    expect(screen.queryByTestId("mermaid-diagram")).toBeNull();
  });

  it("크게 보기에서 +/− 로 배율이 바뀌고 맞춤으로 돌아온다", async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 100 50"><text>A</text></svg>',
    });
    render(<Markdown content={FENCE} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "크게 보기" }));

    // jsdom 은 크기를 못 재 맞춤이 원래 크기(100%)다.
    const zoom = await screen.findByTestId("mermaid-zoom");
    expect(zoom.textContent).toBe("100%");
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(zoom.textContent).toBe("125%");
    fireEvent.click(screen.getByRole("button", { name: "축소" }));
    fireEvent.click(screen.getByRole("button", { name: "축소" }));
    expect(zoom.textContent).toBe("80%");
    // 맞춤의 0.5배 아래로는 안 내려간다.
    for (let i = 0; i < 5; i++)
      fireEvent.click(screen.getByRole("button", { name: "축소" }));
    expect(zoom.textContent).toBe("50%");
    fireEvent.click(screen.getByRole("button", { name: "맞춤" }));
    expect(zoom.textContent).toBe("100%");
  });

  it("크게 보기를 열면 속성 없이 한 번 센다", async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 100 50"><text>A</text></svg>',
    });
    const events: unknown[][] = [];
    const stop = onTrack((...args) => events.push(args));
    render(<Markdown content={FENCE} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "크게 보기" }));
    await screen.findByTestId("mermaid-zoom");
    stop();

    expect(events).toEqual([["chat_diagram_expanded", undefined]]);
  });

  it("영문판에서는 도표 문구가 영어다", async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 100 50"><text>A</text></svg>',
    });
    render(<Markdown content={FENCE} />, {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="en" messages={messagesFor("en")}>
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(await screen.findByRole("button", { name: "Expand" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show code" })).toBeTruthy();
  });

  it("크게 보기는 레일과 다른 id 로 다시 그린다", async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 100 50"><text>A</text></svg>',
    });
    render(<Markdown content={FENCE} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "크게 보기" }));
    await screen.findByTestId("mermaid-zoom");

    expect(mermaid.render).toHaveBeenCalledTimes(2);
    const [rail, modal] = mermaid.render.mock.calls.map((c) => c[0]);
    expect(modal).not.toBe(rail);
  });

  it("렌더는 직렬로 돈다 — 설정과 렌더가 한 작업이라 테마가 안 섞인다", async () => {
    const log: string[] = [];
    let finishFirst!: () => void;
    mermaid.initialize.mockImplementation((c: { theme: string }) =>
      log.push(`init:${c.theme}`)
    );
    mermaid.render
      .mockImplementationOnce((id: string) => {
        log.push(`render:${id}`);
        return new Promise((r) => (finishFirst = () => r({ svg: "<svg/>" })));
      })
      .mockImplementationOnce((id: string) => {
        log.push(`render:${id}`);
        return Promise.resolve({ svg: "<svg/>" });
      });

    const a = renderMermaid("a", "graph TD", "neutral");
    const b = renderMermaid("b", "graph TD", "dark");
    await vi.waitFor(() => expect(log).toEqual(["init:neutral", "render:a"]));
    finishFirst();
    await Promise.all([a, b]);
    expect(log).toEqual(["init:neutral", "render:a", "init:dark", "render:b"]);
  });
});
