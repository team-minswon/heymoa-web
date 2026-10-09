import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { mockDb } from "@/lib/mocks/db";
import { projectTaskHandlers } from "@/lib/mocks/project-tasks";

const server = setupServer(...projectTaskHandlers);
const WORKSPACE = "01K0000000000";

type Page = {
  tasks: Array<{ taskId: string; due: string | null; taskStatus: string; assignee: { id?: string } | null }>;
  totalCount: number;
  counts: { open: number; completed: number; cancelled: number };
  hasMore: boolean;
  nextDue: string | null;
  nextTaskId: string | null;
};

async function get(query: string): Promise<Page> {
  const response = await fetch(`http://localhost/v1/workspaces/${WORKSPACE}/tasks${query}`);
  return (await response.json()).data;
}

/** 목이 서버의 쪽 끊기 규칙을 따르는지 — 화면 시험이 믿는 전제라 여기서 못 박는다. */
describe("워크스페이스 할 일 목", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("쪽 크기가 없으면 전건이고 hasMore 는 거짓이다", async () => {
    const all = await get("");
    expect(all.hasMore).toBe(false);
    expect(all.tasks.length).toBe(all.counts.open + all.counts.completed + all.counts.cancelled);
    expect(all.totalCount).toBe(all.tasks.length);
  });

  it("커서로 이어 읽은 것이 한 번에 읽은 것과 같고 기한 없는 줄이 뒤에 온다", async () => {
    const whole = await get("?status=OPEN");
    const walked: string[] = [];
    let page = await get("?status=OPEN&limit=3");
    for (;;) {
      walked.push(...page.tasks.map((task) => task.taskId));
      if (!page.hasMore) break;
      const cursor = `&afterTaskId=${page.nextTaskId}${page.nextDue ? `&afterDue=${page.nextDue}` : ""}`;
      page = await get(`?status=OPEN&limit=3${cursor}`);
    }

    expect(walked).toEqual(whole.tasks.map((task) => task.taskId));
    const dues = whole.tasks.map((task) => task.due);
    expect(dues.indexOf(null)).toBeGreaterThan(-1);
    expect(dues.slice(dues.indexOf(null)).every((due) => due === null)).toBe(true);
  });

  it("개수는 상태를 뺀 거르기 안에서 세고, 내 할 일은 푼 담당이 나인 것이다", async () => {
    const mine = await get(`?status=OPEN&assigneeUserId=${mockDb.getCurrentUser().userId}`);
    expect(mine.tasks.length).toBeGreaterThan(0);
    expect(mine.tasks.every((task) => task.assignee?.id === mockDb.getCurrentUser().userId)).toBe(true);
    expect(mine.totalCount).toBe(mine.counts.open);
    // 상태를 걸어도 다른 상태의 개수는 같은 거르기 안에서 그대로다.
    expect(mine.counts.completed).toBeGreaterThan(0);
  });
});
