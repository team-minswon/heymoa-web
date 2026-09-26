import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecordingConnectionNotice } from "@/components/transcription/recording-connection-notice";
import type { BufferState } from "@/lib/transcription/realtime-session";

function buffer(state: Partial<BufferState> = {}): BufferState {
  return {
    pendingMs: 0,
    limitMs: 300_000,
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
      notice={null}
      buffer={buffer()}
      microphone="live"
      finishing={false}
      {...props}
    />
  );
}

const DISCONNECTED = { cause: "disconnected", sinceMs: 0 } as const;
const WARNING =
  "연결이 끊겼어요 · 받아쓰기·실시간 분석 멈춤 · 녹음은 이 기기에 저장 중";

describe("RecordingConnectionNotice", () => {
  afterEach(() => {
    cleanup();
  });

  it("끊기면 멈춘 것을 먼저 말한다", () => {
    render(notice({ notice: DISCONNECTED }));

    expect(screen.getByRole("status")).toHaveTextContent(WARNING);
  });

  it("붙은 채 영수증이 없을 때도 같은 말을 한다", () => {
    render(notice({ notice: { cause: "no_receipt", sinceMs: 0 } }));

    expect(screen.getByRole("status")).toHaveTextContent(WARNING);
  });

  it("끊긴 채 멈추기를 누르면 올릴 소리가 이 기기에 있다고 말한다", () => {
    render(
      notice({
        notice: DISCONNECTED,
        finishing: true,
        buffer: buffer({ pendingMs: 12_400 }),
      })
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "올릴 소리 12초가 이 기기에 있어요 · 연결될 때까지 이 탭을 열어 두세요"
    );
  });

  // 창이 30초라 4분·5분 경고가 설 자리가 없다(D-02)
  it("버퍼가 많이 차도 몇 분 뒤 멈춘다고 말하지 않는다", () => {
    const { container } = render(
      notice({ buffer: buffer({ pendingMs: 290_000 }) })
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("붙어 있는데 서버 저장이 밀려 한도에 닿았으면 빨간 알림으로 말한다", () => {
    render(notice({ buffer: buffer({ pendingMs: 300_000, paused: true }) }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("저장이 밀려 녹음을 잠시 멈췄어요");
    expect(alert).not.toHaveTextContent("이 기기에");
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
