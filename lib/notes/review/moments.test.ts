import { describe, expect, it } from "vitest";

import type { TranscriptResponseDataSegmentsItem } from "@/lib/api/generated/models";
import {
  citedAtOf,
  lengthLabel,
  meetingLengthOf,
  quotesOf,
  segmentStarts,
  tickLabel,
  ticksOf,
} from "@/lib/notes/review/moments";

const segment = (n: number): TranscriptResponseDataSegmentsItem =>
  ({
    segmentId: `s${n}`,
    sequence: n,
    startedAtMs: n * 10_000,
    endedAtMs: n * 10_000 + 9_000,
    text: `말 ${n}`,
    speakerLabel: "A",
    assignedParticipantId: null,
  }) as TranscriptResponseDataSegmentsItem;

const segments = [0, 1, 2, 3, 4].map(segment);
const cite = (...ids: string[]) => ({
  citations: ids.map((segmentId) => ({ segmentId, role: "SUPPORTS" as const })),
});

describe("citedAtOf", () => {
  it("인용한 구간 중 가장 이른 시작이고, 못 찾으면 null 이다", () => {
    const starts = segmentStarts(segments);
    expect(citedAtOf(cite("s3", "s1"), starts)).toBe(10_000);
    expect(citedAtOf(cite("gone"), starts)).toBeNull();
    expect(citedAtOf(cite(), starts)).toBeNull();
  });
});

describe("quotesOf", () => {
  it("인용한 줄과 그 앞 줄을 차례대로 한 번씩 세운다", () => {
    const quotes = quotesOf(cite("s3", "s2", "s0"), segments);
    expect(quotes.map((row) => [row.segment.segmentId, row.cited])).toEqual([
      ["s0", true],
      ["s1", false],
      ["s2", true],
      ["s3", true],
    ]);
  });
});

describe("meetingLengthOf", () => {
  it("녹음 길이와 마지막 구간 끝 중 큰 값이다", () => {
    expect(meetingLengthOf(10_000, segments)).toBe(49_000);
    expect(meetingLengthOf(90_000, segments)).toBe(90_000);
  });
});

describe("ticksOf", () => {
  it("다섯 칸 안쪽 간격으로 나누고 끝에 길이를 둔다", () => {
    expect(ticksOf(75 * 60_000)).toEqual([0, 15, 30, 45, 60, 75]);
    // 끝(42분)에 붙는 40분은 이름이 겹쳐 뺀다.
    expect(ticksOf(42 * 60_000)).toEqual([0, 10, 20, 30, 42]);
    expect(ticksOf(75 * 60_000).map(tickLabel)).toEqual(["0:00", "15분", "30분", "45분", "1시간", "1:15"]);
  });
});

describe("lengthLabel", () => {
  it("분 · 시간 단위로 읽는다", () => {
    expect([20_000, 42 * 60_000, 60 * 60_000, 75 * 60_000].map(lengthLabel)).toEqual([
      "1분 미만",
      "42분",
      "1시간",
      "1시간 15분",
    ]);
  });
});
