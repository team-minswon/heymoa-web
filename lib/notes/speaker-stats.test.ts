import { describe, expect, it } from "vitest";

import { TIMELINE_BINS, summarizeSpeakers } from "@/lib/notes/speaker-stats";
import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

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

const speaker = (label: string, participantId: string | null, name: string | null) => ({
  label,
  assignedParticipantId: participantId,
  assignedName: name,
  confirmed: participantId !== null,
});

describe("summarizeSpeakers", () => {
  it("등장한 화자만 낸다 — 지정만 있고 발화가 없으면 빼놓는다", () => {
    const rows = summarizeSpeakers({
      segments: [segment(1, "A", 1000)],
      speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
    });

    expect(rows.map((row) => row.key)).toEqual(["p1"]);
  });

  // 한 사람이 라벨 둘을 갖는 일이 실제로 있다(목소리가 갈렸고 사람은 하나다).
  // 사람 기준으로 묶지 않으면 같은 이름이 두 줄로 나와 합이 안 맞는다.
  it("한 사람이 라벨 둘을 가지면 합쳐서 한 줄이다", () => {
    const rows = summarizeSpeakers({
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
      segments: [segment(1, "A", 1000), segment(2, "B", 5000)],
      speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
    });

    expect(rows.map((row) => row.name)).toEqual(["상어", "한지원"]);
  });

  it("비중은 라벨 있는 발화만으로 계산한다 — 라벨 없는 발화는 분모에서 뺀다", () => {
    const rows = summarizeSpeakers({
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

  // 아직 아무도 안 붙인 화자도 줄이 있어야 한다 — 그 줄이 곧 붙이러 가는 자리다.
  it("지정 안 된 화자는 라벨 이름으로 남는다", () => {
    const rows = summarizeSpeakers({
      segments: [segment(1, "C", 1000)],
      speakers: [speaker("C", null, null)],
    });

    expect(rows[0]).toMatchObject({
      key: "label:C",
      name: "화자 C",
      unassigned: true,
    });
  });

  // 발화 단위 지정은 더 좁은 범위를 사람이 나중에 고른 것이라 라벨의 지정을 이긴다.
  it("발화 단위 지정이 그 줄의 라벨보다 앞선다", () => {
    const rows = summarizeSpeakers({
      segments: [segment(1, "A", 1000), segment(2, "A", 3000, "p2")],
      speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
    });

    expect(rows.find((row) => row.key === "p2")?.speakingMs).toBe(3000);
    expect(rows.find((row) => row.key === "p1")?.speakingMs).toBe(1000);
  });

  /**
   * **색은 그 사람이 「가진」 라벨이 정한다.** 발화 하나만 그 사람에게 돌린 줄은 그 사람이
   * 라벨을 가진 것이 아니라, 라벨 A 안에 그 사람의 줄이 하나 섞인 것이다 — 그걸 소유로
   * 세면 패널과 전사가 같은 사람에게 다른 색을 준다.
   */
  it("발화 하나만 돌린 사람은 그 라벨을 가진 것이 아니다", () => {
    const rows = summarizeSpeakers({
      segments: [segment(1, "A", 1000), segment(2, "A", 3000, "p2")],
      speakers: [speaker("A", "p1", "한지원")],
    });

    expect(rows.find((row) => row.key === "p1")?.ownedLabels).toEqual(["A"]);
    expect(rows.find((row) => row.key === "p2")?.ownedLabels).toEqual([]);
    // 「어느 라벨 안에 있었나」는 그대로 A 다.
    expect(rows.find((row) => row.key === "p2")?.labels).toEqual(["A"]);
  });

  /**
   * A·B 를 가진 사람의 A 발화를 **전부** 다른 사람에게 개별 지정하면, 발화에서 소유를 세는
   * 한 그 사람의 줄에는 A 가 한 번도 안 들어온다 — 소유가 [B] 로 줄어 색이 튄다.
   * 소유는 발화가 아니라 **화자 지정 목록**이 정한다.
   */
  it("소유는 발화가 아니라 화자 지정이 정한다 — 그 라벨 발화를 다 넘겨도 소유는 남는다", () => {
    const rows = summarizeSpeakers({
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

  // 기본 정렬은 문자열이라 `["AA","B"]` 를 그대로 둔다 — 라벨 순번은 B 가 먼저다.
  // 여기서 어긋나면 26명 넘는 회의에서 패널과 전사의 색이 갈린다.
  it("라벨은 순번 순으로 선다 — 글자 순이 아니다", () => {
    const rows = summarizeSpeakers({
      segments: [segment(1, "AA", 1000), segment(2, "B", 1000)],
      speakers: [
        speaker("AA", "mentor", "이동준"),
        speaker("B", "mentor", "이동준"),
      ],
    });

    expect(rows[0].ownedLabels).toEqual(["B", "AA"]);
  });

  it("첫 발화를 들고 있다 — 거기로 스크롤해 붙이러 간다", () => {
    const rows = summarizeSpeakers({
      segments: [segment(4, "A", 1000), segment(2, "A", 1000)],
      speakers: [speaker("A", null, null)],
    });

    expect(rows[0].firstSegmentId).toBe("s2");
    // 시각은 그 발화의 것이다 — 타임라인 칸에서 되짚으면 칸 하나만큼(회의 63분이면 79초)
    // 틀린 시각을 읽어 준다.
    expect(rows[0].firstStartedAtMs).toBe(200_000);
  });

  it("발화가 하나도 없으면 빈 배열이다", () => {
    expect(summarizeSpeakers({ segments: [], speakers: [] })).toEqual([]);
  });

  // 회의에 앉아 있었지만 한 마디도 안 한 사람이 있다. 말한 사람만 세면 그 사람은
  // 목록에서 사라지고, 「내가 왜 없지」가 아니라 「이 회의에 없던 사람」으로 읽힌다.
  it("참여자인데 한 마디도 안 했으면 0으로 맨 뒤에 선다", () => {
    const rows = summarizeSpeakers({
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
    });
  });

  it("말 안 한 사람이 여럿이면 이름 순으로 선다 — 열 때마다 순서가 흔들리면 안 된다", () => {
    const rows = summarizeSpeakers({
      segments: [],
      speakers: [],
      participants: [
        { participantId: "p2", name: "한지원" },
        { participantId: "p1", name: "김민수" },
      ],
    });

    expect(rows.map((row) => row.name)).toEqual(["김민수", "한지원"]);
  });

  // 「누가 얼마나」만으로는 붙일 사람을 못 고른다. 앞 15분만 말하고 사라진 사람과 내내
  // 고르게 말한 사람은 비중이 같아도 다른 사람이고, 그 차이가 곧 알아보는 단서다.
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

    // 칸은 회의 전체를 나눈 것이다 — 자기 발화 구간만 나누면 모든 사람이 꽉 찬 띠가 된다.
    it("회의 전체를 칸으로 나누고 말한 칸만 채운다", () => {
      const rows = summarizeSpeakers({
        segments: [at(1, "A", 0, 1000), at(2, "B", 47_000, 48_000)],
        speakers: [speaker("A", "p1", "한지원"), speaker("B", "p2", "상어")],
      });

      const early = rows.find((row) => row.key === "p1")!.timeline;
      expect(early).toHaveLength(TIMELINE_BINS);
      expect(early[0]).toBe(1);
      expect(early.slice(1).every((value) => value === 0)).toBe(true);
      expect(rows.find((row) => row.key === "p2")!.timeline.at(-1)).toBe(1);
    });

    // 칸보다 긴 발화를 한 칸에 몰면 그 사람만 봉우리 하나로 보인다.
    it("칸을 넘는 발화는 걸친 칸에 나눠 담는다", () => {
      const rows = summarizeSpeakers({
        segments: [at(1, "A", 0, 48_000)],
        speakers: [speaker("A", "p1", "한지원")],
      });

      expect(rows[0].timeline.every((value) => value === 1)).toBe(true);
    });

    // 마지막 발화 뒤에 침묵이 길면 축이 통째로 짧아진다 — 10분 녹음에서 앞 1분만 말한
    // 사람의 띠가 48칸을 꽉 채워, 머리글의 「회의 10분」과 다른 회의를 그린다.
    it("축은 녹음 길이다 — 마지막 발화 뒤의 침묵도 회의다", () => {
      const rows = summarizeSpeakers({
        segments: [at(1, "A", 0, 1000)],
        speakers: [speaker("A", "p1", "한지원")],
        durationMs: 48_000,
      });

      expect(rows[0].timeline[0]).toBe(1);
      expect(rows[0].timeline.slice(1).every((value) => value === 0)).toBe(true);
    });

    it("말 안 한 참여자의 칸은 전부 비어 있다", () => {
      const rows = summarizeSpeakers({
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

  // 이름의 원본은 참여자 목록이다 — 화자에 실린 이름은 지정 당시의 사본이라 개명하면 낡는다.
  it("이름은 참여자 목록을 따른다", () => {
    const rows = summarizeSpeakers({
      segments: [segment(1, "A", 1000)],
      speakers: [speaker("A", "p1", "옛 이름")],
      participants: [{ participantId: "p1", name: "한지원", image: "u.png" }],
    });

    expect(rows[0]).toMatchObject({ name: "한지원", image: "u.png" });
  });
});
