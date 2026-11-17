import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { SpeakerPanel } from "@/components/notes/speaker-panel";
import { TIMELINE_BINS, type SpeakerStat } from "@/lib/notes/speaker-stats";

const three = [
  { segmentId: "s1", startedAtMs: 0, endedAtMs: 10_000 },
  { segmentId: "s2", startedAtMs: 100_000, endedAtMs: 110_000 },
  { segmentId: "s3", startedAtMs: 400_000, endedAtMs: 410_000 },
];

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
    utterances: three,
    stepTargets: three,
    ...overrides,
  };
}

function renderPanel(
  stats: SpeakerStat[],
  wrapper?: ReturnType<typeof intlWrapper>
) {
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
    />,
    { wrapper }
  );
  return { onOpenChange };
}

describe("SpeakerPanel 다음 발화로 이동", () => {
  afterEach(cleanup);

  it("누를 때마다 그 사람의 다음 발화로 돌고 몇 번째인지 보인다", () => {
    const { onOpenChange } = renderPanel([stat()]);

    const button = screen.getByRole("button", { name: /지정하러 가기/ });
    expect(button).toHaveTextContent("3곳");

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
    fireEvent.click(screen.getByRole("button", { name: /다음 발화로/ }));
    expect(
      screen.getByRole("button", { name: /다음 발화로/ })
    ).toHaveTextContent("1 / 3");
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
    renderPanel([
      stat({ utterances: three.slice(0, 1), stepTargets: three.slice(0, 1) }),
    ]);
    expect(
      screen.getByRole("button", { name: "지정하러 가기" })
    ).not.toHaveTextContent("/");
  });

  it("띠를 누르면 누른 시각에 가장 가까운 발화로 가고 n / m 이 그 위치로 맞춰진다", () => {
    renderPanel([stat()]);
    const strip = screen.getByTestId("speaker-panel-strip");
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 24 }) as DOMRect;

    fireEvent.click(strip, { clientX: 200 });

    expect(
      screen.getByRole("button", { name: /다음 발화로/ })
    ).toHaveTextContent("2 / 3");
  });

  it("띠로 맞장구에 가도 「다음 발화로」는 그 뒤의 대목으로 이어 간다", () => {
    const short = { segmentId: "ne", startedAtMs: 200_000, endedAtMs: 201_000 };
    renderPanel([
      stat({
        utterances: [three[0], three[1], short, three[2]],
        stepTargets: three,
      }),
    ]);
    const strip = screen.getByTestId("speaker-panel-strip");
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 24 }) as DOMRect;

    fireEvent.click(strip, { clientX: 200 });
    const button = screen.getByRole("button", { name: /다음 발화로/ });
    expect(button).toHaveTextContent("3곳");
    fireEvent.click(button);
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
    expect(screen.getByTestId("speaker-panel-strip-time")).toHaveTextContent(
      "5:00"
    );

    fireEvent.pointerLeave(strip);
    expect(screen.queryByTestId("speaker-panel-strip-time")).toBeNull();
  });
});

describe("SpeakerPanel 영어 화면", () => {
  afterEach(cleanup);

  it("영어 문구로 그리고 한글이 남지 않는다", () => {
    renderPanel(
      [
        stat({ name: "Speaker A" }),
        stat({
          key: "p1",
          name: "Dana",
          unassigned: false,
          speakingMs: 0,
          utterances: [],
          stepTargets: [],
        }),
      ],
      intlWrapper("en")
    );

    expect(
      screen.getByRole("button", { name: /Start assigning/ })
    ).toHaveTextContent("3 lines");
    expect(screen.getByText("Didn't speak")).toBeTruthy();
    expect(
      screen.getByText("1 participant · 1 unassigned speaker · Meeting 10m")
    ).toBeTruthy();
    expect(screen.getByText("1m")).toBeTruthy();
    expect(screen.getByRole("list").textContent).not.toMatch(/[가-힣]/);
  });
});
