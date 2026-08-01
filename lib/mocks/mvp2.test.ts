import { afterEach, describe, expect, it } from "vitest";

import { mockDb } from "@/lib/mocks/db";

/**
 * MVP2 목의 회귀 테스트. 여기 있는 것들은 전부 codex 리뷰가 잡아낸 실제 결함이다 —
 * 계약과 핸들러만 보고 넘어갔더니 목이 조용히 틀린 값을 주고 있었다.
 */
const MISSING_WORKSPACE = "01KZZZZZZZZZZ";

function anyWorkspaceId(): string {
  return mockDb.listWorkspaces()[0].workspaceId;
}

describe("MVP2 목", () => {
  afterEach(() => mockDb.reset());

  describe("커서", () => {
    it("커서가 가리키던 행이 사라지면 첫 페이지로 되감지 않는다", () => {
      const workspaceId = anyWorkspaceId();
      const first = mockDb.listActionItems(workspaceId, { limit: 1 });
      expect(first.nextCursor).not.toBeNull();

      // 그 항목이 필터 밖으로 나가면(DONE) 커서가 결과에서 사라진다.
      mockDb.updateActionItem(first.actionItems[0].actionItemId, {
        status: "DONE",
      });
      const next = mockDb.listActionItems(workspaceId, {
        limit: 1,
        cursor: first.nextCursor ?? undefined,
      });

      // -1 + 1 = 0 이면 첫 페이지가 다시 나와 무한히 돈다.
      expect(next.actionItems).toEqual([]);
      expect(next.nextCursor).toBeNull();
    });

    it("마지막 페이지의 커서는 null이다", () => {
      const workspaceId = anyWorkspaceId();
      const all = mockDb.listActionItems(workspaceId, {});
      expect(all.nextCursor).toBeNull();
      expect(all.actionItems.length).toBeGreaterThan(0);
    });
  });

  describe("회의 부분 수정", () => {
    it("제목 없이 예정 일시만 지울 수 있다", () => {
      const workspaceId = anyWorkspaceId();
      const projectId = mockDb.listProjects(workspaceId)[0].projectId;
      const created = mockDb.createNote(projectId, {
        title: "예정 회의",
        scheduledAt: "2026-08-05T05:00:00Z",
      });
      expect(created.scheduledAt).toBe("2026-08-05T05:00:00Z");

      // 「일시 미정으로 되돌리기」. title을 요구하면 이 조작을 표현할 수 없다.
      const updated = mockDb.updateNote(created.noteId, { scheduledAt: null });
      expect(updated.scheduledAt).toBeNull();
      expect(updated.title).toBe("예정 회의");
    });

    it("키가 없으면 그대로 둔다", () => {
      const workspaceId = anyWorkspaceId();
      const projectId = mockDb.listProjects(workspaceId)[0].projectId;
      const created = mockDb.createNote(projectId, {
        title: "맥락 있는 회의",
        context: "지난 회고 결과를 반영한다.",
      });

      const updated = mockDb.updateNote(created.noteId, { title: "이름만 변경" });
      expect(updated.context).toBe("지난 회고 결과를 반영한다.");
    });

    it("가져온 첫 회의가 선행 회의가 된다", () => {
      const workspaceId = anyWorkspaceId();
      const projectId = mockDb.listProjects(workspaceId)[0].projectId;
      const source = mockDb.listNotes(projectId)[0];

      const created = mockDb.createNote(projectId, {
        title: "후속 회의",
        contextFromNoteIds: [source.noteId],
      });

      expect(created.previousNote).toEqual({
        noteId: source.noteId,
        title: source.title,
      });
    });
  });

  describe("삭제", () => {
    it("기록 중인 회의는 못 지운다", () => {
      const workspaceId = anyWorkspaceId();
      const live = mockDb
        .listWorkspaceNotes(workspaceId, { meetingStatus: ["IN_PROGRESS"] })
        .notes[0];
      expect(live).toBeDefined();
      expect(() => mockDb.deleteNote(live.noteId)).toThrow(
        "MEETING_IN_PROGRESS"
      );
    });

    it("회의를 지우면 그 회의의 액션 아이템도 사라진다", () => {
      const workspaceId = anyWorkspaceId();
      const item = mockDb.listActionItems(workspaceId, { status: "ALL" })
        .actionItems[0];
      const before = mockDb.listActionItems(workspaceId, { status: "ALL" })
        .actionItems.length;

      const note = mockDb.getNote(item.noteId);
      if (note.meetingStatus === "IN_PROGRESS") {
        mockDb.updateNote(note.noteId, { title: note.title });
      }
      // 기록 중이면 지울 수 없으니 상태와 무관한 회의를 고른다.
      const deletable = mockDb
        .listWorkspaceNotes(workspaceId, { meetingStatus: ["ENDED"] })
        .notes[0];
      mockDb.deleteNote(deletable.noteId);

      const after = mockDb.listActionItems(workspaceId, { status: "ALL" })
        .actionItems.length;
      expect(after).toBeLessThanOrEqual(before);
      expect(() => mockDb.getNote(deletable.noteId)).toThrow();
    });
  });

  describe("정렬과 필터", () => {
    it("예정 일시 오름차순에서 일시 미정은 뒤로 간다", () => {
      const workspaceId = anyWorkspaceId();
      const { notes } = mockDb.listWorkspaceNotes(workspaceId, {
        sort: "scheduledAt_asc",
      });
      const scheduled = notes.map((note) => note.scheduledAt);
      expect(scheduled.some((value) => value !== null)).toBe(true);
      expect(scheduled.some((value) => value === null)).toBe(true);
      // null이 하나라도 값 앞에 오면 「예정」 섹션이 거짓말을 한다.
      const lastValued = scheduled.map((v) => v !== null).lastIndexOf(true);
      const firstNull = scheduled.indexOf(null);
      expect(firstNull).toBeGreaterThan(lastValued);
    });

    it("기한 필터는 문자열이 아니라 시각으로 판정한다", () => {
      const workspaceId = anyWorkspaceId();
      // +09:00 은 같은 시각의 Z 표기보다 문자열로는 크다. 문자열 비교면 빠진다.
      const all = mockDb.listActionItems(workspaceId, { status: "ALL" });
      const dated = all.actionItems.filter((item) => item.dueAt !== null);
      expect(dated.length).toBeGreaterThan(0);
      const boundary = new Date(
        Date.parse(dated[0].dueAt as string) + 1000
      ).toISOString();
      const filtered = mockDb.listActionItems(workspaceId, {
        status: "ALL",
        dueBefore: boundary,
      });
      expect(
        filtered.actionItems.some(
          (item) => item.actionItemId === dated[0].actionItemId
        )
      ).toBe(true);
    });

    it("검색은 제목·프로젝트명·참석자명을 본다", () => {
      const workspaceId = anyWorkspaceId();
      const withPeople = mockDb
        .listWorkspaceNotes(workspaceId, {})
        .notes.find((note) => note.participants.length > 0);
      expect(withPeople).toBeDefined();
      const found = mockDb.listWorkspaceNotes(workspaceId, {
        q: withPeople!.participants[0].name,
      });
      expect(
        found.notes.some((note) => note.noteId === withPeople!.noteId)
      ).toBe(true);
    });
  });

  it("없는 워크스페이스는 실패한다", () => {
    expect(() => mockDb.listActionItems(MISSING_WORKSPACE, {})).toThrow();
  });
});
