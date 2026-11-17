import { describe, expect, it } from "vitest";

import { personAvatarKey } from "@/components/heymoa/person-avatar";
import { createSpeakerIdentityResolver } from "@/lib/transcription/speaker-identity";

const speakerName = (label: string) => `화자 ${label}`;

const speaker = (
  label: string,
  assignedName: string | null = null,
  extra: Record<string, unknown> = {}
) => ({
  label,
  speakingMs: 1_000,
  segmentCount: 1,
  representativeSegmentId: "0HZX2K7M9Q4AD",
  assignedParticipantId: assignedName ? "0HZX2K7M9Q4AP" : null,
  assignedName,
  confirmed: assignedName !== null,
  ...extra,
});

describe("createSpeakerIdentityResolver", () => {
  it("연결된 화자는 이름을, 안 된 화자는 라벨을 보인다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", "김민수"), speaker("B")],
      [{ participantId: "0HZX2K7M9Q4AP", name: "김민수" }], speakerName);

    expect(resolve("A")?.displayName).toBe("김민수");
    expect(resolve("B")?.displayName).toBe("화자 B");
  });

  it("같은 라벨은 부를 때마다 같은 객체를 준다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A"), speaker("B")], [], speakerName);

    expect(resolve("A")).toBe(resolve("A"));
    expect(resolve("A")).not.toBe(resolve("B"));
    expect(resolve(null)).toBeNull();
  });

  it("「참석자 아님」으로 확정해도 화자 A 로 남는다", () => {
    const resolve = createSpeakerIdentityResolver([
      { ...speaker("A"), assignedParticipantId: null, confirmed: true },
    ], [], speakerName);

    expect(resolve("A")?.displayName).toBe("화자 A");
    expect(resolve("A")?.unassigned).toBe(false);
  });

  it("얼굴에 글자를 얹지 않는다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A"), speaker("B")], [], speakerName);

    expect(resolve("A")).not.toHaveProperty("initial");
    expect(resolve("B")).not.toHaveProperty("initial");
  });

  it("두 자리 라벨도 색을 받는다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("AA")], [], speakerName);

    expect(resolve("AA")?.avatarName).toBeTruthy();
  });

  it("아직 안 본 화자를 표시한다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A")], [], speakerName);

    expect(resolve("A")?.unassigned).toBe(true);
  });

  it("이름을 붙이면 그 사람의 얼굴이 된다 — 참석자 목록과 같은 얼굴이다", () => {
    const participant = {
      participantId: "0HZX2K7M9Q4AP",
      userId: "0HZX2K7M9Q4AU",
      name: "김민수",
      image: null,
    };
    const before = createSpeakerIdentityResolver([speaker("A")], [], speakerName);
    const after = createSpeakerIdentityResolver(
      [speaker("A", "김민수")],
      [participant], speakerName);

    expect(after("A")?.avatarName).not.toBe(before("A")?.avatarName);
    expect(after("A")?.avatarName).toBe(personAvatarKey(participant));
  });

  it("한 사람이 라벨 둘을 맡아도 색이 하나다", () => {
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "한지원"),
      speaker("D", "이동준", { assignedParticipantId: "mentor" }),
      speaker("E", "이동준", { assignedParticipantId: "mentor" }),
    ], [], speakerName);

    expect(resolve("E")?.avatarName).toEqual(resolve("D")?.avatarName);
    expect(resolve("E")?.avatarName).not.toEqual(resolve("A")?.avatarName);
  });

  it("화자마다 다른 얼굴 열쇠를 받는다", () => {
    const labels = Array.from({ length: 26 }, (_, index) =>
      String.fromCharCode(65 + index)
    );
    const resolve = createSpeakerIdentityResolver(
      labels.map((label) => speaker(label)), [], speakerName);

    const names = new Set(labels.map((label) => resolve(label)?.avatarName));
    expect(names.size).toBe(26);
  });

  it("모르는 모양의 라벨도 색을 받는다 — 순번을 못 매기면 해싱으로 돈다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("9X")], [], speakerName);

    expect(resolve("9X")?.avatarName).toBeTruthy();
  });

  it("같은 입력에 같은 얼굴을 준다 — 저장 안 해도 안 흔들린다", () => {
    const first = createSpeakerIdentityResolver([speaker("A", "김민수")], [], speakerName);
    const second = createSpeakerIdentityResolver([speaker("A", "김민수")], [], speakerName);

    expect(first("A")?.avatarName).toEqual(second("A")?.avatarName);
  });

  it("같은 라벨이라도 사람이 다르면 얼굴이 다르다", () => {
    const one = createSpeakerIdentityResolver([
      { label: "A", assignedName: "김민수", assignedParticipantId: "p-1" },
    ] as never, [], speakerName);
    const other = createSpeakerIdentityResolver([
      { label: "A", assignedName: "박서준", assignedParticipantId: "p-2" },
    ] as never, [], speakerName);

    expect(one("A")?.avatarName).not.toBe(other("A")?.avatarName);
  });

  it("계정이 연결되면 프로필 사진을 준다", () => {
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "김민수", { image: "https://cdn.example.com/kim.png" }),
    ], [], speakerName);

    expect(resolve("A")?.imageUrl).toBe("https://cdn.example.com/kim.png");
  });

  it("참석자 목록에서 얼굴을 끌어온다 — 화자에는 참여 기록 식별자만 온다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", "김민수", { assignedParticipantId: "01K0000000101" })],
      [{ participantId: "01K0000000101", image: "https://cdn.example.com/kim.png" }], speakerName);

    expect(resolve("A")?.imageUrl).toBe("https://cdn.example.com/kim.png");
  });

  it("사진 없는 사람은 이니셜로 남는다 — 색은 그대로 준다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", "한지원", { assignedParticipantId: "01K0000000120" })],
      [{ participantId: "01K0000000120", image: null }], speakerName);

    expect(resolve("A")?.imageUrl).toBeNull();
    expect(resolve("A")?.avatarName).toBeTruthy();
  });

  it("아직 아무도 안 붙은 화자는 참석자를 봐도 얼굴이 없다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", null)],
      [{ participantId: "01K0000000101", image: "https://cdn.example.com/kim.png" }], speakerName);

    expect(resolve("A")?.imageUrl).toBeNull();
    expect(resolve("A")?.displayName).toBe("화자 A");
  });

  it("모르는 라벨과 null 을 각각 다루다", () => {
    const resolve = createSpeakerIdentityResolver([], [], speakerName);

    expect(resolve(null)).toBeNull();
    expect(resolve("Z")?.displayName).toBe("화자 Z");
  });
});

describe("발화 단위 화자 지정", () => {
  const speakers = [
    { label: "A", assignedName: "김민수", assignedParticipantId: "p-1" },
    { label: "B", assignedName: "박서준", assignedParticipantId: "p-2" },
  ] as never;
  const participants = [
    { participantId: "p-1", name: "김민수", image: null },
    { participantId: "p-2", name: "박서준", image: "https://cdn/park.png" },
  ];

  it("라벨의 이름을 이긴다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants, speakerName);

    expect(resolve("A")?.displayName).toBe("김민수");
    expect(resolve("A", "p-2")?.displayName).toBe("박서준");
  });

  it("얼굴도 그 사람 것으로 바뀐다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants, speakerName);

    expect(resolve("A", "p-2")?.imageUrl).toBe("https://cdn/park.png");
  });

  it("색도 그 사람 것으로 바뀐다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants, speakerName);

    expect(resolve("A", "p-2")?.avatarName).not.toEqual(resolve("A")?.avatarName);
    expect(resolve("A", "p-2")?.avatarName).toEqual(resolve("B")?.avatarName);
  });

  it("사람이 고른 줄이므로 미확인이 아니다", () => {
    const unconfirmed = [{ label: "B" }] as never;
    const resolve = createSpeakerIdentityResolver(unconfirmed, participants, speakerName);

    expect(resolve("B")?.unassigned).toBe(true);
    expect(resolve("B", "p-2")?.unassigned).toBe(false);
  });

  it("목록에 없는 참여 기록이면 라벨을 따른다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants, speakerName);

    expect(resolve("A", "p-사라짐")?.displayName).toBe("김민수");
  });

  it("값이 없으면 지금까지와 똑같다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants, speakerName);

    expect(resolve("A", null)).toEqual(resolve("A"));
  });
});

describe("얼굴 열쇠", () => {
  it("다른 guestId 는 대체로 다른 색을 받는다", () => {
    const ids = [
      "0RH39K0Q9GRZK",
      "0RH39JED9GRT1",
      "0RH39DY1DGVEY",
      "0RFSZX711SRVN",
      "0RFSZK4B1SRZT",
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
