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
  vi.useFakeTimers();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
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

  it("12초 뒤 저절로 사라지고, 숨은 창·포커스 없음·마우스가 올라간 동안은 세지 않는다", () => {
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

  it("×로 닫으면 다시 안 뜬다", () => {
    const { heard, stop, unmount } = setup();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    stop();
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

  it("저장소가 막혀도 닫은 회의에서는 다시 안 뜬다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { rerender } = setup();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    rerender({ eligible: true });
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});
