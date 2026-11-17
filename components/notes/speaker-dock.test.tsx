import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SpeakerDock,
  createCurrentMsStore,
} from "@/components/notes/speaker-dock";
import { TIMELINE_BINS, type SpeakerStat } from "@/lib/notes/speaker-stats";

const three = [
  { segmentId: "a1", startedAtMs: 0, endedAtMs: 10_000 },
  { segmentId: "a2", startedAtMs: 100_000, endedAtMs: 110_000 },
  { segmentId: "a3", startedAtMs: 400_000, endedAtMs: 410_000 },
];

const stat = (overrides: Partial<SpeakerStat> = {}): SpeakerStat => ({
  key: "label:A",
  avatarName: "A",
  name: "화자 A",
  image: null,
  labels: ["A"],
  ownedLabels: [],
  speakingMs: 60_000,
  segmentCount: 3,
  share: 1,
  timeline: Array<number>(TIMELINE_BINS).fill(0.5),
  unassigned: false,
  firstSegmentId: "a1",
  firstStartedAtMs: 0,
  utterances: three,
  stepTargets: three,
  ...overrides,
});

function renderDock(currentMs: number, onJump = vi.fn(), stats = [stat()]) {
  const store = createCurrentMsStore();
  store.set(currentMs);
  render(
    <SpeakerDock
      stats={stats}
      durationMs={600_000}
      currentMsStore={store}
      onJump={onJump}
      renderAssign={() => null}
    />
  );
  return onJump;
}

describe("SpeakerDock", () => {
  afterEach(cleanup);

  it("◀ ▶ 는 지금 시각 기준 이전·다음 발화로 간다", () => {
    const onJump = renderDock(100_000);
    fireEvent.click(screen.getByRole("button", { name: "화자 A 다음 발화" }));
    expect(onJump).toHaveBeenLastCalledWith("a3", "step");
    fireEvent.click(screen.getByRole("button", { name: "화자 A 이전 발화" }));
    expect(onJump).toHaveBeenLastCalledWith("a1", "step");
  });

  it("처음·끝에서는 그쪽 버튼이 잠긴다", () => {
    renderDock(0);
    expect(
      screen.getByRole("button", { name: "화자 A 이전 발화" })
    ).toBeDisabled();
  });

  describe("짧은 발화 사이 이동", () => {
    const short = [
      { segmentId: "s1", startedAtMs: 10_000, endedAtMs: 11_000 },
      { segmentId: "s2", startedAtMs: 11_300, endedAtMs: 11_800 },
      { segmentId: "long", startedAtMs: 50_000, endedAtMs: 60_000 },
      { segmentId: "s3", startedAtMs: 90_000, endedAtMs: 90_800 },
    ];
    const shortStat = stat({ utterances: short, stepTargets: [short[2]] });
    const buttons = () => ({
      prev: screen.getByRole("button", { name: "화자 A 이전 발화" }),
      next: screen.getByRole("button", { name: "화자 A 다음 발화" }),
    });

    it.each([
      [0, null, "s1"],
      [10_000, null, "s2"],
      [11_300, "s1", "long"],
      [50_000, "s2", "s3"],
      [90_000, "long", null],
    ])("세로선 %i ms 에서 이전 %s · 다음 %s", (at, prev, next) => {
      const onJump = renderDock(at, vi.fn(), [shortStat]);
      const { prev: prevButton, next: nextButton } = buttons();
      if (next) {
        fireEvent.click(nextButton);
        expect(onJump).toHaveBeenLastCalledWith(next, "step");
      } else expect(nextButton).toBeDisabled();
      if (prev) {
        fireEvent.click(prevButton);
        expect(onJump).toHaveBeenLastCalledWith(prev, "step");
      } else expect(prevButton).toBeDisabled();
    });

    it("두 발화 사이에서는 세로선 바로 앞뒤 발화로 간다", () => {
      const onJump = renderDock(30_000, vi.fn(), [shortStat]);
      fireEvent.click(buttons().next);
      expect(onJump).toHaveBeenLastCalledWith("long", "step");
      fireEvent.click(buttons().prev);
      expect(onJump).toHaveBeenLastCalledWith("s2", "step");
    });
  });

  it("띠를 누르면 누른 시각에 가장 가까운 발화로 간다", () => {
    const onJump = renderDock(0);
    const strip = screen.getByTestId("speaker-dock-strip");
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 20 }) as DOMRect;
    fireEvent.click(strip, { clientX: 200 });
    expect(onJump).toHaveBeenCalledWith("a2", "strip");
    fireEvent.click(strip, { clientX: 300 });
    expect(onJump).toHaveBeenLastCalledWith("a3", "strip");
  });

  function clickAt(
    clientX: number,
    targets: { id: string; start: number; end: number }[],
    durationMs = 3_060_000
  ) {
    const onJump = vi.fn();
    render(
      <SpeakerDock
        stats={[
          stat({
            utterances: targets.map((t) => ({
              segmentId: t.id,
              startedAtMs: t.start,
              endedAtMs: t.end,
            })),
          }),
        ]}
        durationMs={durationMs}
        currentMsStore={createCurrentMsStore()}
        onJump={onJump}
        renderAssign={() => null}
      />
    );
    const strip = screen.getByTestId("speaker-dock-strip");
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: durationMs / 1000, top: 0, height: 20 }) as DOMRect;
    fireEvent.click(strip, { clientX });
    return onJump;
  }

  it("긴 발언 한가운데를 누르면 다음 발언이 아니라 그 발언으로 간다", () => {
    const onJump = clickAt(300, [
      { id: "long", start: 100_000, end: 400_000 },
      { id: "after", start: 450_000, end: 460_000 },
    ]);
    expect(onJump).toHaveBeenCalledWith("long", "strip");
  });

  it("품은 발화가 없으면 앞뒤로 가장 가까운 발화로 간다", () => {
    const onJump = clickAt(2804, [
      { id: "m1", start: 2_782_560, end: 2_785_000 },
      { id: "m2", start: 2_919_240, end: 2_922_000 },
    ]);
    expect(onJump).toHaveBeenCalledWith("m1", "strip");
  });

  it("1시간 회의 끝부분의 1초 발화를 누르면 그 발화로 간다", () => {
    const onJump = clickAt(
      3516,
      [
        { id: "early", start: 60_000, end: 90_000 },
        { id: "ne", start: 3_516_000, end: 3_517_200 },
      ],
      3_600_000
    );
    expect(onJump).toHaveBeenCalledWith("ne", "strip");
  });

  it("마지막 발화 뒤를 눌러도 마지막 발화로 간다", () => {
    const onJump = clickAt(3000, [
      { id: "m1", start: 100_000, end: 110_000 },
      { id: "last", start: 2_900_000, end: 2_950_000 },
    ]);
    expect(onJump).toHaveBeenCalledWith("last", "strip");
  });

  it("지금 시각이 세로선 위치로 선다", () => {
    renderDock(300_000);
    expect(screen.getByTestId("speaker-dock-now").style.left).toBe("50%");
  });

  it("말한 기록이 없는 사람은 줄이 없다", () => {
    renderDock(0, vi.fn(), [
      stat(),
      stat({
        key: "p",
        name: "조용한 사람",
        utterances: [],
        stepTargets: [],
      }),
    ]);
    expect(screen.getAllByTestId("speaker-dock-row")).toHaveLength(1);
  });

  it("접으면 줄이 사라지고 알약이 서며, 다시 누르면 펼쳐진다", async () => {
    renderDock(0);
    fireEvent.click(screen.getByRole("button", { name: "화자 도크 접기" }));
    await waitFor(() =>
      expect(screen.queryByTestId("speaker-dock-row")).toBeNull()
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "화자 도크 펼치기" })
    );
    expect(await screen.findAllByTestId("speaker-dock-row")).toHaveLength(1);
  });
});

describe("createCurrentMsStore 고정", () => {
  it("이동으로 고정한 시각은 스크롤 측정이 덮지 않고, 직접 스크롤하면 다시 따른다", () => {
    const store = createCurrentMsStore();
    store.pin(2_760_000);
    store.set(2_700_000);
    expect(store.get()).toBe(2_760_000);
    store.release();
    store.set(2_700_000);
    expect(store.get()).toBe(2_700_000);
  });
});

describe("SpeakerDock 활성 줄", () => {
  it("같은 초에 다른 화자가 바로 뒤이어 말해도 이동한 화자 줄이 켜진다", () => {
    const kim = stat({
      key: "label:K",
      name: "김민수",
      utterances: [{ segmentId: "k1", startedAtMs: 589_000, endedAtMs: 589_400 }],
    });
    const kang = stat({
      key: "label:G",
      name: "강상진",
      utterances: [{ segmentId: "g1", startedAtMs: 589_300, endedAtMs: 590_500 }],
    });
    renderDock(589_000, vi.fn(), [kang, kim]);
    const rows = screen.getAllByTestId("speaker-dock-row");
    const active = rows.find((row) => row.hasAttribute("data-active"));
    expect(active).toHaveTextContent("김민수");
  });
});
