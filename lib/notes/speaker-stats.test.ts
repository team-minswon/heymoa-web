import { describe, expect, it } from "vitest";

import {
  TIMELINE_BINS,
  TIMELINE_MIN_VISIBLE,
  summarizeSpeakers,
} from "@/lib/notes/speaker-stats";
import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

const names = {
  unnamedParticipant: "이름 없는 참여자",
  speaker: (label: string) => `화자 ${label}`,
};

const segment = (
  sequence: number,
  speakerLabel: string | null,
  ms: number,
  assignedParticipantId: string | null = null
): TranscriptPresentationSegment => ({
  segmentId: `s${sequence}`,
  sequence,
  text: `발화 ${sequence}`,
  startedAtMs: sequence * 100_000,
  endedAtMs: sequence * 100_000 + ms,
  speakerLabel,
  assignedParticipantId,
});

const speaker = (
  label: string,
  participantId: string | null,
  name: string | null
) => ({
  label,
  assignedParticipantId: participantId,
  assignedName: name,
  confirmed: participantId !== null,
});

describe("summarizeSpeakers", () => {
  it("등장한 화자만 낸다 — 지정만 있고 발화가 없으면 빼놓는다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000)],
      speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
      participants: [],
    });

    expect(rows.map((row) => row.key)).toEqual(["p1"]);
  });

  it("한 사람이 라벨 둘을 가지면 합쳐서 한 줄이다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [
        segment(1, "D", 3000),
        segment(2, "E", 1000),
        segment(3, "A", 1000),
      ],
      speakers: [
        speaker("D", "mentor", "이동준 멘토님"),
        speaker("E", "mentor", "이동준 멘토님"),
        speaker("A", "p1", "한지원"),
      ],
      participants: [
        { participantId: "mentor", name: "이동준 멘토님" },
        { participantId: "p1", name: "한지원" },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: "mentor",
      name: "이동준 멘토님",
      speakingMs: 4000,
      labels: ["D", "E"],
    });
  });

  it("말한 시간이 많은 순으로 세운다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000), segment(2, "B", 5000)],
      speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
      participants: [
        { participantId: "p1", name: "한지원" },
        { participantId: "p2", name: "상어" },
      ],
    });

    expect(rows.map((row) => row.name)).toEqual(["상어", "한지원"]);
  });

  it("비중은 라벨 있는 발화만으로 계산한다 — 라벨 없는 발화는 분모에서 뺀다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [
        segment(1, "A", 3000),
        segment(2, "B", 1000),
        segment(3, null, 9999),
      ],
      speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
    });

    expect(rows[0].share).toBeCloseTo(0.75);
    expect(rows[1].share).toBeCloseTo(0.25);
  });

  it("지정 안 된 화자는 라벨 이름으로 남는다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "C", 1000)],
      speakers: [speaker("C", null, null)],
    });

    expect(rows[0]).toMatchObject({
      key: "label:C",
      name: "화자 C",
      unassigned: true,
    });
  });

  it("발화 단위 지정이 그 줄의 라벨보다 앞선다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000), segment(2, "A", 3000, "p2")],
      speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
    });

    expect(rows.find((row) => row.key === "p2")?.speakingMs).toBe(3000);
    expect(rows.find((row) => row.key === "p1")?.speakingMs).toBe(1000);
  });

  it("발화 하나만 돌린 사람은 그 라벨을 가진 것이 아니다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000), segment(2, "A", 3000, "p2")],
      speakers: [speaker("A", "p1", "한지원")],
    });

    expect(rows.find((row) => row.key === "p1")?.ownedLabels).toEqual(["A"]);
    expect(rows.find((row) => row.key === "p2")?.ownedLabels).toEqual([]);
    expect(rows.find((row) => row.key === "p2")?.labels).toEqual(["A"]);
  });

  it("소유는 발화가 아니라 화자 지정이 정한다 — 그 라벨 발화를 다 넘겨도 소유는 남는다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000, "p2"), segment(2, "B", 1000)],
      speakers: [
        speaker("A", "mentor", "이동준"),
        speaker("B", "mentor", "이동준"),
      ],
    });

    expect(rows.find((row) => row.key === "mentor")?.ownedLabels).toEqual([
      "A",
      "B",
    ]);
  });

  it("라벨은 순번 순으로 선다 — 글자 순이 아니다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "AA", 1000), segment(2, "B", 1000)],
      speakers: [
        speaker("AA", "mentor", "이동준"),
        speaker("B", "mentor", "이동준"),
      ],
    });

    expect(rows[0].ownedLabels).toEqual(["B", "AA"]);
  });

  it("다음 발화로 도는 목록은 시간순이고 짧은 맞장구는 건너뛴다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [
        segment(5, "A", 4000),
        segment(1, "A", 400),
        segment(3, "A", 3000),
      ],
      speakers: [speaker("A", null, null)],
    });

    const ids = (list: { segmentId: string }[]) =>
      list.map((item) => item.segmentId);
    expect(ids(rows[0].stepTargets)).toEqual(["s3", "s5"]);
    expect(ids(rows[0].utterances)).toEqual(["s1", "s3", "s5"]);
    expect(rows[0].firstSegmentId).toBe("s1");
  });

  it("맞장구뿐인 사람은 짧은 발화도 전부 대상이다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(2, "A", 500), segment(1, "A", 700)],
      speakers: [speaker("A", null, null)],
    });

    expect(rows[0].stepTargets.map((item) => item.segmentId)).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("첫 발화를 들고 있다 — 거기로 스크롤해 붙이러 간다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(4, "A", 1000), segment(2, "A", 1000)],
      speakers: [speaker("A", null, null)],
    });

    expect(rows[0].firstSegmentId).toBe("s2");
    expect(rows[0].firstStartedAtMs).toBe(200_000);
  });

  it("발화가 하나도 없으면 빈 배열이다", () => {
    expect(summarizeSpeakers({ names, segments: [], speakers: [] })).toEqual(
      []
    );
  });

  it("참여자인데 한 마디도 안 했으면 0으로 맨 뒤에 선다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000)],
      speakers: [speaker("A", "p1", "한지원")],
      participants: [
        { participantId: "p1", name: "한지원" },
        { participantId: "p2", name: "상어" },
      ],
    });

    expect(rows.map((row) => row.key)).toEqual(["p1", "p2"]);
    expect(rows[1]).toMatchObject({
      name: "상어",
      speakingMs: 0,
      segmentCount: 0,
      share: 0,
      labels: [],
      unassigned: false,
      firstSegmentId: null,
      utterances: [],
      stepTargets: [],
    });
  });

  it("말 안 한 사람이 여럿이면 이름 순으로 선다 — 열 때마다 순서가 흔들리면 안 된다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [],
      speakers: [],
      participants: [
        { participantId: "p2", name: "한지원" },
        { participantId: "p1", name: "김민수" },
      ],
    });

    expect(rows.map((row) => row.name)).toEqual(["김민수", "한지원"]);
  });

  describe("타임라인", () => {
    const at = (
      sequence: number,
      speakerLabel: string,
      startedAtMs: number,
      endedAtMs: number
    ): TranscriptPresentationSegment => ({
      segmentId: `s${sequence}`,
      sequence,
      text: "발화",
      startedAtMs,
      endedAtMs,
      speakerLabel,
    });

    it("회의 전체를 칸으로 나누고 말한 칸만 채운다", () => {
      const rows = summarizeSpeakers({
        names,
        segments: [at(1, "A", 0, 1000), at(2, "B", 47_000, 48_000)],
        speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
      });

      const early = rows.find((row) => row.key === "p1")!.timeline;
      expect(early).toHaveLength(TIMELINE_BINS);
      expect(early[0]).toBe(1);
      expect(early.slice(1).every((value) => value === 0)).toBe(true);
      expect(rows.find((row) => row.key === "p2")!.timeline.at(-1)).toBe(1);
    });

    it("1시간 회의 끝부분의 1초 발화도 띠에 보인다 — 말 없는 칸과 구분된다", () => {
      const rows = summarizeSpeakers({
        names,
        segments: [at(1, "A", 0, 600_000), at(2, "A", 3_516_000, 3_517_200)],
        speakers: [speaker("A", "p1", "김민수")],
        durationMs: 3_600_000,
      });

      const timeline = rows[0].timeline;
      const bin = Math.floor(3_516_000 / (3_600_000 / TIMELINE_BINS));
      expect(timeline[bin]).toBeGreaterThanOrEqual(TIMELINE_MIN_VISIBLE);
      expect(timeline[bin - 1]).toBe(0);
      expect(rows[0].utterances.at(-1)).toEqual({
        segmentId: "s2",
        startedAtMs: 3_516_000,
        endedAtMs: 3_517_200,
      });
      expect(rows[0].stepTargets.map((item) => item.segmentId)).toEqual(["s1"]);
    });

    it("길이 0인 발화도 시작 칸에 선다", () => {
      const rows = summarizeSpeakers({
        names,
        segments: [at(1, "A", 0, 5000), at(2, "A", 47_000, 47_000)],
        speakers: [speaker("A", "p1", "한지원")],
        durationMs: 48_000,
      });

      expect(rows[0].timeline.at(-1)).toBe(TIMELINE_MIN_VISIBLE);
    });

    it("칸을 넘는 발화는 걸친 칸에 나눠 담는다", () => {
      const rows = summarizeSpeakers({
        names,
        segments: [at(1, "A", 0, 48_000)],
        speakers: [speaker("A", "p1", "한지원")],
      });

      expect(rows[0].timeline.every((value) => value === 1)).toBe(true);
    });

    it("축은 녹음 길이다 — 마지막 발화 뒤의 침묵도 회의다", () => {
      const rows = summarizeSpeakers({
        names,
        segments: [at(1, "A", 0, 1000)],
        speakers: [speaker("A", "p1", "한지원")],
        durationMs: 48_000,
      });

      expect(rows[0].timeline[0]).toBe(1);
      expect(rows[0].timeline.slice(1).every((value) => value === 0)).toBe(
        true
      );
    });

    it("말 안 한 참여자의 칸은 전부 비어 있다", () => {
      const rows = summarizeSpeakers({
        names,
        segments: [at(1, "A", 0, 1000)],
        speakers: [speaker("A", "p1", "한지원")],
        participants: [
          { participantId: "p1", name: "한지원" },
          { participantId: "p2", name: "상어" },
        ],
      });

      expect(rows[1].timeline).toEqual(Array(TIMELINE_BINS).fill(0));
    });
  });

  it("이름은 참여자 목록을 따른다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000)],
      speakers: [speaker("A", "p1", "옛 이름")],
      participants: [{ participantId: "p1", name: "한지원", image: "u.png" }],
    });

    expect(rows[0]).toMatchObject({ name: "한지원", image: "u.png" });
  });

  it("참여자 목록이 없으면 화자에 저장된 옛 이름을 대신 쓰지 않는다", () => {
    const rows = summarizeSpeakers({
      names,
      segments: [segment(1, "A", 1000)],
      speakers: [speaker("A", "p1", "옛 이름")],
    });
    expect(rows[0].name).toBe("이름 없는 참여자");
  });
});
