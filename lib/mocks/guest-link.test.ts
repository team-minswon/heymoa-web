import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/lib/mocks/db";

const WORKSPACE_ID = "01K0000000000";
const GUEST_ID = "01K0000000900";
const NOTE_ID = "01K0000000020";

function speakerLabelsOf(participantId: string) {
  return mockDb
    .getTranscript(NOTE_ID)
    .diarization.speakers.filter(
      (speaker) => speaker.assignedParticipantId === participantId
    )
    .map((speaker) => speaker.label)
    .sort();
}

function participantIdsOf() {
  return mockDb.getNote(NOTE_ID).participants.map((row) => row.participantId);
}

describe("mockDb.linkWorkspaceGuest", () => {
  beforeEach(() => mockDb.reset());

  function bothOnSpeakers() {
    mockDb.replaceNoteGuestParticipants(NOTE_ID, [GUEST_ID]);
    const guestRow = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.guestId === GUEST_ID)!;
    const accountRow = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.userId)!;
    mockDb.assignSpeaker(NOTE_ID, "B", {
      participantId: guestRow.participantId,
    });
    mockDb.assignSpeaker(NOTE_ID, "A", {
      participantId: accountRow.participantId,
    });
    return { guestRow, accountRow };
  }

  it("양쪽에 화자가 붙어 있어도 합친다", () => {
    const { accountRow } = bothOnSpeakers();

    const result = mockDb.linkWorkspaceGuest(
      WORKSPACE_ID,
      GUEST_ID,
      accountRow.userId!
    );

    expect(result.changedNoteCount).toBeGreaterThan(0);
  });

  it("사라지는 기록의 화자가 살아남는 기록으로 옮겨진다", () => {
    const { guestRow, accountRow } = bothOnSpeakers();

    mockDb.linkWorkspaceGuest(WORKSPACE_ID, GUEST_ID, accountRow.userId!);

    expect(speakerLabelsOf(guestRow.participantId)).toEqual(["A", "B"]);
    expect(participantIdsOf()).not.toContain(accountRow.participantId);
  });

  it("사라지는 기록의 발화 단위 지정도 옮겨진다", () => {
    const { guestRow, accountRow } = bothOnSpeakers();
    const segmentId = mockDb
      .getTranscript(NOTE_ID)
      .segments.find((segment) => segment.speakerLabel)!.segmentId;
    mockDb.assignSegmentSpeaker(NOTE_ID, segmentId, {
      participantId: accountRow.participantId,
    });

    mockDb.linkWorkspaceGuest(WORKSPACE_ID, GUEST_ID, accountRow.userId!);

    const moved = mockDb
      .getTranscript(NOTE_ID)
      .segments.find(
        (segment) => segment.segmentId === segmentId
      )?.assignedParticipantId;
    expect(moved).toBe(guestRow.participantId);
  });

  it("연동한 임시 참여자가 목록에서 사라진다", () => {
    const { accountRow } = bothOnSpeakers();

    mockDb.linkWorkspaceGuest(WORKSPACE_ID, GUEST_ID, accountRow.userId!);

    expect(
      mockDb
        .listWorkspaceGuests(WORKSPACE_ID)
        .guests.some((guest) => guest.guestId === GUEST_ID)
    ).toBe(false);
  });

  it("합친 뒤 화자 이름이 계정 이름이 된다", () => {
    const { guestRow, accountRow } = bothOnSpeakers();

    mockDb.linkWorkspaceGuest(WORKSPACE_ID, GUEST_ID, accountRow.userId!);

    const names = mockDb
      .getTranscript(NOTE_ID)
      .diarization.speakers.filter(
        (speaker) => speaker.assignedParticipantId === guestRow.participantId
      )
      .map((speaker) => speaker.assignedName);
    expect(new Set(names)).toEqual(new Set([accountRow.name]));
  });
});

describe("발화 단위 지정과 목/서버 계약", () => {
  beforeEach(() => mockDb.reset());

  it("참여자를 빼면 그 사람의 발화 단위 지정도 사라진다", () => {
    mockDb.replaceNoteGuestParticipants(NOTE_ID, [GUEST_ID]);
    const guestRow = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.guestId === GUEST_ID)!;
    const segmentId = mockDb
      .getTranscript(NOTE_ID)
      .segments.find((segment) => segment.speakerLabel)!.segmentId;
    mockDb.assignSegmentSpeaker(NOTE_ID, segmentId, {
      participantId: guestRow.participantId,
    });

    mockDb.replaceNoteGuestParticipants(NOTE_ID, []);

    const left = mockDb
      .getTranscript(NOTE_ID)
      .segments.find(
        (segment) => segment.segmentId === segmentId
      )?.assignedParticipantId;
    expect(left).toBeNull();
  });
});

describe("mockDb.replaceNoteParticipants — 워크스페이스를 떠난 참여자", () => {
  beforeEach(() => mockDb.reset());

  function departOtherMember() {
    const me = mockDb.getCurrentUser().userId;
    const target = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.userId && row.userId !== me)!;
    mockDb.removeMember(WORKSPACE_ID, target.userId!);
    return target;
  }

  it("나간 참여자를 그대로 실어 보내도 거절하지 않는다", () => {
    const departed = departOtherMember();
    const others = mockDb
      .getNote(NOTE_ID)
      .participants.filter(
        (row) => row.userId && row.userId !== departed.userId
      )
      .map((row) => row.userId!);

    expect(() =>
      mockDb.replaceNoteParticipants(NOTE_ID, [departed.userId!, ...others])
    ).not.toThrow();
  });

  it("나간 참여자를 뺄 수 있다", () => {
    const departed = departOtherMember();

    mockDb.replaceNoteParticipants(NOTE_ID, []);

    expect(
      mockDb
        .getNote(NOTE_ID)
        .participants.some((row) => row.userId === departed.userId)
    ).toBe(false);
  });

  it("참여자가 아니었던 사람은 나간 뒤에도 넣을 수 없다", () => {
    expect(() =>
      mockDb.replaceNoteParticipants(NOTE_ID, ["01K9999999999"])
    ).toThrow("NOT_WORKSPACE_MEMBER");
  });
});

describe("mockDb 참여자 저장 — 병합 기준이 바뀌었을 때", () => {
  beforeEach(() => mockDb.reset());

  function userIdsOf() {
    return mockDb
      .getNote(NOTE_ID)
      .participants.flatMap((row) => (row.userId ? [row.userId] : []));
  }

  it("기준이 지금과 다르면 거절하고 아무것도 안 바꾼다", () => {
    const before = userIdsOf();

    expect(() =>
      mockDb.replaceNoteParticipants(NOTE_ID, [], [...before, "01K9999999999"])
    ).toThrow("NOTE_PARTICIPANTS_CONFLICT");
    expect(userIdsOf()).toEqual(before);
  });

  it("기준이 맞거나, 같은 저장을 다시 보내거나, 기준이 없으면 통과한다", () => {
    const before = userIdsOf();

    expect(() =>
      mockDb.replaceNoteParticipants(NOTE_ID, before, ["01K9999999999"])
    ).not.toThrow();
    expect(() =>
      mockDb.replaceNoteParticipants(NOTE_ID, [], before)
    ).not.toThrow();
    expect(() => mockDb.replaceNoteParticipants(NOTE_ID, before)).not.toThrow();
  });

  it("임시 참여자는 없는 사람(404)보다 그 사이 바뀐 것을 먼저 알린다", () => {
    expect(() =>
      mockDb.replaceNoteGuestParticipants(
        NOTE_ID,
        ["01K9999999999"],
        [GUEST_ID]
      )
    ).toThrow("NOTE_PARTICIPANTS_CONFLICT");
  });
});

describe("연동 미리보기의 회의 목록", () => {
  it("바뀌는 회의를 최근순으로 돌려준다", () => {
    mockDb.replaceNoteGuestParticipants(NOTE_ID, [GUEST_ID]);

    const plan = mockDb.previewWorkspaceGuestLink(
      WORKSPACE_ID,
      GUEST_ID,
      mockDb.listMembers(WORKSPACE_ID)[0].userId
    );

    expect(plan.changedNotes.length).toBeGreaterThan(1);
    const createdAts = plan.changedNotes.map(
      (note) => mockDb.getNote(note.noteId).createdAt
    );
    expect(createdAts).toEqual([...createdAts].sort().reverse());
  });
});

describe("mockDb.renameWorkspaceGuest", () => {
  beforeEach(() => mockDb.reset());

  it("이름만 바꾸고 참여 기록 id 와 화자 지정은 그대로 두며 회의의 이름 사본을 따라 바꾼다", () => {
    mockDb.replaceNoteGuestParticipants(NOTE_ID, [GUEST_ID]);
    const before = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.guestId === GUEST_ID)!;
    mockDb.assignSpeaker(NOTE_ID, "B", { participantId: before.participantId });

    const renamed = mockDb.renameWorkspaceGuest(
      WORKSPACE_ID,
      GUEST_ID,
      "  새 이름 "
    );

    expect(renamed).toMatchObject({
      guestId: GUEST_ID,
      displayName: "새 이름",
    });
    const after = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.guestId === GUEST_ID)!;
    expect(after.participantId).toBe(before.participantId);
    expect(after.name).toBe("새 이름");
    const speaker = mockDb
      .getTranscript(NOTE_ID)
      .diarization.speakers.find((row) => row.label === "B")!;
    expect(speaker.assignedParticipantId).toBe(before.participantId);
    expect(speaker.assignedName).toBe("새 이름");
  });

  it("빈 이름은 거절하고 다른 워크스페이스의 임시 참여자는 없는 것으로 본다", () => {
    expect(() =>
      mockDb.renameWorkspaceGuest(WORKSPACE_ID, GUEST_ID, "  ")
    ).toThrow("BAD_REQUEST");
    expect(() =>
      mockDb.renameWorkspaceGuest("01K0000000999", GUEST_ID, "이름")
    ).toThrow();
  });
});
