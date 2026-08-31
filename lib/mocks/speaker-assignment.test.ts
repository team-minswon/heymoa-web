import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/lib/mocks/db";

const NOTE_ID = "01K0000000020";
// 시드: 나(ADMIN) + 한지원(MEMBER) + 임시 참여자 박서준
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
    // 한쪽만 있으면 `화자 A` 분기가 목에서 한 번도 안 그려진다
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

  /**
   * **이 기능이 뒤집은 전제다** (V31). 예전에는 새로 붙이면 앞 화자에서 떨어졌는데,
   * pyannote 가 한 사람을 둘로 쪼갠 회의에서는 그것이 고칠수록 나빠지게 만들었다 —
   * 「화자 1과 2는 같은 사람」이 사람이 할 수 있는 유일한 정정인데 그게 막혀 있었다.
   */
  it("한 사람이 여러 화자를 맡을 수 있다", () => {
    // A 에 이미 붙어 있는 사람을 B 에도 붙인다
    const [onA] = mockDb.getNote(NOTE_ID).participants;

    mockDb.assignSpeaker(NOTE_ID, "B", {
      participantId: onA.participantId,
    });

    expect(labels()).toEqual([
      // 앞 화자가 그대로 남는다 — 예전에는 여기가 null 이었다
      { label: "A", name: onA.name, confirmed: true },
      { label: "B", name: onA.name, confirmed: true },
    ]);
  });

  it("null 은 「참석자 중에 없다」로 확정한다 — 미결정과 다르다", () => {
    mockDb.assignSpeaker(NOTE_ID, "B", {});

    expect(labels().find((row) => row.label === "B")).toEqual({
      label: "B",
      name: null,
      // 이름은 없지만 사람이 봤다. 「아직 안 봤다」와 갈린다
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

  /**
   * 이 이슈의 요점 — 계정 없는 사람을 `userId` 로는 원리적으로 못 가리킨다.
   *
   * 읽던 자리에서 만들어 곧바로 붙이는 경로 그대로다(APP-494).
   */
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
    // **겸용 필드는 빈다.** 이 값만 보고 「붙은 사람 없음」으로 읽으면 안 된다.
    expect(speaker.assignedUserId).toBeNull();
    expect(speaker.confirmed).toBe(true);
  });

  /** 겸용 경로. 옛 web 이 배포되기 전까지 이 요청이 계속 온다. */
  it("옛 userId 로 보내도 새 필드가 함께 채워진다", () => {
    const member = mockDb
      .getNote(NOTE_ID)
      .participants.find((row) => row.userId !== null)!;

    mockDb.assignSpeaker(NOTE_ID, "B", { userId: member.userId });

    const speaker = mockDb
      .getTranscript(NOTE_ID)
      .diarization.speakers.find((row) => row.label === "B")!;
    expect(speaker.assignedParticipantId).toBe(member.participantId);
    expect(speaker.assignedUserId).toBe(member.userId);
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

/** 화자 A 의 발화 둘. 시드가 뒤쪽 한 줄에만 개별 지정을 걸어 둔다. */
const A_PLAIN = "01K0000000061";
const A_OVERRIDDEN = "01K0000000063";

describe("mockDb.assignSegmentSpeaker", () => {
  beforeEach(() => mockDb.reset());

  /** 목에 하나도 없으면 이 기능이 목에서 한 번도 안 그려진다. */
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
    // 같은 화자 A 의 다른 줄은 자기 지정을 그대로 지킨다
    expect(overrideOf(A_OVERRIDDEN)).toBe(untouched);
  });

  /** 해제는 「참석자 중에 없다」가 아니다 — 그 값은 라벨 단위에만 있다. */
  it("null 을 보내면 개별 지정이 사라지고 다시 라벨을 따른다", () => {
    mockDb.assignSegmentSpeaker(NOTE_ID, A_OVERRIDDEN, {});

    expect(overrideOf(A_OVERRIDDEN)).toBeNull();
  });

  /**
   * 화자 후보가 워크스페이스 멤버 전원이라, 아직 참여자가 아닌 사람이 온다.
   * **서버가 같은 요청 안에서 참여자로 넣는다** — 목도 같은 규칙을 지켜야 화면 테스트가
   * 거짓으로 통과하지 않는다.
   */
  it("참여자가 아닌 멤버를 계정으로 가리키면 참여자로도 등록된다", () => {
    // 시드는 워크스페이스 멤버 전원이 이미 이 회의의 참여자다. 한 명을 빼서 「멤버인데
    // 참여자는 아닌」 상태를 만든다 — 화면에서 참여자 체크를 푼 것과 같다.
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

  /**
   * **같은 이름을 하나 더 만드는 것**을 막는 자리다. 이 회의에 아직 없는 워크스페이스 임시
   * 참여자를 고를 수 있어야, 사람이 「＋ 추가」 대신 그 사람을 고른다.
   */
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

  /**
   * 계약이 이름 오름차순이다. 새로 넣은 사람만 맨 뒤로 가면 목이 서버와 다른 순서를 준다.
   *
   * **다만 「이름 오름차순」의 뜻이 두 곳에서 완전히 같지는 않다.** 서버는 PostgreSQL
   * `ORDER BY`(DB 콜레이션 `en_US.utf8`)이고 목은 JS `localeCompare(…, "ko")`다 — 공백이 든
   * 한국어 이름에서 갈린다. 진짜 서버와 대조해 확인했다. 여기서 지키는 것은 **넣은 사람이
   * 맨 뒤로 밀리지 않는다**이지 문자 단위 순서까지는 아니다.
   */
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

  /** 「모든 발화에 적용」이 말 그대로가 되는 자리. */
  it("그 화자에 전체 지정을 하면 개별 지정이 지워진다", () => {
    const [onA] = mockDb.getNote(NOTE_ID).participants;

    mockDb.assignSpeaker(NOTE_ID, "A", { participantId: onA.participantId });

    expect(overrideOf(A_OVERRIDDEN)).toBeNull();
  });

  /** 사람이 고른 것은 **이 화자의** 모든 발화다. */
  it("전체 지정은 다른 화자의 개별 지정을 안 건드린다", () => {
    const target = mockDb.getNote(NOTE_ID).participants.at(-1)!;
    mockDb.assignSegmentSpeaker(NOTE_ID, "01K0000000062", { participantId: target.participantId });

    mockDb.assignSpeaker(NOTE_ID, "A", { participantId: target.participantId });

    // B 의 발화라 안 지워진다
    expect(overrideOf("01K0000000062")).toBe(target.participantId);
  });

  it("이 회의의 발화가 아니면 거절한다", () => {
    expect(() =>
      mockDb.assignSegmentSpeaker(NOTE_ID, "01K9999999999", {})
    ).toThrow("TRANSCRIPT_SEGMENT_NOT_FOUND");
  });

  /** 화면은 라벨 없는 줄에 메뉴를 안 띄운다 — 저장되면 지울 방법이 없는 값이 남는다. */
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
