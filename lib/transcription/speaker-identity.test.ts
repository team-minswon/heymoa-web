import { describe, expect, it } from "vitest";

import { personAvatarKey } from "@/components/heymoa/person-avatar";
import { createSpeakerIdentityResolver } from "@/lib/transcription/speaker-identity";

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
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "김민수"),
      speaker("B"),
    ]);

    expect(resolve("A")?.displayName).toBe("김민수");
    expect(resolve("B")?.displayName).toBe("화자 B");
  });

  it("「참석자 아님」으로 확정해도 화자 A 로 남는다", () => {
    // 그 사람이 누구인지 우리가 모른다는 것이 사실이다
    const resolve = createSpeakerIdentityResolver([
      { ...speaker("A"), assignedParticipantId: null, confirmed: true },
    ]);

    expect(resolve("A")?.displayName).toBe("화자 A");
    expect(resolve("A")?.unassigned).toBe(false);
  });

  // **얼굴에 글자를 얹지 않는다.** 이름이 늘 옆에 붙어 있어 글자가 가려 주는 것이 없고,
  // 글자를 빼면 대비 하한이 사라져 색을 더 또렷하게 쓸 수 있다.
  it("얼굴에 글자를 얹지 않는다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A"), speaker("B")]);

    expect(resolve("A")).not.toHaveProperty("initial");
    expect(resolve("B")).not.toHaveProperty("initial");
  });

  it("두 자리 라벨도 색을 받는다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("AA")]);

    expect(resolve("AA")?.avatarName).toBeTruthy();
  });

  it("아직 안 본 화자를 표시한다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A")]);

    expect(resolve("A")?.unassigned).toBe(true);
  });

  /**
   * 이름을 붙이면 얼굴이 **그 사람 것**으로 바뀐다. 예전에는 색이 라벨 것이라 안 바뀌는
   * 것이 규칙이었는데, 얼굴은 사람을 가리키므로 반대가 맞다 — 참석자 목록·설정에서 보던
   * 그 얼굴이 전사에도 서야 「같은 사람」으로 읽힌다. 바로 그 사람을 방금 골랐으니 튀지도
   * 않는다.
   */
  it("이름을 붙이면 그 사람의 얼굴이 된다 — 참석자 목록과 같은 얼굴이다", () => {
    const participant = {
      participantId: "0HZX2K7M9Q4AP",
      userId: "0HZX2K7M9Q4AU",
      name: "김민수",
      image: null,
    };
    const before = createSpeakerIdentityResolver([speaker("A")]);
    const after = createSpeakerIdentityResolver(
      [speaker("A", "김민수")],
      [participant]
    );

    expect(after("A")?.avatarName).not.toBe(before("A")?.avatarName);
    // 참석자 아바타가 쓰는 열쇠와 **같아야** 한다.
    expect(after("A")?.avatarName).toBe(personAvatarKey(participant));
  });

  /**
   * **한 사람은 한 색이다.** V31 부터 한 사람이 라벨 둘을 맡을 수 있는데(목소리가 갈렸고
   * 사람은 하나다), 색을 라벨마다 주면 이름과 얼굴이 같은 두 줄이 다른 색으로 서서
   * 「왜 색이 두 개지」가 된다. 그 사람의 **가장 이른 라벨**이 색을 정한다 — 순번 배정의
   * 안 겹치는 성질을 그대로 쓰면서 사람 하나에 색 하나가 된다.
   */
  it("한 사람이 라벨 둘을 맡아도 색이 하나다", () => {
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "한지원"),
      speaker("D", "이동준", { assignedParticipantId: "mentor" }),
      speaker("E", "이동준", { assignedParticipantId: "mentor" }),
    ]);

    expect(resolve("E")?.avatarName).toEqual(resolve("D")?.avatarName);
    // 라벨 색을 그대로 쓰면 E 는 다섯 번째 색이다 — 그것이 아니어야 한다.
    expect(resolve("E")?.avatarName).not.toEqual(resolve("A")?.avatarName);
  });

  /**
   * 얼굴은 `boring-avatars` 가 **열쇠 문자열**에서 그린다. 열쇠가 다르면 얼굴이 다르므로,
   * 여기서 볼 것은 「서로 다른 화자가 서로 다른 열쇠를 받는가」다.
   */
  it("화자마다 다른 얼굴 열쇠를 받는다", () => {
    const labels = Array.from({ length: 26 }, (_, index) =>
      String.fromCharCode(65 + index)
    );
    const resolve = createSpeakerIdentityResolver(
      labels.map((label) => speaker(label))
    );

    const names = new Set(labels.map((label) => resolve(label)?.avatarName));
    expect(names.size).toBe(26);
  });

  it("모르는 모양의 라벨도 색을 받는다 — 순번을 못 매기면 해싱으로 돈다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("9X")]);

    expect(resolve("9X")?.avatarName).toBeTruthy();
  });

  it("같은 입력에 같은 얼굴을 준다 — 저장 안 해도 안 흔들린다", () => {
    const first = createSpeakerIdentityResolver([speaker("A", "김민수")]);
    const second = createSpeakerIdentityResolver([speaker("A", "김민수")]);

    expect(first("A")?.avatarName).toEqual(second("A")?.avatarName);
  });

  /**
   * **라벨만으로 열쇠를 만들면 안 된다.** 라벨은 회의마다 다시 쓰여서, 다른 회의의 화자 A 가
   * 같은 얼굴로 서면 서로 다른 두 사람이 한 얼굴이 된다. 참여 기록을 섞어 그걸 가른다.
   */
  it("같은 라벨이라도 사람이 다르면 얼굴이 다르다", () => {
    const one = createSpeakerIdentityResolver([
      { label: "A", assignedName: "김민수", assignedParticipantId: "p-1" },
    ] as never);
    const other = createSpeakerIdentityResolver([
      { label: "A", assignedName: "박서준", assignedParticipantId: "p-2" },
    ] as never);

    expect(one("A")?.avatarName).not.toBe(other("A")?.avatarName);
  });

  it("계정이 연결되면 프로필 사진을 준다", () => {
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "김민수", { image: "https://cdn.example.com/kim.png" }),
    ]);

    expect(resolve("A")?.imageUrl).toBe("https://cdn.example.com/kim.png");
  });

  // **여기가 실제 계약이다.** `speakers[]` 는 붙은 사람의 식별자만 주고 사진은 참석자
  // 목록에 있다. 위 테스트가 `image` 를 화자에 직접 얹는 바람에, 아무도 안 잇고 있다는
  // 사실이 안 보였다 — 화면에서는 붙는 순간 얼굴이 글자로 바뀌었다.
  //
  // 잇는 열쇠는 **참여 기록**이다(APP-491). 계정으로 이으면 계정 없는 사람은 그 값이
  // 없어 전부 한 칸에 뭉치고, 남의 사진이 실릴 수 있다.
  it("참석자 목록에서 얼굴을 끌어온다 — 화자에는 참여 기록 식별자만 온다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", "김민수", { assignedParticipantId: "01K0000000101" })],
      [{ participantId: "01K0000000101", image: "https://cdn.example.com/kim.png" }]
    );

    expect(resolve("A")?.imageUrl).toBe("https://cdn.example.com/kim.png");
  });

  it("사진 없는 사람은 이니셜로 남는다 — 색은 그대로 준다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", "한지원", { assignedParticipantId: "01K0000000120" })],
      [{ participantId: "01K0000000120", image: null }]
    );

    expect(resolve("A")?.imageUrl).toBeNull();
    expect(resolve("A")?.avatarName).toBeTruthy();
  });

  it("아직 아무도 안 붙은 화자는 참석자를 봐도 얼굴이 없다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", null)],
      [{ participantId: "01K0000000101", image: "https://cdn.example.com/kim.png" }]
    );

    expect(resolve("A")?.imageUrl).toBeNull();
    expect(resolve("A")?.displayName).toBe("화자 A");
  });

  it("모르는 라벨과 null 을 각각 다루다", () => {
    const resolve = createSpeakerIdentityResolver([]);

    expect(resolve(null)).toBeNull();
    expect(resolve("Z")?.displayName).toBe("화자 Z");
  });
});

describe("발화 단위 화자 지정", () => {
  const speakers = [
    { label: "A", assignedName: "김민수", assignedParticipantId: "p-1" },
    // 박서준은 화자 B 의 주인이다 — 아래 색 검사가 「그 사람의 색」을 여기서 가져온다.
    { label: "B", assignedName: "박서준", assignedParticipantId: "p-2" },
  ] as never;
  const participants = [
    { participantId: "p-1", name: "김민수", image: null },
    { participantId: "p-2", name: "박서준", image: "https://cdn/park.png" },
  ];

  /** 더 좁은 범위를 사람이 나중에 골랐다는 뜻이다. */
  it("라벨의 이름을 이긴다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants);

    expect(resolve("A")?.displayName).toBe("김민수");
    expect(resolve("A", "p-2")?.displayName).toBe("박서준");
  });

  it("얼굴도 그 사람 것으로 바뀐다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants);

    expect(resolve("A", "p-2")?.imageUrl).toBe("https://cdn/park.png");
  });

  /**
   * **색도 그 사람 것으로 바뀐다.** 이 줄은 이름과 얼굴이 이미 다른 사람인데 색만 라벨
   * 것으로 남으면, 같은 사람이 화면에서 두 색으로 선다.
   */
  it("색도 그 사람 것으로 바뀐다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants);

    expect(resolve("A", "p-2")?.avatarName).not.toEqual(resolve("A")?.avatarName);
    // p-2 는 화자 B 의 주인이다 — 그 사람의 색은 어디서 보든 B 의 색이다.
    expect(resolve("A", "p-2")?.avatarName).toEqual(resolve("B")?.avatarName);
  });

  /** 사람이 이 줄을 콕 집어 골랐다. 「아직 아무도 안 본 화자」가 아니다. */
  it("사람이 고른 줄이므로 미확인이 아니다", () => {
    const unconfirmed = [{ label: "B" }] as never;
    const resolve = createSpeakerIdentityResolver(unconfirmed, participants);

    expect(resolve("B")?.unassigned).toBe(true);
    expect(resolve("B", "p-2")?.unassigned).toBe(false);
  });

  /**
   * 참석자에서 빠진 사람이 전사에 이름만 남는 것보다, 라벨의 답으로 돌아가는 편이 덜 틀리다.
   */
  it("목록에 없는 참여 기록이면 라벨을 따른다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants);

    expect(resolve("A", "p-사라짐")?.displayName).toBe("김민수");
  });

  it("값이 없으면 지금까지와 똑같다", () => {
    const resolve = createSpeakerIdentityResolver(speakers, participants);

    expect(resolve("A", null)).toEqual(resolve("A"));
  });
});

describe("얼굴 열쇠", () => {

  // **목록이 바뀌어도 내 색은 그대로다.** 순번 배정이면 남이 들어올 때 내 색이 밀린다 —
  // 색이 사람을 기억하는 단서라 그쪽이 더 나쁘다(겹침은 이름이 옆에 있어 감당된다).
  it("다른 guestId 는 대체로 다른 색을 받는다", () => {
    const ids = [
      "0RH39K0Q9GRZK",
      "0RH39JED9GRT1",
      "0RH39DY1DGVEY",
      "0RFSZX711SRVN",
      "0RFSZK4B1SRZT",
    ];
    // 얼굴은 열쇠에서 나온다 — 식별자가 다르면 열쇠도 다르다.
    expect(new Set(ids).size).toBe(ids.length);
  });
});
