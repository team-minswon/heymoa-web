import { describe, expect, it } from "vitest";

import {
  getGetNotesQueryKey,
  getGetWorkspaceNotesQueryKey,
} from "@/lib/api/generated/notes/notes";
import {
  getGetProjectTasksQueryKey,
  getGetWorkspaceTasksQueryKey,
} from "@/lib/api/generated/projects/projects";
import {
  getGetMeetingReviewQueryKey,
  getGetMeetingReviewSummaryQueryKey,
} from "@/lib/api/generated/meeting-review/meeting-review";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import {
  isNoteListQueryKey,
  isSpeakerAssigneeQueryKey,
} from "@/lib/notes/query-keys";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

describe("목록 무효화 판정", () => {
  it("노트 목록 둘을 다 잡는다", () => {
    expect(isNoteListQueryKey(getGetNotesQueryKey("01K0000000001"))).toBe(true);
    expect(
      isNoteListQueryKey(getGetWorkspaceNotesQueryKey("01K0000000000"))
    ).toBe(true);
  });

  it("할 일 목록 둘을 다 잡는다", () => {
    expect(
      isProjectTaskQueryKey(
        getGetProjectTasksQueryKey("01K0000000000", "01K0000000001")
      )
    ).toBe(true);
    expect(
      isProjectTaskQueryKey(getGetWorkspaceTasksQueryKey("01K0000000000"))
    ).toBe(true);
  });

  it("노트 하나와 전사는 목록이 아니다", () => {
    expect(isNoteListQueryKey(["/v1/notes/01K0000000002"])).toBe(false);
    expect(isNoteListQueryKey(["/v1/notes/01K0000000002/transcript"])).toBe(
      false
    );
    expect(isNoteListQueryKey(["/v1/workspaces/01K0000000000/guests"])).toBe(
      false
    );
  });
});

describe("화자 지정 뒤 다시 읽을 것", () => {
  it("그 회의의 검토본과 할 일 목록을 잡는다", () => {
    expect(
      isSpeakerAssigneeQueryKey("n1", getGetMeetingReviewQueryKey("n1"))
    ).toBe(true);
    expect(
      isSpeakerAssigneeQueryKey("n1", getGetProjectTasksQueryKey("w1", "p1"))
    ).toBe(true);
    expect(
      isSpeakerAssigneeQueryKey("n1", getGetWorkspaceTasksQueryKey("w1"))
    ).toBe(true);
  });

  it("남의 검토본과 담당이 없는 요약 서술은 건드리지 않는다", () => {
    expect(
      isSpeakerAssigneeQueryKey("n1", getGetMeetingReviewQueryKey("n2"))
    ).toBe(false);
    expect(
      isSpeakerAssigneeQueryKey("n1", getGetMeetingReviewSummaryQueryKey("n1"))
    ).toBe(false);
    expect(
      isSpeakerAssigneeQueryKey("n1", getGetNoteTranscriptQueryKey("n1"))
    ).toBe(false);
  });
});
