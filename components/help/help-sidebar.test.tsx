import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { helpGroups, situationClusters } from "@/app/(static)/help/_content/groups";
import { HelpSidebar } from "@/components/help/help-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/help/situations/fix-speakers",
}));

const topics = [
  { slug: "fix-speakers", group: "situations", title: "화자 이름 고치기" },
  { slug: "confirm-summary", group: "situations", title: "요약 확정하기" },
];

const weightOf = (el: HTMLElement) =>
  el.className.split(/\s+/).filter((c) => /(^|:)font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/.test(c));

describe("HelpSidebar", () => {
  afterEach(cleanup);

  // 굵기가 달라지면 글자 폭이 달라져 줄바꿈과 목록 높이가 출렁인다.
  it("선택한 항목과 아닌 항목의 굵기·크기 클래스가 같다", () => {
    render(<HelpSidebar
        groups={helpGroups}
        clusters={situationClusters}
        topics={topics}
      />);
    const on = screen.getByRole("link", { name: topics[0].title });
    const off = screen.getByRole("link", { name: topics[1].title });
    expect(on).toHaveAttribute("aria-current", "page");
    expect(weightOf(on)).toEqual(weightOf(off));
  });

  it("누르는 즉시 활성 표시가 옮겨 간다(주소가 바뀌기 전에)", () => {
    render(<HelpSidebar
        groups={helpGroups}
        clusters={situationClusters}
        topics={topics}
      />);
    const off = screen.getByRole("link", { name: topics[1].title });
    fireEvent.click(off, { button: 0 });
    expect(off).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: topics[0].title })
    ).not.toHaveAttribute("aria-current");
  });
});
