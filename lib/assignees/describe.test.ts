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
    ).toEqual({
      name: "한지원",
      avatarKey: "01K0000000991",
      image: null,
      unnamed: false,
    });
  });

  // 계정 사진이 있으면 그 사람은 어느 화면에서도 같은 사진으로 서야 한다. 안 실으면
  // 담당 칸만 생성된 얼굴이 되어 한 사람이 화면마다 달라진다 (APP-678).
  it("계정 사진이 있으면 얼굴 대신 그것을 싣는다", () => {
    expect(
      describeAssignee({
        type: "USER",
        id: "01K0000000992",
        name: "김민수",
        image: "https://example.test/a.png",
      })?.image
    ).toBe("https://example.test/a.png");
  });

  it("이름 없는 화자에는 사진이 없다", () => {
    expect(
      describeAssignee({ type: "SPEAKER_LABEL", noteId: "n1", label: "F" })?.image
    ).toBeNull();
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
