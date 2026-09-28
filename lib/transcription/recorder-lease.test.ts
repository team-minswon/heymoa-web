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

/**
 * 새 창에 sessionStorage 가 복사되는 두 길(opener 를 가진 window.open, 탭 복제)과 새로고침을 가른다.
 * 모듈을 다시 불러오는 것이 문서 하나가 새로 뜨는 것이다.
 */
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
    // 새 창: 저장소는 복사되지만 창 이름은 비어 있다
    window.name = "";
    expect(sessionStorage.getItem(KEY)).toBe(opener);

    const child = (await load())();

    expect(child).not.toBe(opener);
    expect((await load())()).toBe(child);
  });
});
