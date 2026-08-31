import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/lib/mocks/db";

const WORKSPACE_ID = "01K0000000000";
const GUEST_ID = "01K0000000900";
/** 화자 A·B 가 붙어 있는 유일한 노트. */
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

/**
 * 목의 연동 경로. **여기에 테스트가 없어서** 판정 규칙을 바꿔도 조용히 통과했다 —
 * 설정 화면 테스트는 API 를 통째로 목으로 갈아 끼우므로 이 코드를 안 지난다.
 */
describe("mockDb.linkWorkspaceGuest", () => {
  beforeEach(() => mockDb.reset());

  /**
   * 임시 참여자를 화자 B 에, 계정을 화자 A 에 각각 붙여 둔다.
   *
   * 시드는 이 노트에 임시 참여자를 안 넣어 둔다 — 화자가 붙은 노트가 여기뿐이라 먼저 단다.
   */
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

  /**
   * **V31 이 이 경우를 열었다.** 예전에는 양쪽이 서로 다른 화자에 붙어 있으면 건너뛰었다 —
   * 합치면 한 사람이 두 화자가 되는데 유니크가 막았기 때문이다. 그 유니크가 사라지면서
   * 건너뛸 이유도 사라졌고, pyannote 가 한 사람을 둘로 쪼갠 회의가 정확히 이 모양이다.
   */
  it("양쪽에 화자가 붙어 있어도 합친다", () => {
    const { accountRow } = bothOnSpeakers();

    const result = mockDb.linkWorkspaceGuest(
      WORKSPACE_ID,
      GUEST_ID,
      accountRow.userId!
    );

    expect(result.changedNoteCount).toBeGreaterThan(0);
  });

  /** 살아남은 기록 하나가 화자 둘을 든다. 옮기지 않으면 한쪽이 주인을 잃는다. */
  it("사라지는 기록의 화자가 살아남는 기록으로 옮겨진다", () => {
    const { guestRow, accountRow } = bothOnSpeakers();

    mockDb.linkWorkspaceGuest(WORKSPACE_ID, GUEST_ID, accountRow.userId!);

    expect(speakerLabelsOf(guestRow.participantId)).toEqual(["A", "B"]);
    expect(participantIdsOf()).not.toContain(accountRow.participantId);
  });

  /** 발화 단위 지정도 같은 표를 따라 옮겨져야 한다 (V31). */
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
      .segments.find((segment) => segment.segmentId === segmentId)
      ?.assignedParticipantId;
    expect(moved).toBe(guestRow.participantId);
  });

  /** 전부 합쳐지므로 남길 이유가 없다. */
  it("연동한 임시 참여자가 목록에서 사라진다", () => {
    const { accountRow } = bothOnSpeakers();

    mockDb.linkWorkspaceGuest(WORKSPACE_ID, GUEST_ID, accountRow.userId!);

    expect(
      mockDb
        .listWorkspaceGuests(WORKSPACE_ID)
        .guests.some((guest) => guest.guestId === GUEST_ID)
    ).toBe(false);
  });

  /** 주인이 바뀌면 화자 목록의 이름도 함께 바뀐다. */
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

/**
 * 목이 서버와 갈리면 **화면은 되는데 실제로는 안 되는** 상태가 된다. V31 이 새 표를 만들면서
 * 두 자리가 실제로 갈렸다 — 여기서 못 박는다.
 */
describe("발화 단위 지정과 목/서버 계약", () => {
  beforeEach(() => mockDb.reset());

  /**
   * `ponytail:` 「전체 적용이 다른 회의의 같은 라벨을 안 건드린다」는 **여기서 못 막는다.**
   * 목 시드에 화자가 나뉜 회의가 하나뿐이라 같은 라벨을 든 회의를 둘 만들 수 없고, 조건을
   * 못 만드는 테스트는 고쳐도 안 고쳐도 통과해서 있으나 마나다. 코드 쪽은 `segmentsOfNote`
   * 로 노트를 가려 두었다 — 시드에 두 번째 분리 회의가 생기면 그때 이 자리를 채운다.
   */

  /** 서버는 참여 기록 FK 의 CASCADE 가 가져간다. 목에는 CASCADE 가 없어 손으로 지워야 한다. */
  it("참여자를 빼면 그 사람의 발화 단위 지정도 사라진다", () => {
    mockDb.replaceNoteGuestParticipants(NOTE_ID, [GUEST_ID]);
    const guestRow = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.guestId === GUEST_ID)!;
    const segmentId = mockDb
      .getTranscript(NOTE_ID)
      .segments.find((segment) => segment.speakerLabel)!.segmentId;
    mockDb.assignSegmentSpeaker(NOTE_ID, segmentId, { participantId: guestRow.participantId });

    // 이 회의에서 그 임시 참여자를 뺀다
    mockDb.replaceNoteGuestParticipants(NOTE_ID, []);

    const left = mockDb
      .getTranscript(NOTE_ID)
      .segments.find((segment) => segment.segmentId === segmentId)
      ?.assignedParticipantId;
    expect(left).toBeNull();
  });
});

/**
 * **목이 서버와 같은 규칙을 써야 한다.** 서버는 「현재 멤버 또는 이미 이 회의의 참여자」를
 * 받는데 목이 「현재 멤버」만 받으면, 나간 사람이 낀 회의록의 참여자 편집이 목에서만 실패한다.
 */
describe("mockDb.replaceNoteParticipants — 워크스페이스를 떠난 참여자", () => {
  beforeEach(() => mockDb.reset());

  /**
   * 이 회의의 참여자인 계정 하나를 워크스페이스 멤버에서 뺀다.
   *
   * **부른 사람 자신은 못 뺀다**(목도 서버도 `BAD_REQUEST`) — 그래서 나 아닌 참여자를 고른다.
   */
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
      .participants.filter((row) => row.userId && row.userId !== departed.userId)
      .map((row) => row.userId!);

    expect(() =>
      mockDb.replaceNoteParticipants(NOTE_ID, [departed.userId!, ...others])
    ).not.toThrow();
  });

  it("나간 참여자를 뺄 수 있다", () => {
    const departed = departOtherMember();

    mockDb.replaceNoteParticipants(NOTE_ID, []);

    expect(
      mockDb.getNote(NOTE_ID).participants.some((row) => row.userId === departed.userId)
    ).toBe(false);
  });

  /** 열린 것은 「이미 참여자」뿐이다 — 나간 사람 아무나가 아니다. */
  it("참여자가 아니었던 사람은 나간 뒤에도 넣을 수 없다", () => {
    expect(() =>
      mockDb.replaceNoteParticipants(NOTE_ID, ["01K9999999999"])
    ).toThrow("NOT_WORKSPACE_MEMBER");
  });
});

describe("연동 미리보기의 회의 목록", () => {
  /**
   * 계약이 **최근순 100건**이다. 시드 배열 순서로 자르면 오래된 것부터 나가 서버와 반대가
   * 되는데, 목록이 안 잘리는 시드에서는 그 차이가 안 보인다 — 순서만 본다.
   */
  it("바뀌는 회의를 최근순으로 돌려준다", () => {
    // 시드는 그 임시 참여자가 회의 **하나**에만 있어 순서를 가릴 수 없다. 더 최근 회의에
    // 한 번 더 붙여야 「배열 순서」와 「최근순」이 갈린다.
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
