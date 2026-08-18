import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TranscriptGapRow } from "@/components/notes/transcript-gap-row";
import { toGapRows, type TranscriptGap } from "@/lib/transcription/gaps";

function pause(partial: Partial<TranscriptGap> = {}) {
  const [row] = toGapRows([
    {
      gapId: "p1",
      kind: "PAUSE",
      // 중지는 회의 축에서 점이다 — 두 좌표가 같다.
      startedAtMs: 612_000,
      endedAtMs: 612_000,
      startedAt: "2026-08-18T01:00:00Z",
      endedAt: "2026-08-18T05:30:00Z",
      reason: null,
      ...partial,
    },
  ]);
  return row;
}

describe("TranscriptGapRow", () => {
  afterEach(cleanup);

  it("대충 말한다 — 270분도 4시간 30분도 아니고 약 5시간이다", () => {
    render(<TranscriptGapRow row={pause()} />);

    expect(screen.getByText(/약 5시간 중지했습니다/)).toBeTruthy();
  });

  it("같은 날이면 시:분만 쓴다", () => {
    render(<TranscriptGapRow row={pause()} />);

    expect(
      screen.getByText(/^\d{2}:\d{2}에 멈추고 \d{2}:\d{2}에 재개했습니다$/)
    ).toBeTruthy();
  });

  it("날을 넘기면 날짜를 붙인다 — 안 그러면 시간을 거슬러 간 것처럼 읽힌다", () => {
    render(
      <TranscriptGapRow row={pause({ endedAt: "2026-08-20T13:30:00Z" })} />
    );

    expect(screen.getByText(/약 3일 중지했습니다/)).toBeTruthy();
    expect(
      screen.getByText(
        /^\d{1,2}\/\d{1,2} \d{2}:\d{2}에 멈추고 \d{1,2}\/\d{1,2} \d{2}:\d{2}에 재개했습니다$/
      )
    ).toBeTruthy();
  });
});
