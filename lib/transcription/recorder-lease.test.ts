import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimOf,
  type RecordingRecord,
} from "@/lib/transcription/recorder-lease";

describe("claimOf", () => {
  const NOW = 100_000;
  const record = (
    clientInstanceId: string,
    ageMs: number,
    noteId = "note-a"
  ): RecordingRecord => ({ noteId, clientInstanceId, beatAt: NOW - ageMs });

  it("기록이 없으면 null", () => {
    expect(claimOf([record("other", 0, "note-b")], "note-a", "me", NOW)).toBe(
      null
    );
  });

  it("이 탭의 기록뿐이면 mine", () => {
    expect(claimOf([record("me", 60_000)], "note-a", "me", NOW)).toBe("mine");
  });

  it("다른 탭의 박동이 6초 안이면 이 탭 기록이 있어도 live", () => {
    expect(
      claimOf([record("me", 0), record("other", 6_000)], "note-a", "me", NOW)
    ).toBe("live");
  });

  it("다른 탭의 박동이 식었으면 dead, 이 탭 기록이 있으면 mine", () => {
    expect(claimOf([record("other", 6_001)], "note-a", "me", NOW)).toBe("dead");
    expect(
      claimOf([record("me", 0), record("other", 6_001)], "note-a", "me", NOW)
    ).toBe("mine");
  });
});

describe("탭 식별 clientInstanceId", () => {
  const KEY = "heymoa.transcription.clientInstanceId";
  const load = async () => {
    vi.resetModules();
    return (await import("@/lib/transcription/recorder-lease"))
      .clientInstanceId;
  };
  afterEach(() => {
    sessionStorage.clear();
    window.name = "";
  });

  it("새로고침한 같은 탭은 같은 값을 보낸다", async () => {
    const first = (await load())();

    expect((await load())()).toBe(first);
  });

  it("sessionStorage 를 물려받은 새 창은 다른 값을 만든다", async () => {
    const opener = (await load())();
    window.name = "";
    expect(sessionStorage.getItem(KEY)).toBe(opener);

    const child = (await load())();

    expect(child).not.toBe(opener);
    expect((await load())()).toBe(child);
  });
});
