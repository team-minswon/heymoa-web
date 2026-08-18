import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/lib/mocks/db";

const NOTE_ID = "01K0000000020";

function labels() {
  return mockDb
    .getTranscript(NOTE_ID)
    .diarization.speakers.map((speaker) => ({
      label: speaker.label,
      name: speaker.assignedName,
      confirmed: speaker.confirmed,
    }));
}

describe("mockDb.assignSpeaker", () => {
  beforeEach(() => mockDb.reset());

  it("시드가 연결된 화자와 안 된 화자를 둘 다 준다", () => {
    // 한쪽만 있으면 `화자 A` 분기가 목에서 한 번도 안 그려진다
    const [first] = mockDb.getNote(NOTE_ID).participants;
    expect(labels()).toEqual([
      { label: "A", name: first.name, confirmed: true },
      { label: "B", name: null, confirmed: false },
    ]);
  });

  it("연결하면 그 화자에 이름이 붙는다", () => {
    const participant = mockDb.getNote(NOTE_ID).participants.at(-1)!;

    mockDb.assignSpeaker(NOTE_ID, "B", participant.userId);

    expect(labels().find((row) => row.label === "B")).toEqual({
      label: "B",
      name: participant.name,
      confirmed: true,
    });
  });

  it("한 사람은 한 화자에만 붙는다 — 앞 화자에서 떨어진다", () => {
    // A 에 이미 붙어 있는 사람을 B 로 옮긴다
    const [onA] = mockDb.getNote(NOTE_ID).participants;

    mockDb.assignSpeaker(NOTE_ID, "B", onA.userId);

    expect(labels()).toEqual([
      { label: "A", name: null, confirmed: false },
      { label: "B", name: onA.name, confirmed: true },
    ]);
  });

  it("null 은 「참석자 중에 없다」로 확정한다 — 미결정과 다르다", () => {
    mockDb.assignSpeaker(NOTE_ID, "B", null);

    expect(labels().find((row) => row.label === "B")).toEqual({
      label: "B",
      name: null,
      // 이름은 없지만 사람이 봤다. 「아직 안 봤다」와 갈린다
      confirmed: true,
    });
  });

  it("이 노트의 참여자가 아니면 422 코드로 거절한다", () => {
    expect(() =>
      mockDb.assignSpeaker(NOTE_ID, "B", "01K9999999999")
    ).toThrow("PARTICIPANT_NOT_IN_NOTE");
  });

  it("없는 라벨을 거절한다", () => {
    expect(() => mockDb.assignSpeaker(NOTE_ID, "Z", null)).toThrow(
      "SPEAKER_LABEL_NOT_FOUND"
    );
  });

  it("화자 분리가 안 끝난 노트를 거절한다", () => {
    expect(() => mockDb.assignSpeaker("01K0000000002", "A", null)).toThrow(
      "DIARIZATION_NOT_MAPPED"
    );
  });
});
