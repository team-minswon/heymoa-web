import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpeakerPanel } from "@/components/notes/speaker-panel";
import { TIMELINE_BINS, type SpeakerStat } from "@/lib/notes/speaker-stats";

function stat(overrides: Partial<SpeakerStat> = {}): SpeakerStat {
  return {
    key: "label:A",
    avatarName: "A",
    name: "화자 A",
    image: null,
    labels: ["A"],
    ownedLabels: [],
    speakingMs: 60_000,
    segmentCount: 3,
    share: 1,
    timeline: Array<number>(TIMELINE_BINS).fill(0),
    unassigned: true,
    firstSegmentId: "s1",
    firstStartedAtMs: 0,
    jumpTargets: ["s1", "s2", "s3"],
    ...overrides,
  };
}

function renderPanel(stats: SpeakerStat[]) {
  const onOpenChange = vi.fn();
  render(
    <SpeakerPanel
      open
      onOpenChange={onOpenChange}
      stats={stats}
      durationMs={600_000}
      onJump={vi.fn()}
      onReset={vi.fn()}
      resetting={false}
      resettable={false}
    />
  );
  return { onOpenChange };
}

describe("SpeakerPanel 다음 발화로 이동", () => {
  afterEach(cleanup);

  it("누를 때마다 그 사람의 다음 발화로 돌고 몇 번째인지 보인다", () => {
    const { onOpenChange } = renderPanel([stat()]);

    // 아직 안 갔을 때는 지금까지의 문구와 1 / 3.
    const button = screen.getByRole("button", { name: /지정하러 가기/ });
    expect(button).toHaveTextContent("1 / 3");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /다음 발화로/ })).toHaveTextContent("2 / 3");
    fireEvent.click(screen.getByRole("button", { name: /다음 발화로/ }));
    expect(screen.getByRole("button", { name: /다음 발화로/ })).toHaveTextContent("3 / 3");
    // 끝에서는 처음으로 돌아온다.
    fireEvent.click(screen.getByRole("button", { name: /다음 발화로/ }));
    expect(screen.getByRole("button", { name: /다음 발화로/ })).toHaveTextContent("1 / 3");
    // 누를 때마다 패널은 닫혀 도착한 자리를 가리지 않는다.
    expect(onOpenChange).toHaveBeenCalledTimes(3);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("지정된 사람의 첫 문구는 「첫 발화로」다", () => {
    renderPanel([stat({ unassigned: false, name: "한지원" })]);
    expect(screen.getByRole("button", { name: /첫 발화로/ })).toBeInTheDocument();
  });

  it("발화가 하나뿐이면 개수 표시 없이 그 발화로만 간다", () => {
    renderPanel([stat({ jumpTargets: ["s1"] })]);
    expect(screen.getByRole("button", { name: "지정하러 가기" })).not.toHaveTextContent("/");
  });
});
