import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MentionInput, type MentionHandle } from "@/components/chat/mention-input";

describe("MentionInput.prepend", () => {
  it("비운 입력칸에 범위 칩을 붙이면 캐럿은 칩과 한 칸 띄운 뒤에 선다", () => {
    const ref = createRef<MentionHandle>();
    render(
      <MentionInput
        ref={ref as React.RefObject<MentionHandle | null>}
        placeholder="물어보세요"
        onQueryChange={vi.fn()}
        onChipsChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const box = screen.getByRole("textbox");
    box.focus();
    const start = document.createRange();
    start.setStart(box, 0);
    start.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(start);

    ref.current!.prepend({ kind: "note", id: "n1", title: "주간 회의" });

    const caret = window.getSelection()!.getRangeAt(0);
    const probe = document.createRange();
    probe.setStart(box, 0);
    probe.setEnd(caret.startContainer, caret.startOffset);
    // 칩 하나 + 공백 하나가 캐럿 앞에 있다
    expect(probe.cloneContents().childNodes.length).toBe(2);
    expect(probe.toString().endsWith(" ")).toBe(true);
  });
});
