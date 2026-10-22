import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  graduateTimelineHint,
  TIMELINE_HINT_MS,
  TimelineHint,
  timelineHintEligible,
} from "@/components/notes/timeline-hint";
import { onTrack } from "@/lib/analytics/track";

const TEXT = "타임라인에 정리된 항목이 생겼어요";

// 움직임 줄이기 설정만 바꿔 끼운다. 나머지 motion 은 진짜다 — 퇴장이 끝나야 빠지는지를 본다.
let reducedMotion = false;
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reducedMotion,
}));

/** 퇴장 애니메이션(150ms)이 끝날 만큼 프레임을 흘린다. */
async function finishExit() {
  await act(() => vi.advanceTimersByTimeAsync(400));
}

function setup(props: Partial<Parameters<typeof TimelineHint>[0]> = {}) {
  const onOpen = vi.fn();
  const heard: Array<[string, unknown]> = [];
  const stop = onTrack((event, properties) => heard.push([event, properties]));
  const all = {
    noteId: "N1",
    workspaceId: "W1",
    eligible: true,
    role: "viewer" as const,
    onOpen,
    ...props,
  };
  const view = render(<TimelineHint {...all} />);
  return {
    onOpen,
    heard,
    stop,
    rerender: (next: Partial<typeof all>) =>
      view.rerender(<TimelineHint {...all} {...next} />),
    unmount: view.unmount,
  };
}

beforeEach(() => {
  // motion 은 requestAnimationFrame·performance 로 프레임을 돈다 — 그것까지 가짜로 돌려야 퇴장이 끝난다.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "queueMicrotask",
    ],
  });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(async () => {
  cleanup();
  // motion 의 프레임 루프는 모듈 상태다. 가짜 requestAnimationFrame 에 걸어 둔 프레임을 남긴 채 진짜
  // 타이머로 돌아가면 다음 시험에서 루프가 영영 안 돈다 — 돌던 애니메이션을 다 끝내고 넘긴다.
  await act(() => vi.advanceTimersByTimeAsync(1000));
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  reducedMotion = false;
});

describe("timelineHintEligible", () => {
  it("진행 중이거나 중지된 회의에서 항목이 있고 스크립트를 볼 때만 띄운다", () => {
    const base = { phase: "active" as const, tab: "transcript", itemCount: 1 };
    expect(timelineHintEligible(base)).toBe(true);
    expect(timelineHintEligible({ ...base, phase: "paused" })).toBe(true);
    expect(timelineHintEligible({ ...base, itemCount: 0 })).toBe(false);
    expect(timelineHintEligible({ ...base, tab: "context" })).toBe(false);
    expect(timelineHintEligible({ ...base, tab: "details" })).toBe(false);
    expect(timelineHintEligible({ ...base, phase: "ended" })).toBe(false);
    expect(timelineHintEligible({ ...base, phase: "not-started" })).toBe(false);
    expect(timelineHintEligible({ ...base, phase: "unknown" })).toBe(false);
  });
});

describe("TimelineHint", () => {
  it.each(["recorder", "viewer"] as const)(
    "%s 에게 뜨고 띄운 사건을 역할과 함께 한 번 보낸다",
    (role) => {
      const { heard, stop, rerender } = setup({ role });
      expect(screen.getByText(TEXT)).toBeTruthy();
      rerender({ eligible: false });
      rerender({ eligible: true });
      stop();
      expect(heard).toEqual([
        ["timeline_hint_shown", { workspace_id: "W1", role }],
      ]);
    }
  );

  it("자격이 없으면 그리지 않는다", () => {
    setup({ eligible: false });
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("60초 뒤 저절로 사라지고, 숨은 창·포커스 없음·마우스가 올라간 동안은 세지 않는다", async () => {
    const { heard, stop } = setup();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS * 2));
    hidden.mockReturnValue(false);
    vi.mocked(document.hasFocus).mockReturnValue(false);
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS * 2));
    vi.mocked(document.hasFocus).mockReturnValue(true);
    fireEvent.mouseEnter(screen.getByRole("status"));
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS * 2));
    expect(screen.getByText(TEXT)).toBeTruthy();

    fireEvent.mouseLeave(screen.getByRole("status"));
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS - 250));
    expect(screen.getByText(TEXT)).toBeTruthy();
    act(() => vi.advanceTimersByTime(250));
    await finishExit();
    expect(screen.queryByText(TEXT)).toBeNull();
    stop();
    expect(heard.at(-1)).toEqual([
      "timeline_hint_dismissed",
      { workspace_id: "W1", reason: "auto" },
    ]);
  });

  it("저절로 사라지면 그 회의에서는 다시 안 뜨고 다음 회의에 한 번 더 뜬다", () => {
    const first = setup({ noteId: "N1" });
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS));
    first.unmount();

    setup({ noteId: "N1" }).unmount();
    expect(screen.queryByText(TEXT)).toBeNull();

    const second = setup({ noteId: "N2" });
    expect(screen.getByText(TEXT)).toBeTruthy();
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS));
    second.unmount();

    setup({ noteId: "N3" });
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("말풍선을 누르면 타임라인으로 옮기고 다시 안 뜬다", () => {
    const { onOpen, heard, stop, unmount } = setup({ role: "recorder" });
    fireEvent.click(screen.getByText(TEXT));
    stop();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(heard.at(-1)).toEqual([
      "timeline_hint_clicked",
      { workspace_id: "W1", role: "recorder" },
    ]);
    unmount();
    setup({ noteId: "N2" });
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("×로 닫으면 다시 안 뜬다", async () => {
    const { heard, stop, unmount } = setup();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    stop();
    await finishExit();
    expect(screen.queryByText(TEXT)).toBeNull();
    expect(heard.at(-1)).toEqual([
      "timeline_hint_dismissed",
      { workspace_id: "W1", reason: "close" },
    ]);
    unmount();
    setup({ noteId: "N2" });
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("타임라인 탭을 직접 열었으면 다시 안 뜬다", () => {
    graduateTimelineHint();
    setup();
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("저장소가 막혀도 닫은 회의에서는 다시 안 뜬다", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { rerender } = setup();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    rerender({ eligible: true });
    await finishExit();
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("키보드 포커스가 안에 있는 동안은 세지 않고, 남은 시간 막대도 같이 선다", async () => {
    setup();
    const bar = () =>
      screen.getByTestId("countdown-bar").firstElementChild as HTMLElement;
    expect(bar().style.animation).toContain(`${TIMELINE_HINT_MS}ms`);
    fireEvent.focus(screen.getByRole("button", { name: "안내 닫기" }));
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS * 2));
    expect(screen.getByText(TEXT)).toBeTruthy();
    expect(bar().style.animationPlayState).toBe("paused");

    fireEvent.blur(screen.getByRole("button", { name: "안내 닫기" }));
    act(() => vi.advanceTimersByTime(250));
    expect(bar().style.animationPlayState).toBe("running");
    act(() => vi.advanceTimersByTime(TIMELINE_HINT_MS));
    await finishExit();
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("닫으면 퇴장 애니메이션 동안 남아 있다가(누를 수 없음) 끝난 뒤 빠진다", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByRole("status")).toHaveAttribute("inert");
    await finishExit();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("자격을 잃어 접히는 중에 다시 자격이 생기면 같은 말풍선이 되돌아온다", async () => {
    const { heard, stop, rerender } = setup();
    rerender({ eligible: false });
    act(() => vi.advanceTimersByTime(16));
    rerender({ eligible: true });
    await finishExit();
    expect(screen.getByRole("status")).not.toHaveAttribute("inert");
    stop();
    expect(
      heard.filter(([event]) => event === "timeline_hint_shown")
    ).toHaveLength(1);
  });

  it("움직임 줄이기 설정이면 닫는 즉시 빠진다", () => {
    reducedMotion = true;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
