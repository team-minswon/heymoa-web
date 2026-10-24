import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TranscriptGapRow } from "@/components/notes/transcript-gap-row";
import { toGapRows, type TranscriptGap } from "@/lib/transcription/gaps";

function pause(partial: Partial<TranscriptGap> = {}) {
  const [row] = toGapRows([
    {
      gapId: "p1",
      kind: "PAUSE",
      // 일시정지는 회의 축에서 점이다 — 두 좌표가 같다.
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

    expect(screen.getByText(/약 5시간 일시정지했습니다/)).toBeTruthy();
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

    expect(screen.getByText(/약 3일 일시정지했습니다/)).toBeTruthy();
    expect(
      screen.getByText(
        /^\d{1,2}\/\d{1,2} \d{2}:\d{2}에 멈추고 \d{1,2}\/\d{1,2} \d{2}:\d{2}에 재개했습니다$/
      )
    ).toBeTruthy();
  });

  it("기기 시간대가 달라도 머리글 · 회의록과 같은 앱 시간대(서울)로 적는다", () => {
    const deviceZone = process.env.TZ;
    // 해외 기기. 기기 시간대로 적으면 「18:00에 멈추고 22:30에 재개」가 된다.
    process.env.TZ = "America/Los_Angeles";
    try {
      render(<TranscriptGapRow row={pause()} />);
      expect(
        screen.getByText("10:00에 멈추고 14:30에 재개했습니다")
      ).toBeTruthy();
    } finally {
      process.env.TZ = deviceZone;
    }
  });

  it("날짜가 갈리는지도 서울 달력으로 본다 — 서울에서 같은 날이면 날짜를 붙이지 않는다", () => {
    const deviceZone = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      // UTC 로는 17일 23:30 · 18일 00:30 이지만 서울로는 18일 08:30 · 09:30 이다
      render(
        <TranscriptGapRow
          row={pause({
            startedAt: "2026-08-17T23:30:00Z",
            endedAt: "2026-08-18T00:30:00Z",
          })}
        />
      );
      expect(
        screen.getByText("08:30에 멈추고 09:30에 재개했습니다")
      ).toBeTruthy();
    } finally {
      process.env.TZ = deviceZone;
    }
  });
});

describe("TranscriptGapRow — 전사 공백 (APP-706)", () => {
  afterEach(cleanup);

  it("회의 축 두 끝과 문구를 그리고, 진행 중으로 읽지 않는다", () => {
    const [row] = toGapRows(
      [],
      [
        {
          gapId: "t1",
          kind: "UNANSWERED",
          startedAtMs: 640_000,
          endedAtMs: 652_000,
        },
      ]
    );
    render(<TranscriptGapRow row={row} />);

    expect(screen.getByText("10:40 – 10:52")).toBeTruthy();
    expect(
      screen.getByText("잠깐 받아쓰지 못했어요 · 소리는 저장됨")
    ).toBeTruthy();
    expect(screen.getByTestId("transcript-gap").dataset.gapKind).toBe(
      "UNTRANSCRIBED"
    );
  });
});
