import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Markdown } from "@/components/chat/markdown";

afterEach(cleanup);

describe("Markdown", () => {
  it("제목 세 층이 각자의 요소로 선다", () => {
    const { container } = render(
      <Markdown content={"# 하나\n\n## 둘\n\n### 셋"} />
    );
    expect(container.querySelector("h1")?.textContent).toBe("하나");
    expect(container.querySelector("h2")?.textContent).toBe("둘");
    expect(container.querySelector("h3")?.textContent).toBe("셋");
  });

  it("코드블록이 언어를 말하고 복사 버튼을 준다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    render(<Markdown content={"```sql\nSELECT 1;\n```"} />);
    expect(screen.getByText("sql")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "코드 복사" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith("SELECT 1;\n");
    vi.unstubAllGlobals();
  });

  it("★ 반쯤 온 마크다운이 화면을 안 깨뜨린다", () => {
    const half = [
      "# 온보딩",
      "",
      "| 단계 | 진입 |",
      "| --- | ",
      "",
      "```sq",
      "SELECT step, count(*)",
    ].join("\n");
    const { container } = render(<Markdown content={half} />);
    expect(container.textContent).toContain("온보딩");
    expect(container.querySelector("pre")).toBeTruthy();
  });

  it("★ 글자를 쪼개지 않는다 — 문단 하나가 span 수십 개였다", () => {
    const { container } = render(
      <Markdown
        content={
          "| 단계 | 비고 |\n| --- | --- |\n| 가입 | 두 낱말 |\n\n`const a = 1`"
        }
      />
    );
    expect(container.querySelector(".md-w")).toBeNull();
    expect(container.querySelector("td")?.textContent).toBe("가입");
    expect(container.querySelector("code")?.textContent).toBe("const a = 1");
  });

  it("이미지는 그리지 않는다", () => {
    const { container } = render(
      <Markdown content={"![추적](https://example.com/pixel.gif)"} />
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
