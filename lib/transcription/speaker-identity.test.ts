import { describe, expect, it } from "vitest";

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
  assignedParticipantId: assignedName ? "0HZX2K7M9Q4B1" : null,
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

  it("아직 안 본 화자를 표시한다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A")]);

    expect(resolve("A")?.unassigned).toBe(true);
  });

  it("한 사람이 두 화자로 쪼개져도 색이 같아진다", () => {
    // 해싱 입력이 이름이라 병합 코드가 따로 필요 없다
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "김민수"),
      speaker("C", "김민수"),
    ]);

    expect(resolve("A")?.tint).toBe(resolve("C")?.tint);
  });

  it("다른 사람은 대체로 다른 색을 받는다", () => {
    const names = ["김민수", "박서준", "이영희", "최지우", "정한별"];
    const resolve = createSpeakerIdentityResolver(
      names.map((name, index) => speaker(String.fromCharCode(65 + index), name))
    );

    const tints = new Set(
      names.map((_, index) => resolve(String.fromCharCode(65 + index))?.tint)
    );
    // 팔레트가 다섯이라 다섯 명이면 겹칠 수 있다. 셋 이상 갈리면 충분하다
    expect(tints.size).toBeGreaterThanOrEqual(3);
  });

  it("같은 입력에 같은 색을 준다 — 저장 안 해도 안 흔들린다", () => {
    const first = createSpeakerIdentityResolver([speaker("A", "김민수")]);
    const second = createSpeakerIdentityResolver([speaker("A", "김민수")]);

    expect(first("A")?.tint).toBe(second("A")?.tint);
  });

  it("배경으로만 쓰는 파스텔 토큰을 돌려준다", () => {
    // DESIGN.md: never as button fills, never as text colors
    const resolve = createSpeakerIdentityResolver([speaker("A", "김민수")]);

    expect(resolve("A")?.tint).toMatch(/^var\(--el-gradient-/);
  });

  it("계정이 연결되면 프로필 사진을 준다", () => {
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "김민수", { image: "https://cdn.example.com/kim.png" }),
    ]);

    expect(resolve("A")?.imageUrl).toBe("https://cdn.example.com/kim.png");
    expect(resolve("A")?.initial).toBe("김");
  });

  it("모르는 라벨과 null 을 각각 다루다", () => {
    const resolve = createSpeakerIdentityResolver([]);

    expect(resolve(null)).toBeNull();
    expect(resolve("Z")?.displayName).toBe("화자 Z");
  });
});
