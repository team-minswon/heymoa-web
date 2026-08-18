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
  assignedUserId: assignedName ? "0HZX2K7M9Q4AC" : null,
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
      { ...speaker("A"), assignedUserId: null, confirmed: true },
    ]);

    expect(resolve("A")?.displayName).toBe("화자 A");
    expect(resolve("A")?.unassigned).toBe(false);
  });

  // 이름 없는 화자가 전부 「화」로 나오면 얼굴이 서로를 못 가린다. 가려 주는 글자는 라벨이다.
  it("이름이 없으면 얼굴에 라벨을 쓴다 — 「화」가 아니다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A"), speaker("B")]);

    expect(resolve("A")?.initial).toBe("A");
    expect(resolve("B")?.initial).toBe("B");
  });

  it("두 자리 라벨도 그대로 쓴다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("AA")]);

    expect(resolve("AA")?.initial).toBe("AA");
  });

  it("아직 안 본 화자를 표시한다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A")]);

    expect(resolve("A")?.unassigned).toBe(true);
  });

  // **이름을 붙이는 순간 색이 튀면 안 된다.** 예전에는 이름을 해싱해서 「화자 A」에
  // 이름을 다는 순간 딴 색이 됐다 — 같은 사람인데 화면에서 다른 사람처럼 보인다.
  it("이름을 붙여도 색이 안 바뀐다", () => {
    const before = createSpeakerIdentityResolver([speaker("A")]);
    const after = createSpeakerIdentityResolver([speaker("A", "김민수")]);

    expect(after("A")?.tint).toBe(before("A")?.tint);
  });

  // 다섯 색에 화자 넷이면 해싱은 생일 문제로 겹치기 쉽다. 실제로 이웃한 두 화자가
  // 같은 계열로 나왔다 — 순번으로 배정하면 열 명까지 한 번도 안 겹친다.
  it("열 명까지 색이 하나도 안 겹친다", () => {
    const labels = Array.from({ length: 10 }, (_, index) =>
      String.fromCharCode(65 + index)
    );
    const resolve = createSpeakerIdentityResolver(
      labels.map((label) => speaker(label))
    );

    const tints = new Set(labels.map((label) => resolve(label)?.tint));
    expect(tints.size).toBe(10);
  });

  it("열을 넘으면 되돌아 쓴다 — 이름이 있으니 색만으로 가리지 않는다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("A"), speaker("K")]);

    // A 가 0 번, K 가 10 번이라 한 바퀴 돈 자리다
    expect(resolve("K")?.tint).toBe(resolve("A")?.tint);
  });

  it("모르는 모양의 라벨도 색을 받는다 — 순번을 못 매기면 해싱으로 돈다", () => {
    const resolve = createSpeakerIdentityResolver([speaker("9X")]);

    expect(resolve("9X")?.tint).toBeTruthy();
  });

  it("같은 입력에 같은 색을 준다 — 저장 안 해도 안 흔들린다", () => {
    const first = createSpeakerIdentityResolver([speaker("A", "김민수")]);
    const second = createSpeakerIdentityResolver([speaker("A", "김민수")]);

    expect(first("A")?.tint).toBe(second("A")?.tint);
  });

  it("배경으로만 쓰는 파스텔 토큰을 돌려준다", () => {
    // DESIGN.md: never as button fills, never as text colors
    const resolve = createSpeakerIdentityResolver([speaker("A", "김민수")]);

    // 옅은 다섯도 같은 토큰을 섞어 만든다 — 여기서 새 색을 지어내지 않는다
    const all = createSpeakerIdentityResolver(
      Array.from({ length: 10 }, (_, index) =>
        speaker(String.fromCharCode(65 + index))
      )
    );
    for (let index = 0; index < 10; index += 1) {
      expect(all(String.fromCharCode(65 + index))?.tint).toMatch(
        /var\(--el-gradient-/
      );
    }
    expect(resolve("A")?.tint).toMatch(/^var\(--el-gradient-/);
  });

  it("계정이 연결되면 프로필 사진을 준다", () => {
    const resolve = createSpeakerIdentityResolver([
      speaker("A", "김민수", { image: "https://cdn.example.com/kim.png" }),
    ]);

    expect(resolve("A")?.imageUrl).toBe("https://cdn.example.com/kim.png");
    expect(resolve("A")?.initial).toBe("김");
  });

  // **여기가 실제 계약이다.** `speakers[]` 는 `assignedUserId` 만 주고 사진은 참석자
  // 목록에 있다. 위 테스트가 `image` 를 화자에 직접 얹는 바람에, 아무도 안 잇고 있다는
  // 사실이 안 보였다 — 화면에서는 붙는 순간 얼굴이 글자로 바뀌었다.
  it("참석자 목록에서 얼굴을 끌어온다 — 화자에는 userId 만 온다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", "김민수", { assignedUserId: "01K0000000001" })],
      [{ userId: "01K0000000001", image: "https://cdn.example.com/kim.png" }]
    );

    expect(resolve("A")?.imageUrl).toBe("https://cdn.example.com/kim.png");
  });

  it("사진 없는 사람은 이니셜로 남는다 — 색은 그대로 준다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", "한지원", { assignedUserId: "01K0000000020" })],
      [{ userId: "01K0000000020", image: null }]
    );

    expect(resolve("A")?.imageUrl).toBeNull();
    expect(resolve("A")?.initial).toBe("한");
    expect(resolve("A")?.tint).toBeTruthy();
  });

  it("아직 아무도 안 붙은 화자는 참석자를 봐도 얼굴이 없다", () => {
    const resolve = createSpeakerIdentityResolver(
      [speaker("A", null)],
      [{ userId: "01K0000000001", image: "https://cdn.example.com/kim.png" }]
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
