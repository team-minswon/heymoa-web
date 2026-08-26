import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Markdown } from "@/components/chat/markdown";

afterEach(cleanup);

describe("Markdown", () => {
  it("제목 세 층이 각자의 요소로 선다", () => {
    // 셋 다 같은 굵은 글씨였다 — 답이 길어지면 어디가 절이고 어디가 그 안인지 안 보였다.
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
    /**
     * ★ **복사한 값을 그대로 본다.** 「언어 라벨이 안 섞였다」만 재면 안 된다 — 한때
     * 본문을 `innerText` 에서 읽었는데 **jsdom 에는 그 속성이 없어서** 늘 빈 문자열이
     * 복사됐고, `not.toContain` 이 빈 문자열을 상대로 통과했다. 없는 것을 재고 있었다.
     */
    expect(writeText).toHaveBeenCalledWith("SELECT 1;\n");
    vi.unstubAllGlobals();
  });

  it("★ 반쯤 온 마크다운이 화면을 안 깨뜨린다", () => {
    // 스트리밍 중에는 늘 부분 마크다운이다. 닫히지 않은 코드펜스와 잘린 표가 오류가
    // 아니라 정상 입력이고, 여기서 `children` 모양을 가정하는 코드가 제일 먼저 터진다.
    const half = [
      "# 온보딩",
      "",
      "| 단계 | 진입 |",
      "| --- | ",
      "",
      "```sq",
      "SELECT step, count(*)",
    ].join("\n");
    const { container } = render(<Markdown content={half} animate />);
    expect(container.textContent).toContain("온보딩");
    expect(container.querySelector("pre")).toBeTruthy();
  });

  it("★ 낱말 쪼개기가 표 셀까지 가고 코드 안은 안 건드린다", () => {
    // 코드는 공백이 의미라 쪼개면 깨진다. 표 셀은 본문이라 같이 떠올라야 한다.
    const { container } = render(
      <Markdown
        content={"| 단계 | 비고 |\n| --- | --- |\n| 가입 | 두 낱말 |\n\n`const a = 1`"}
        animate
      />
    );
    expect(container.querySelectorAll("td .md-w").length).toBeGreaterThan(1);
    expect(container.querySelector("code")?.querySelector(".md-w")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe("const a = 1");
  });

  it("이미지는 그리지 않는다", () => {
    // 일부러다. 답변에 원격 이미지가 실릴 경로가 없고, 열어 두면 URL 하나로 열람
    // 사실이 밖으로 새는 픽셀이 된다.
    const { container } = render(
      <Markdown content={"![추적](https://example.com/pixel.gif)"} />
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
