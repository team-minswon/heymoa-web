import { describe, expect, it } from "vitest";

import { describeAssignee } from "@/lib/assignees/describe";
import { summarizeSpeakers } from "@/lib/notes/speaker-stats";
import { personAvatarKey } from "@/components/heymoa/person-avatar";
import { createSpeakerIdentityResolver } from "@/lib/transcription/speaker-identity";
import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

/**
 * **패널의 얼굴과 전사의 칩은 같은 색이어야 한다.** 목록에서 고른 사람을 본문에서 색으로
 * 되찾는 것이 그 얼굴의 일이고, 두 화면이 갈리면 그 일을 못 한다.
 *
 * 이 검사가 있는 이유는 실제로 두 번 갈렸기 때문이다 — 한 번은 한 사람이 라벨 둘을 맡았을
 * 때, 한 번은 발화 하나만 남에게 돌렸을 때. 규칙을 `speakerAvatarName` 하나로 모았고 이 파일이
 * 그 하나를 두 호출부가 정말로 같이 쓰는지 본다.
 */

const segment = (
  sequence: number,
  speakerLabel: string,
  assignedParticipantId: string | null = null
): TranscriptPresentationSegment => ({
  segmentId: `s${sequence}`,
  sequence,
  text: `발화 ${sequence}`,
  startedAtMs: sequence * 1000,
  endedAtMs: sequence * 1000 + 900,
  speakerLabel,
  assignedParticipantId,
});

/**
 * 패널 한 줄이 그리는 얼굴. **`speaker-panel.tsx` 가 그리는 바로 그 값이다** —
 * 예전에는 여기서 같은 식을 다시 써서 거울이었고, 그래서 화면만 틀려도 검사는 초록이었다.
 */
const panelOrb = (stat: { avatarName: string }) => stat.avatarName;

describe("패널의 얼굴과 전사의 칩", () => {
  // pyannote 가 한 사람을 둘로 쪼갠 실제 회의(이동준 멘토님이 라벨 D·E)에서 드러났다.
  it("한 사람이 라벨 둘을 맡아도 두 화면이 같은 얼굴이다", () => {
    const speakers = [
      { label: "A", assignedParticipantId: "p1", assignedName: "한지원", confirmed: true },
      { label: "D", assignedParticipantId: "mentor", assignedName: "이동준", confirmed: true },
      { label: "E", assignedParticipantId: "mentor", assignedName: "이동준", confirmed: true },
    ];
    const segments = [segment(1, "A"), segment(2, "D"), segment(3, "E")];
    const resolve = createSpeakerIdentityResolver(speakers as never);
    const stats = summarizeSpeakers({ segments, speakers });

    const mentor = stats.find((stat) => stat.key === "mentor")!;
    expect(panelOrb(mentor)).toEqual(resolve("D")?.avatarName);
    expect(panelOrb(mentor)).toEqual(resolve("E")?.avatarName);
  });

  it("아직 아무도 안 붙은 화자도 같은 얼굴이다", () => {
    const speakers = [{ label: "C", assignedParticipantId: null, assignedName: null, confirmed: false }];
    const resolve = createSpeakerIdentityResolver(speakers as never);
    const stats = summarizeSpeakers({ segments: [segment(1, "C")], speakers });

    expect(panelOrb(stats[0])).toEqual(resolve("C")?.avatarName);
  });

  /**
   * 발화 하나만 남에게 돌린 사람은 그 라벨을 **가진** 것이 아니다. 그걸 소유로 세면 패널이
   * 라벨 얼굴을, 전사가 해시 얼굴을 줘서 같은 사람이 두 얼굴로 선다.
   */
  it("발화 하나만 돌려받은 사람도 두 화면이 같은 얼굴이다", () => {
    const speakers = [
      { label: "A", assignedParticipantId: "p1", assignedName: "한지원", confirmed: true },
    ];
    const participants = [
      { participantId: "p1", name: "한지원", image: null },
      { participantId: "p2", name: "상어", image: null },
    ];
    const segments = [segment(1, "A"), segment(2, "A", "p2")];
    const resolve = createSpeakerIdentityResolver(speakers as never, participants);
    const stats = summarizeSpeakers({ segments, speakers, participants });

    const shark = stats.find((stat) => stat.key === "p2")!;
    expect(panelOrb(shark)).toEqual(resolve("A", "p2")?.avatarName);
    // 그리고 라벨 A 의 주인과는 다른 색이어야 한다 — 같으면 구분이 안 된다.
    expect(panelOrb(shark)).not.toEqual(resolve("A")?.avatarName);
  });

  // 기본 `sort()` 는 글자 순이라 `["AA","B"]` 를 그대로 둔다. 라벨 순번으로는 B 가 먼저다.
  it("라벨이 Z 를 넘어도 두 화면이 같은 얼굴이다", () => {
    const speakers = [
      { label: "AA", assignedParticipantId: "mentor", assignedName: "이동준", confirmed: true },
      { label: "B", assignedParticipantId: "mentor", assignedName: "이동준", confirmed: true },
    ];
    const segments = [segment(1, "AA"), segment(2, "B")];
    const resolve = createSpeakerIdentityResolver(speakers as never);
    const stats = summarizeSpeakers({ segments, speakers });

    expect(panelOrb(stats[0])).toEqual(resolve("AA")?.avatarName);
    expect(panelOrb(stats[0])).toEqual(resolve("B")?.avatarName);
  });
});

/**
 * 임시 참여자는 회의마다 `participantId` 가 새로 생기고 `guestId` 만 워크스페이스에서
 * 안 변한다. 그래서 얼굴 열쇠는 `guestId` 여야 한다 — `personAvatarKey` 가 그렇게 정한다.
 *
 * 위 검사들이 이걸 못 봤다. 참여자를 전부 `{participantId, name, image}` 로만 만들어서
 * `guestId` 가 없었고, 없으면 `personAvatarKey` 가 `participantId` 로 떨어져 두 쪽이
 * 우연히 같아진다. **갈리게 하는 바로 그 필드가 검사에 없었다.**
 */
describe("계정 없는 임시 참여자", () => {
  it("전사·참석자 목록과 같은 얼굴이다", () => {
    const speakers = [
      { label: "A", assignedParticipantId: "p-guest", assignedName: "강성욱 멘토님", confirmed: true },
    ];
    const participants = [
      { participantId: "p-guest", userId: null, guestId: "g-1", name: "강성욱 멘토님", image: null },
    ];
    const resolve = createSpeakerIdentityResolver(speakers as never, participants);
    const stats = summarizeSpeakers({ segments: [segment(1, "A")], speakers, participants });

    expect(panelOrb(stats[0])).toEqual(resolve("A")?.avatarName);
  });

  it("한 마디도 안 한 임시 참여자도 같은 얼굴이다", () => {
    const participants = [
      { participantId: "p-silent", userId: null, guestId: "g-2", name: "황성윤", image: null },
    ];
    const resolve = createSpeakerIdentityResolver([] as never, participants);
    const stats = summarizeSpeakers({ segments: [], speakers: [], participants });

    const silent = stats.find((stat) => stat.name === "황성윤")!;
    // 발화가 없으면 화자로 못 부르니, 참석자 목록이 쓰는 열쇠와 직접 견준다.
    expect(panelOrb(silent)).toEqual(personAvatarKey(participants[0]));
    expect(resolve).toBeTypeOf("function");
  });
});

/**
 * **요약의 담당 칸과 전사의 칩도 같은 얼굴이어야 한다.** 담당은 `describeAssignee` 가, 칩은
 * 화자 해석기가 얼굴을 정해서 둘이 따로 자랐고, 이름 없는 화자에서 열쇠가 갈렸다.
 */
describe("요약의 담당 칸과 전사의 칩", () => {
  it("아직 아무도 안 붙은 화자는 같은 얼굴이다", () => {
    const resolve = createSpeakerIdentityResolver([
      { label: "B", assignedParticipantId: null, confirmed: false },
    ] as never);

    expect(
      describeAssignee({ type: "SPEAKER_LABEL", noteId: "n1", label: "B" })?.avatarKey
    ).toEqual(resolve("B")?.avatarName);
  });

  it("사람이 붙은 화자는 담당으로 풀린 그 사람과 같은 얼굴이다", () => {
    const resolve = createSpeakerIdentityResolver(
      [{ label: "B", assignedParticipantId: "p1", confirmed: true }] as never,
      [{ participantId: "p1", userId: "u1", name: "QA 비" }]
    );

    expect(describeAssignee({ type: "USER", id: "u1", name: "QA 비" })?.avatarKey).toEqual(
      resolve("B")?.avatarName
    );
  });
});
