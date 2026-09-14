import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReviewShowcase, SCENARIOS } from "@/components/mocks/review-showcase";

afterEach(cleanup);

describe("ReviewShowcase", () => {
  it("장면을 고르면 두 폭의 화면과 해 볼 것이 그 장면으로 바뀐다", () => {
    render(<ReviewShowcase />);

    const frames = () => screen.getAllByTitle(/미리보기$/) as HTMLIFrameElement[];
    expect(frames()).toHaveLength(2);
    expect(frames()[0].getAttribute("src")).toBe(SCENARIOS[0].path);

    fireEvent.click(screen.getByRole("button", { name: "전체 할 일" }));

    expect(frames().every((frame) => frame.getAttribute("src") === "/w/01K0000000000/tasks")).toBe(true);
    expect(within(screen.getByRole("list", { name: "해 볼 것" })).getByText("진행 중 · 완료 · 취소 바꾸기")).toBeInTheDocument();
  });

  it("화면 폭을 고르면 그 폭만 띄운다", () => {
    render(<ReviewShowcase />);

    fireEvent.click(screen.getByRole("radio", { name: "모바일" }));
    expect(screen.getAllByTitle(/미리보기$/).map((frame) => frame.getAttribute("title"))).toEqual(["모바일 390 미리보기"]);

    fireEvent.click(screen.getByRole("radio", { name: "데스크톱" }));
    expect(screen.getAllByTitle(/미리보기$/).map((frame) => frame.getAttribute("title"))).toEqual(["데스크톱 1280 미리보기"]);
  });
});
