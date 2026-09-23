import { describe, expect, it } from "vitest";

import { getGetNotesQueryKey, getGetWorkspaceNotesQueryKey } from "@/lib/api/generated/notes/notes";
import { getGetProjectTasksQueryKey, getGetWorkspaceTasksQueryKey } from "@/lib/api/generated/projects/projects";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

/**
 * **판정을 손으로 쓴 문자열이 아니라 생성 키로 먹인다.** 정규식과 실제 키가 갈리는 순간을
 * 잡는 것이 목적인데, 기대값을 손으로 적으면 그 갈림이 테스트 안에서 재현된다.
 *
 * 놓치면 증상이 **낡은 목록 하나**뿐이라 에러도 경고도 안 난다. 실제로 워크스페이스 단위
 * 조회를 더하면서 할 일 쪽만 고치고 노트 쪽을 빠뜨렸고, 사람이 눈으로 볼 때까지 안 잡혔다.
 */
describe("목록 무효화 판정", () => {
  it("노트 목록 둘을 다 잡는다", () => {
    expect(isNoteListQueryKey(getGetNotesQueryKey("01K0000000001"))).toBe(true);
    expect(isNoteListQueryKey(getGetWorkspaceNotesQueryKey("01K0000000000"))).toBe(true);
  });

  it("할 일 목록 둘을 다 잡는다", () => {
    expect(
      isProjectTaskQueryKey(getGetProjectTasksQueryKey("01K0000000000", "01K0000000001"))
    ).toBe(true);
    expect(isProjectTaskQueryKey(getGetWorkspaceTasksQueryKey("01K0000000000"))).toBe(true);
  });

  /** 넓히다가 남의 캐시까지 비우면 폴링이 늘어난다. 경계도 같이 못박는다. */
  it("노트 하나와 전사는 목록이 아니다", () => {
    expect(isNoteListQueryKey(["/v1/notes/01K0000000002"])).toBe(false);
    expect(isNoteListQueryKey(["/v1/notes/01K0000000002/transcript"])).toBe(false);
    expect(isNoteListQueryKey(["/v1/workspaces/01K0000000000/guests"])).toBe(false);
  });
});
