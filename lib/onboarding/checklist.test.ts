import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completedSteps,
  hasRecordedMeeting,
  requiredProgress,
  markStepDone,
  parseChecklist,
  readChecklistRaw,
  firstChecklistStatus,
  isChecklistVisible,
  writeChecklist,
} from "@/lib/onboarding/checklist";

afterEach(() => localStorage.clear());

describe("firstChecklistStatus", () => {
  it("기록한 회의가 없는 워크스페이스의 처음 보는 사람에게만 연다", () => {
    expect(firstChecklistStatus({ hasRecording: false })).toBe("open");
    // 이 기능 전부터 쓰던 사람 · 굴러가는 워크스페이스에 초대된 사람은 닫아 둔다(다시 보기로 연다)
    expect(firstChecklistStatus({ hasRecording: true })).toBe("dismissed");
  });
});

describe("isChecklistVisible", () => {
  it("열려 있거나, 처음 판단 전에 목록을 못 읽었을 때 그린다", () => {
    expect(isChecklistVisible({ status: "open", done: [] }, false)).toBe(true);
    expect(isChecklistVisible({ status: "dismissed", done: [] }, true)).toBe(
      false
    );
    expect(isChecklistVisible(null, false)).toBe(false);
    // 판단 전 실패를 숨기면 판단이 영영 안 나서 시작 안내가 조용히 사라진다
    expect(isChecklistVisible(null, true)).toBe(true);
  });
});

describe("requiredProgress", () => {
  // 혼자 쓰는 사람도 끝까지 가도록 초대는 선택이다 — 세지 않는다
  it("선택 단계(초대)는 세지 않는다", () => {
    expect(requiredProgress(new Set(["record", "invite"]))).toEqual({
      done: 1,
      total: 2,
    });
    expect(requiredProgress(new Set(["record", "confirm"]))).toEqual({
      done: 2,
      total: 2,
    });
  });
});

describe("hasRecordedMeeting", () => {
  const notStarted = { meetingStartedAt: null } as never;
  const started = { meetingStartedAt: "2026-10-01T00:00:00Z" } as never;

  it("첫 쪽에 기록이 없어도 뒤에 더 있으면 기록이 있는 것으로 본다", () => {
    expect(hasRecordedMeeting({ notes: [notStarted], hasMore: false })).toBe(
      false
    );
    expect(
      hasRecordedMeeting({ notes: [notStarted, started], hasMore: false })
    ).toBe(true);
    // 녹음 안 한 노트가 30개 넘게 쌓인 기존 워크스페이스
    expect(hasRecordedMeeting({ notes: [notStarted], hasMore: true })).toBe(
      true
    );
  });
});

describe("completedSteps", () => {
  it("서버 사실과 이 기기에서 해 본 것을 합친다", () => {
    const done = completedSteps(
      { status: "open", done: ["invite"] },
      { hasRecording: true }
    );

    expect([...done].sort()).toEqual(["invite", "record"]);
  });
});

describe("저장", () => {
  it("연 적 없는 사람에게는 해 본 단계를 적지 않는다", () => {
    markStepDone("u1", "invite");
    expect(readChecklistRaw("u1")).toBeNull();

    writeChecklist("u1", { status: "open", done: [] });
    markStepDone("u1", "invite");
    markStepDone("u1", "invite");
    expect(parseChecklist(readChecklistRaw("u1"))).toEqual({
      status: "open",
      done: ["invite"],
    });
  });

  // 저장 공간이 꽉 차 쓰기만 실패해도 이번 문서에서는 닫기·완료가 먹어야 한다 (codex 리뷰)
  it("저장하지 못한 값을 저장소의 옛 값보다 먼저 읽는다", () => {
    writeChecklist("u2", { status: "open", done: [] });
    const set = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });

    writeChecklist("u2", { status: "dismissed", done: [] });
    expect(parseChecklist(readChecklistRaw("u2"))?.status).toBe("dismissed");

    set.mockRestore();
    writeChecklist("u2", { status: "open", done: ["invite"] });
    expect(parseChecklist(readChecklistRaw("u2"))).toEqual({
      status: "open",
      done: ["invite"],
    });
  });

  it("깨진 값·모르는 단계는 버린다", () => {
    expect(parseChecklist("{")).toBeNull();
    expect(parseChecklist('{"status":"weird"}')).toBeNull();
    expect(
      parseChecklist('{"status":"open","done":["invite","old-step"]}')
    ).toEqual({
      status: "open",
      done: ["invite"],
    });
  });
});
