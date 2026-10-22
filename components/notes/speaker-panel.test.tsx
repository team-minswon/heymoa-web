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
    jumpStartsMs: [0, 100_000, 400_000],
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

    // 아직 안 갔을 때는 전체 개수만.
    const button = screen.getByRole("button", { name: /지정하러 가기/ });
    expect(button).toHaveTextContent("3곳");

    // 지금 있는 위치가 보인다.
    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: /다음 발화로/ })
    ).toHaveTextContent("1 / 3");
    fireEvent.click(screen.getByRole("button", { name: /다음 발화로/ }));
    expect(
      screen.getByRole("button", { name: /다음 발화로/ })
    ).toHaveTextContent("2 / 3");
    fireEvent.click(screen.getByRole("button", { name: /다음 발화로/ }));
    expect(
      screen.getByRole("button", { name: /다음 발화로/ })
    ).toHaveTextContent("3 / 3");
    // 끝에서는 처음으로 돌아온다.
    fireEvent.click(screen.getByRole("button", { name: /다음 발화로/ }));
    expect(
      screen.getByRole("button", { name: /다음 발화로/ })
    ).toHaveTextContent("1 / 3");
    // 누를 때마다 패널은 닫혀 도착한 자리를 가리지 않는다.
    expect(onOpenChange).toHaveBeenCalledTimes(4);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("지정된 사람의 첫 문구는 「첫 발화로」다", () => {
    renderPanel([stat({ unassigned: false, name: "한지원" })]);
    expect(
      screen.getByRole("button", { name: /첫 발화로/ })
    ).toBeInTheDocument();
  });

  it("발화가 하나뿐이면 개수 표시 없이 그 발화로만 간다", () => {
    renderPanel([stat({ jumpTargets: ["s1"], jumpStartsMs: [0] })]);
    expect(
      screen.getByRole("button", { name: "지정하러 가기" })
    ).not.toHaveTextContent("/");
  });

  it("띠를 누르면 그 시각 이후 첫 발화로 가고 n / m 이 그 위치로 맞춰진다", () => {
    renderPanel([stat()]);
    const strip = screen.getByTestId("speaker-panel-strip");
    // jsdom 은 레이아웃이 없어 상자를 직접 준다: 폭 600, 회의 600_000ms → 1px = 1000ms.
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 24 }) as DOMRect;

    // 200_000ms 이후 첫 발화는 3번째(400_000ms).
    fireEvent.click(strip, { clientX: 200 });

    expect(
      screen.getByRole("button", { name: /다음 발화로/ })
    ).toHaveTextContent("3 / 3");
  });

  it("띠에 올리면 커서 위치의 시각이 바로 보이고 벗어나면 사라진다", () => {
    renderPanel([stat()]);
    const strip = screen.getByTestId("speaker-panel-strip");
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 24 }) as DOMRect;

    fireEvent.pointerMove(strip, { clientX: 300 });
    // 600_000ms 의 절반 = 5분.
    expect(screen.getByTestId("speaker-panel-strip-time")).toHaveTextContent(
      "5:00"
    );

    fireEvent.pointerLeave(strip);
    expect(screen.queryByTestId("speaker-panel-strip-time")).toBeNull();
  });
});
