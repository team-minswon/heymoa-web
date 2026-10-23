import { cleanup, render as rtlRender } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MdBlock } from "@/components/help/md/render";
import { HELP_SAMPLES } from "@/components/help/md/samples";
import { intlWrapper } from "@/components/help/test-intl";

/** 가이드 컴포넌트는 언어 파일을 읽는다 — 실제 마케팅 루트처럼 한국어 언어 파일을 내려 준다. */
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: intlWrapper() });

describe("가이드 마크다운 표현", () => {
  afterEach(cleanup);
  const html = (name: string) => {
    const sample = HELP_SAMPLES.find((s) => s.name.startsWith(name))!;
    return render(<MdBlock source={sample.source} />).container;
  };

  it("번호 목록은 단계 카드가 된다", () => {
    const ol = html("단계").querySelector("ol")!;
    expect(ol.className).toContain("counter-reset");
    expect(ol.querySelectorAll("li")).toHaveLength(3);
    expect(ol.querySelector("li > strong")?.textContent).toBe("[새 노트]를 눌러요");
  });

  it("굵은 라벨 뒤 조사는 붙이고 다른 낱말은 띄운다", () => {
    const text = render(
      <MdBlock source={"**[설정]** 에서 **[정보]** 탭을 열고 **[저장]** 을 눌러요. **[A]** 이름"} />,
    ).container.textContent;
    expect(text).toBe("[설정]에서 [정보] 탭을 열고 [저장]을 눌러요. [A] 이름");
  });

  it("알림 네 종류가 종류 이름과 함께 그려진다", () => {
    const notes = [...html("알림").querySelectorAll("aside[role=note]")];
    expect(notes.map((n) => n.querySelector("strong")?.textContent)).toEqual([
      "참고",
      "팁",
      "주의",
      "되돌릴 수 없어요",
    ]);
    expect(notes[3].querySelector("mark")).not.toBeNull();
  });

  it("표의 ✓ ✗ – 칸은 읽을 수 있는 아이콘 칩이 된다", () => {
    const table = html("표");
    expect(table.querySelectorAll("td .sr-only")).toHaveLength(8);
    expect(table.textContent).toContain("가능");
    expect(table.textContent).toContain("불가");
    expect(table.textContent).not.toContain("✓");
  });

  it("탭은 서버 렌더에서 모든 내용이 보이고, 방향키 역할 속성이 붙는다", () => {
    const tabs = html("탭");
    expect(tabs.textContent).toContain("DMG를 열어요");
    expect(tabs.textContent).toContain("설치 파일을 실행해요");
  });

  it("증상 / 원인 / 해결 방법 세 칸이 선다", () => {
    const labels = [...html("증상").querySelectorAll("dt")].map((d) => d.textContent);
    expect(labels).toEqual(["증상", "원인", "해결 방법"]);
  });

  it("자주 묻는 질문 마크다운 질문은 제목으로 남는다", () => {
    expect(html("자주").querySelectorAll("h3")).toHaveLength(2);
  });

  it("키캡 · 배지 · 형광펜이 그려진다", () => {
    const el = html("형광펜");
    expect(el.querySelector("kbd")?.textContent).toBe("⌘K");
    expect(el.querySelector("mark")?.textContent).toBe("꼭 지킬 말");
    expect(el.textContent).toContain("관리자만");
    expect(el.querySelector('button[aria-label="복사"]')).not.toBeNull();
  });

  it("관련 페이지 목록은 링크로 풀린다", () => {
    const links = [...html("링크").querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/help/start/getting-started", "/help/record/recording"]);
  });
});
