import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordingConnectionNotice } from "@/components/transcription/recording-connection-notice";
import type { BufferState } from "@/lib/transcription/realtime-session";

const HOUR = 3_600_000;

function buffer(state: Partial<BufferState> = {}): BufferState {
  return {
    pendingMs: 0,
    limitMs: HOUR,
    persistent: true,
    paused: false,
    upload: null,
    ...state,
  };
}

function notice(
  props: Partial<Parameters<typeof RecordingConnectionNotice>[0]>
) {
  return (
    <RecordingConnectionNotice
      reconnecting={null}
      buffer={buffer()}
      microphone="live"
      finishing={false}
      {...props}
    />
  );
}

describe("RecordingConnectionNotice", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // 흔한 흔들림마다 띄우면 소음이다. 5초가 넘으면 녹음은 계속되고 소리는 이 기기에 있다고 말한다.
  it("끊긴 지 5초까지는 말하지 않고, 넘으면 이 기기에 저장 중인 양을 말한다", () => {
    vi.useFakeTimers();
    const since = Date.now();
    const { rerender } = render(
      notice({
        reconnecting: { sinceMs: since, pendingMs: 1_000 },
        buffer: buffer({ pendingMs: 4_000 }),
      })
    );
    expect(screen.queryByRole("status")).toBeNull();

    act(() => vi.advanceTimersByTime(6_000));
    rerender(
      notice({
        reconnecting: { sinceMs: since, pendingMs: 1_000 },
        buffer: buffer({ pendingMs: 134_000 }),
      })
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "연결이 불안정해요 · 소리는 이 기기에 저장 중 (2:14)"
    );
  });

  it("디스크를 못 쓰면 버틸 수 있는 시간이 짧다고 함께 말한다", () => {
    render(
      notice({
        reconnecting: { sinceMs: Date.now() - 10_000, pendingMs: 0 },
        buffer: buffer({
          pendingMs: 10_000,
          persistent: false,
          limitMs: 300_000,
        }),
      })
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "이 브라우저에서는 5분까지만 저장돼요"
    );
  });

  it("한도의 80% 를 넘으면 몇 분 뒤 멈추는지 말한다", () => {
    render(notice({ buffer: buffer({ pendingMs: 2_900_000 }) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "약 12분 뒤 녹음이 멈춰요 · 네트워크를 확인해 주세요"
    );
  });

  it("한도에 닿아 멈췄으면 빨간 알림으로 말한다", () => {
    render(notice({ buffer: buffer({ pendingMs: HOUR, paused: true }) }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "기기에 저장할 수 있는 60분이 차서 녹음을 멈췄어요"
    );
  });

  it("다시 붙은 뒤 밀린 소리를 올리는 진행률을 말한다", () => {
    render(
      notice({
        buffer: buffer({ upload: { percent: 63, remainingMs: 40_000 } }),
      })
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "밀린 소리 올리는 중 63%"
    );
  });

  it("멈춘 뒤 밀린 것을 올리는 동안은 저장 마무리 중이라고 말한다", () => {
    render(
      notice({
        finishing: true,
        buffer: buffer({ upload: { percent: 40, remainingMs: 40_000 } }),
      })
    );

    expect(screen.getByRole("status")).toHaveTextContent("저장 마무리 중… 40%");
  });

  it("마이크가 끊기면 그렇다고 말한다", () => {
    render(notice({ microphone: "ended" }));

    expect(screen.getByRole("status")).toHaveTextContent("마이크가 끊겼습니다");
  });

  it("아무 일도 없으면 그리지 않는다", () => {
    const { container } = render(notice({ buffer: null }));

    expect(container).toBeEmptyDOMElement();
  });
});
