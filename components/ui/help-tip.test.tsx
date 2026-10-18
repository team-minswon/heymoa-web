import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HelpTip } from "@/components/ui/help-tip";

afterEach(cleanup);

describe("HelpTip", () => {
  it("이름을 「도움말: 제목」으로 읽히고, 눌러서 열고 Esc 로 닫는다", async () => {
    render(<HelpTip label="용어 사전">설명 문장이에요.</HelpTip>);
    const trigger = screen.getByRole("button", { name: "도움말: 용어 사전" });
    expect(trigger).toHaveAccessibleDescription("설명 문장이에요.");

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getAllByText("설명 문장이에요.")).toHaveLength(2)
    );
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.getAllByText("설명 문장이에요.")).toHaveLength(1)
    );
  });

  it("키보드 포커스로도 열린다", async () => {
    render(<HelpTip label="회의 맥락">맥락 설명이에요.</HelpTip>);
    screen.getByRole("button", { name: "도움말: 회의 맥락" }).focus();
    await waitFor(() =>
      expect(screen.getAllByText("맥락 설명이에요.")).toHaveLength(2)
    );
  });
});
