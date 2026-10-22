import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TopicIndex } from "@/components/notes/review/topic-index";
import type { TopicDigest } from "@/lib/notes/review/topics";

const topic = (agendaId: string, ordinal: number): TopicDigest => ({
  key: agendaId,
  agendaId,
  ordinal,
  title: `안건 ${ordinal}`,
  count: 0,
  gist: "요약",
  text: "요약",
  description: [],
  conclusions: [],
  openItems: [],
  startMs: null,
  endMs: null,
  decisions: [],
  tasks: [],
  open: [],
});

const scroll = vi.fn();
const scrollDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView"
);

beforeEach(() => {
  scroll.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  });
});

afterEach(() => {
  cleanup();
  if (scrollDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      scrollDescriptor
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("안건 주소 이동", () => {
  it("링크로 한 번 이동한 뒤 항목 저장·재조회로 주제 배열이 바뀌어도 읽던 위치와 초점을 지킨다", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/#summary-agenda-ag1");
    const topics = [topic("ag1", 1), topic("ag2", 2)];
    const { rerender } = render(<TopicIndex noteId="note" topics={topics} />);
    act(() => vi.runAllTimers());
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /안건 1/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const reading = screen.getByRole("button", { name: /안건 2/ });
    reading.focus();

    rerender(
      <TopicIndex noteId="note" topics={topics.map((row) => ({ ...row }))} />
    );
    act(() => vi.runAllTimers());
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(reading);

    window.history.replaceState(null, "", "/#summary-agenda-ag2");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      vi.runAllTimers();
    });
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: /안건 2/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("처음에는 안건이 없으면 데이터가 도착한 뒤 주소를 한 번 따라간다", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/#summary-agenda-ag1");
    const { rerender } = render(<TopicIndex noteId="note" topics={[]} />);
    act(() => vi.runAllTimers());
    expect(scroll).not.toHaveBeenCalled();
    rerender(<TopicIndex noteId="note" topics={[topic("ag1", 1)]} />);
    act(() => vi.runAllTimers());
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("도착한 주제 제목에 근거 형광펜을 긋고, 획이 지워지면 거둔다 (APP-1290)", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/#summary-agenda-ag2");
    render(
      <TopicIndex noteId="note" topics={[topic("ag1", 1), topic("ag2", 2)]} />
    );
    act(() => vi.advanceTimersByTime(0));
    // 펼침이 끝나기 전에는 긋지 않는다
    expect(document.querySelector(".evidence-mark")).toBeNull();
    act(() => vi.advanceTimersByTime(240));
    expect(document.querySelector(".evidence-mark")).toHaveTextContent(
      "안건 2"
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(document.querySelector(".evidence-mark")).toBeNull();
  });

  it("「타임라인에서 보기」는 그 안건을 짚어 넘긴다 (APP-1290)", () => {
    const onOpenTimeline = vi.fn();
    render(
      <TopicIndex
        noteId="note"
        topics={[topic("ag1", 1)]}
        onOpenTimeline={onOpenTimeline}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /안건 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /타임라인에서 보기/ }));
    expect(onOpenTimeline).toHaveBeenCalledWith("ag1");
  });
});
