import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { Legend } from "@/components/projects/agenda-ribbon-legend";

const ALL = { capsule: true, gap: true, branch: true, fold: true, join: true };

describe("Legend", () => {
  it("영어 화면에서는 기호 설명과 조작 안내가 영어로 보인다", () => {
    const { container } = render(<Legend has={ALL} />, {
      wrapper: intlWrapper("en"),
    });
    expect(screen.getByRole("list", { name: "Key" })).toBeTruthy();
    expect(screen.getByText("Not covered")).toBeTruthy();
    expect(screen.getByText("Drag to move")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
