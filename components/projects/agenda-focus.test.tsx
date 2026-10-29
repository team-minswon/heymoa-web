import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgendaFocus } from "@/components/projects/agenda-focus";

describe("AgendaFocus", () => {
  it("다시 받은 응답에서 줄기가 사라지면 예외 없이 전체 지도로 돌아간다", () => {
    const onBack = vi.fn();
    const index = { topics: new Map() } as never;
    const { container } = render(
      <AgendaFocus workspaceId="w" map={{} as never} rows={[]} index={index} topicId="gone" onBack={onBack} onPick={() => {}} />
    );
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
