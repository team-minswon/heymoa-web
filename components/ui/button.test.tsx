import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("preserves label geometry while showing an overlay spinner", () => {
    const { rerender } = render(<Button>저장하기</Button>);
    const button = screen.getByRole("button", { name: "저장하기" });
    const label = screen.getByText("저장하기");

    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.children).toHaveLength(1);

    rerender(<Button loading>저장하기</Button>);

    expect(screen.getByRole("button", { name: "저장하기" })).toBe(button);
    expect(screen.getByText("저장하기")).toBe(label);
    expect(label).toHaveClass("opacity-0", "pointer-events-none");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-loading");
    expect(button.children).toHaveLength(2);
    expect(button.children[1]).toHaveClass("absolute", "inset-0");
    expect(button.children[1].querySelector("svg")).toHaveClass("animate-spin");

    rerender(<Button>저장하기</Button>);

    expect(screen.getByText("저장하기")).toBe(label);
    expect(label).not.toHaveClass("opacity-0", "pointer-events-none");
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).not.toHaveAttribute("data-loading");
    expect(button.children).toHaveLength(1);
  });
});
