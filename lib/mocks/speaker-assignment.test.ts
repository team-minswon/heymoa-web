import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/lib/mocks/db";

const NOTE_ID = "01K0000000020";
const WORKSPACE_ID = "01K0000000000";

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
    const [first] = mockDb.getNote(NOTE_ID).participants;
    expect(labels()).toEqual([
      { label: "A", name: first.name, confirmed: true },
      { label: "B", name: null, confirmed: false },
    ]);
  });

  it("연결하면 그 화자에 이름이 붙는다", () => {
    const participant = mockDb.getNote(NOTE_ID).participants.at(-1)!;

    mockDb.assignSpeaker(NOTE_ID, "B", {
      participantId: participant.participantId,
    });

    expect(labels().find((row) => row.label === "B")).toEqual({
      label: "B",
      name: participant.name,
      confirmed: true,
    });
  });

  it("한 사람이 여러 화자를 맡을 수 있다", () => {
    const [onA] = mockDb.getNote(NOTE_ID).participants;

    mockDb.assignSpeaker(NOTE_ID, "B", {
      participantId: onA.participantId,
    });

    expect(labels()).toEqual([
      { label: "A", name: onA.name, confirmed: true },
      { label: "B", name: onA.name, confirmed: true },
    ]);
  });

  it("null 은 「참석자 중에 없다」로 확정한다 — 미결정과 다르다", () => {
    mockDb.assignSpeaker(NOTE_ID, "B", {});

    expect(labels().find((row) => row.label === "B")).toEqual({
      label: "B",
      name: null,
      confirmed: true,
    });
  });

  it("이 노트의 참여자가 아니면 422 코드로 거절한다", () => {
    expect(() =>
      mockDb.assignSpeaker(NOTE_ID, "B", { participantId: "01K9999999999" })
    ).toThrow("PARTICIPANT_NOT_IN_NOTE");
  });

  it("없는 라벨을 거절한다", () => {
    expect(() => mockDb.assignSpeaker(NOTE_ID, "Z", {})).toThrow(
      "SPEAKER_LABEL_NOT_FOUND"
    );
  });

  it("화자 분리가 안 끝난 노트를 거절한다", () => {
    expect(() => mockDb.assignSpeaker("01K0000000002", "A", {})).toThrow(
      "DIARIZATION_NOT_MAPPED"
    );
  });

  it("그 자리에서 만든 임시 참여자를 화자에 붙인다", () => {
    const { participants } = mockDb.createNoteGuestParticipant(
      NOTE_ID,
      "이도현"
    );
    const guest = participants.find((row) => row.guestId !== null)!;

    mockDb.assignSpeaker(NOTE_ID, "B", { participantId: guest.participantId });

    const speaker = mockDb
      .getTranscript(NOTE_ID)
      .diarization.speakers.find((row) => row.label === "B")!;
    expect(speaker.assignedParticipantId).toBe(guest.participantId);
    expect(speaker.assignedName).toBe(guest.name);
    expect(speaker.confirmed).toBe(true);
  });

  it("계정으로 보내도 참여 기록으로 붙는다", () => {
    const member = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.userId !== null)!;

    mockDb.assignSpeaker(NOTE_ID, "B", { userId: member.userId });

    const speaker = mockDb
      .getTranscript(NOTE_ID)
      .diarization.speakers.find((row) => row.label === "B")!;
    expect(speaker.assignedParticipantId).toBe(member.participantId);
  });

  it("참여 기록과 계정을 함께 보내면 거절한다", () => {
    const member = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.userId !== null)!;

    expect(() =>
      mockDb.assignSpeaker(NOTE_ID, "B", {
        participantId: member.participantId,
        userId: member.userId,
      })
    ).toThrow("BAD_REQUEST");
  });
});

function overrideOf(segmentId: string) {
  return (
    mockDb
      .getTranscript(NOTE_ID)
      .segments.find((segment) => segment.segmentId === segmentId)
      ?.assignedParticipantId ?? null
  );
}

const A_PLAIN = "01K0000000061";
const A_OVERRIDDEN = "01K0000000063";

describe("mockDb.assignSegmentSpeaker", () => {
  beforeEach(() => mockDb.reset());

  it("시드가 개별 지정된 발화를 하나 준다", () => {
    const other = mockDb.getNote(NOTE_ID).participants[1];

    expect(overrideOf(A_OVERRIDDEN)).toBe(other.participantId);
    expect(overrideOf(A_PLAIN)).toBeNull();
  });

  it("한 발화에만 붙이면 같은 라벨의 다른 발화는 그대로다", () => {
    const [target] = mockDb.getNote(NOTE_ID).participants;
    const untouched = overrideOf(A_OVERRIDDEN);

    mockDb.assignSegmentSpeaker(NOTE_ID, A_PLAIN, { participantId: target.participantId });

    expect(overrideOf(A_PLAIN)).toBe(target.participantId);
    expect(overrideOf(A_OVERRIDDEN)).toBe(untouched);
  });

  it("null 을 보내면 개별 지정이 사라지고 다시 라벨을 따른다", () => {
    mockDb.assignSegmentSpeaker(NOTE_ID, A_OVERRIDDEN, {});

    expect(overrideOf(A_OVERRIDDEN)).toBeNull();
  });

  it("참여자가 아닌 멤버를 계정으로 가리키면 참여자로도 등록된다", () => {
    const [keep, dropped] = mockDb.getNote(NOTE_ID).participants;
    mockDb.replaceNoteParticipants(NOTE_ID, [keep.userId!]);
    expect(
      mockDb.getNote(NOTE_ID).participants.some((row) => row.userId === dropped.userId)
    ).toBe(false);

    mockDb.assignSpeaker(NOTE_ID, "A", { userId: dropped.userId });

    const joined = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.userId === dropped.userId);
    expect(joined).toBeDefined();
    expect(
      mockDb.getTranscript(NOTE_ID).diarization.speakers.find((s) => s.label === "A")
        ?.assignedParticipantId
    ).toBe(joined!.participantId);
  });

  it("워크스페이스 멤버가 아닌 계정은 화자로 못 붙인다", () => {
    expect(() =>
      mockDb.assignSpeaker(NOTE_ID, "A", { userId: "01K9999999999" })
    ).toThrow();
  });

  it("이 회의에 없는 임시 참여자를 계정 없이 가리켜도 참여자로 등록된다", () => {
    const guest = mockDb.listWorkspaceGuests(WORKSPACE_ID).guests[0];
    expect(
      mockDb.getNote(NOTE_ID).participants.some((row) => row.guestId === guest.guestId)
    ).toBe(false);

    mockDb.assignSpeaker(NOTE_ID, "A", { guestId: guest.guestId });

    const joined = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.guestId === guest.guestId);
    expect(joined).toBeDefined();
    expect(joined!.name).toBe(guest.displayName);
  });

  it("화자 지정이 넣은 참여자도 이름순 자리에 들어간다", () => {
    const guest = mockDb.listWorkspaceGuests(WORKSPACE_ID).guests[0];

    mockDb.assignSpeaker(NOTE_ID, "A", { guestId: guest.guestId });

    const names = mockDb.getNote(NOTE_ID).participants.map((row) => row.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "ko")));
  });

  it("다른 워크스페이스의 임시 참여자는 화자로 못 붙인다", () => {
    expect(() =>
      mockDb.assignSpeaker(NOTE_ID, "A", { guestId: "01K9999999999" })
    ).toThrow();
  });

  it("그 화자에 전체 지정을 하면 개별 지정이 지워진다", () => {
    const [onA] = mockDb.getNote(NOTE_ID).participants;

    mockDb.assignSpeaker(NOTE_ID, "A", { participantId: onA.participantId });

    expect(overrideOf(A_OVERRIDDEN)).toBeNull();
  });

  it("전체 지정은 다른 화자의 개별 지정을 안 건드린다", () => {
    const target = mockDb.getNote(NOTE_ID).participants.at(-1)!;
    mockDb.assignSegmentSpeaker(NOTE_ID, "01K0000000062", { participantId: target.participantId });

    mockDb.assignSpeaker(NOTE_ID, "A", { participantId: target.participantId });

    expect(overrideOf("01K0000000062")).toBe(target.participantId);
  });

  it("이 회의의 발화가 아니면 거절한다", () => {
    expect(() =>
      mockDb.assignSegmentSpeaker(NOTE_ID, "01K9999999999", {})
    ).toThrow("TRANSCRIPT_SEGMENT_NOT_FOUND");
  });

  it("화자가 나뉘지 않은 발화는 거절한다", () => {
    const target = mockDb.getNote(NOTE_ID).participants[0];

    expect(() =>
      mockDb.assignSegmentSpeaker(NOTE_ID, "01K0000000064", { participantId: target.participantId })
    ).toThrow("SEGMENT_NOT_DIARIZED");
  });

  it("이 회의의 참여 기록이 아니면 거절한다", () => {
    expect(() =>
      mockDb.assignSegmentSpeaker(NOTE_ID, A_PLAIN, { participantId: "01K9999999999" })
    ).toThrow("PARTICIPANT_NOT_IN_NOTE");
  });
});
