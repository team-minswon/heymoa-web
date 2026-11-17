import { describe, expect, it } from "vitest";

import { describeAssignee } from "@/lib/assignees/describe";
import { summarizeSpeakers } from "@/lib/notes/speaker-stats";
import { personAvatarKey } from "@/components/heymoa/person-avatar";
import { createSpeakerIdentityResolver } from "@/lib/transcription/speaker-identity";
import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";

const speakerName = (label: string) => `화자 ${label}`;
const names = {
  unnamedParticipant: "이름 없는 참여자",
  speaker: (label: string) => `화자 ${label}`,
};

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

const panelOrb = (stat: { avatarName: string }) => stat.avatarName;

describe("패널의 얼굴과 전사의 칩", () => {
  it("한 사람이 라벨 둘을 맡아도 두 화면이 같은 얼굴이다", () => {
    const speakers = [
      {
        label: "A",
        assignedParticipantId: "p1",
        assignedName: "한지원",
        confirmed: true,
      },
      {
        label: "D",
        assignedParticipantId: "mentor",
        assignedName: "이동준",
        confirmed: true,
      },
      {
        label: "E",
        assignedParticipantId: "mentor",
        assignedName: "이동준",
        confirmed: true,
      },
    ];
    const segments = [segment(1, "A"), segment(2, "D"), segment(3, "E")];
    const resolve = createSpeakerIdentityResolver(
      speakers as never,
      [],
      speakerName
    );
    const stats = summarizeSpeakers({ names, segments, speakers });

    const mentor = stats.find((stat) => stat.key === "mentor")!;
    expect(panelOrb(mentor)).toEqual(resolve("D")?.avatarName);
    expect(panelOrb(mentor)).toEqual(resolve("E")?.avatarName);
  });

  it("아직 아무도 안 붙은 화자도 같은 얼굴이다", () => {
    const speakers = [
      {
        label: "C",
        assignedParticipantId: null,
        assignedName: null,
        confirmed: false,
      },
    ];
    const resolve = createSpeakerIdentityResolver(
      speakers as never,
      [],
      speakerName
    );
    const stats = summarizeSpeakers({
      names,
      segments: [segment(1, "C")],
      speakers,
    });

    expect(panelOrb(stats[0])).toEqual(resolve("C")?.avatarName);
  });

  it("발화 하나만 돌려받은 사람도 두 화면이 같은 얼굴이다", () => {
    const speakers = [
      {
        label: "A",
        assignedParticipantId: "p1",
        assignedName: "한지원",
        confirmed: true,
      },
    ];
    const participants = [
      { participantId: "p1", name: "한지원", image: null },
      { participantId: "p2", name: "상어", image: null },
    ];
    const segments = [segment(1, "A"), segment(2, "A", "p2")];
    const resolve = createSpeakerIdentityResolver(
      speakers as never,
      participants,
      speakerName
    );
    const stats = summarizeSpeakers({
      names,
      segments,
      speakers,
      participants,
    });

    const shark = stats.find((stat) => stat.key === "p2")!;
    expect(panelOrb(shark)).toEqual(resolve("A", "p2")?.avatarName);
    expect(panelOrb(shark)).not.toEqual(resolve("A")?.avatarName);
  });

  it("라벨이 Z 를 넘어도 두 화면이 같은 얼굴이다", () => {
    const speakers = [
      {
        label: "AA",
        assignedParticipantId: "mentor",
        assignedName: "이동준",
        confirmed: true,
      },
      {
        label: "B",
        assignedParticipantId: "mentor",
        assignedName: "이동준",
        confirmed: true,
      },
    ];
    const segments = [segment(1, "AA"), segment(2, "B")];
    const resolve = createSpeakerIdentityResolver(
      speakers as never,
      [],
      speakerName
    );
    const stats = summarizeSpeakers({ names, segments, speakers });

    expect(panelOrb(stats[0])).toEqual(resolve("AA")?.avatarName);
    expect(panelOrb(stats[0])).toEqual(resolve("B")?.avatarName);
  });
});

describe("계정 없는 임시 참여자", () => {
  it("전사·참석자 목록과 같은 얼굴이다", () => {
    const speakers = [
      {
        label: "A",
        assignedParticipantId: "p-guest",
        assignedName: "강성욱 멘토님",
        confirmed: true,
      },
    ];
    const participants = [
      {
        participantId: "p-guest",
        userId: null,
        guestId: "g-1",
        name: "강성욱 멘토님",
        image: null,
      },
    ];
    const resolve = createSpeakerIdentityResolver(
      speakers as never,
      participants,
      speakerName
    );
    const stats = summarizeSpeakers({
      names,
      segments: [segment(1, "A")],
      speakers,
      participants,
    });

    expect(panelOrb(stats[0])).toEqual(resolve("A")?.avatarName);
  });

  it("한 마디도 안 한 임시 참여자도 같은 얼굴이다", () => {
    const participants = [
      {
        participantId: "p-silent",
        userId: null,
        guestId: "g-2",
        name: "황성윤",
        image: null,
      },
    ];
    const resolve = createSpeakerIdentityResolver(
      [] as never,
      participants,
      speakerName
    );
    const stats = summarizeSpeakers({
      names,
      segments: [],
      speakers: [],
      participants,
    });

    const silent = stats.find((stat) => stat.name === "황성윤")!;
    expect(panelOrb(silent)).toEqual(personAvatarKey(participants[0]));
    expect(resolve).toBeTypeOf("function");
  });
});

describe("요약의 담당 칸과 전사의 칩", () => {
  it("아직 아무도 안 붙은 화자는 같은 얼굴이다", () => {
    const resolve = createSpeakerIdentityResolver(
      [{ label: "B", assignedParticipantId: null, confirmed: false }] as never,
      [],
      speakerName
    );

    expect(
      describeAssignee(
        { type: "SPEAKER_LABEL", noteId: "n1", label: "B" },
        speakerName
      )?.avatarKey
    ).toEqual(resolve("B")?.avatarName);
  });

  it("사람이 붙은 화자는 담당으로 풀린 그 사람과 같은 얼굴이다", () => {
    const resolve = createSpeakerIdentityResolver(
      [{ label: "B", assignedParticipantId: "p1", confirmed: true }] as never,
      [{ participantId: "p1", userId: "u1", name: "QA 비" }],
      speakerName
    );

    expect(
      describeAssignee({ type: "USER", id: "u1", name: "QA 비" }, speakerName)
        ?.avatarKey
    ).toEqual(resolve("B")?.avatarName);
  });
});
