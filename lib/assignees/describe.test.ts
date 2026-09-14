import { describe, expect, it } from "vitest";

import {
  assigneeKey,
  assigneeRequestOf,
  describeAssignee,
} from "@/lib/assignees/describe";

describe("describeAssignee", () => {
  it("사람은 이름과 식별자 얼굴로 선다", () => {
    expect(
      describeAssignee({ type: "GUEST", id: "01K0000000991", name: "한지원" })
    ).toEqual({ name: "한지원", avatarKey: "01K0000000991", unnamed: false });
  });

  it("사람으로 풀리지 않은 화자는 이름 없는 화자다", () => {
    const view = describeAssignee({
      type: "SPEAKER_LABEL",
      noteId: "01K0000000920",
      label: "F",
    });
    expect(view).toMatchObject({ name: "화자 F", unnamed: true });
    expect(describeAssignee(null)).toBeNull();
  });

  it("같은 사람은 같은 열쇠이고, 요청 본문은 종류마다 필요한 값만 싣는다", () => {
    expect(assigneeKey({ type: "USER", id: "u1", name: "가" })).toBe(
      assigneeKey({ type: "USER", id: "u1" })
    );
    expect(assigneeRequestOf({ type: "USER", id: "u1", name: "가" })).toEqual({
      type: "USER",
      id: "u1",
    });
    expect(
      assigneeRequestOf({ type: "SPEAKER_LABEL", noteId: "n1", label: "A" })
    ).toEqual({ type: "SPEAKER_LABEL", noteId: "n1", label: "A" });
  });
});
