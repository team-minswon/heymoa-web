import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { TaskHistorySheet } from "@/components/tasks/task-history-sheet";
import type { TaskEntry } from "@/lib/tasks/task-groups";

vi.unmock("@/lib/i18n/use-display-locale");

const HANGUL = /[가-힣]/;

const revisions = [
  {
    revision: 1,
    content: "Ship to staging",
    taskStatus: "OPEN",
    assignee: { type: "SPEAKER_LABEL", noteId: "n1", label: "C" },
    due: null,
    changedAt: "2026-09-16T05:00:00Z",
    changedBy: null,
    approvalId: "a1",
    changeSource: null,
    connection: null,
  },
  {
    revision: 2,
    content: "Ship to staging",
    taskStatus: "OPEN",
    assignee: { type: "USER", id: "u1", name: "Jane" },
    due: "2026-09-19",
    changedAt: "2026-09-17T05:00:00Z",
    changedBy: "u1",
    approvalId: null,
    changeSource: "EXTERNAL_AGENT",
    connection: { name: "Claude Code" },
  },
];

vi.mock("@/lib/api/generated/projects/projects", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useGetProjectTaskRevisions: () => ({
    isPending: false,
    data: { status: 200, data: { success: true, data: { revisions } } },
  }),
}));

describe("할 일 영어 화면", () => {
  it("이력 시트가 영어로 서고 한글이 없다", async () => {
    const client = new QueryClient();
    const Intl = intlWrapper("en");
    render(
      <QueryClientProvider client={client}>
        <Intl>
          <TaskHistorySheet
            workspaceId="w1"
            entry={
              {
                projectId: "p1",
                projectName: "Product",
                taskId: "t1",
                content: "Ship to staging",
                taskStatus: "OPEN",
                assignee: { type: "USER", id: "u1", name: "Jane" },
                due: "2026-09-19",
                revision: 2,
              } as unknown as TaskEntry
            }
            choices={[{ type: "USER", id: "u1", name: "Jane" }]}
            pending={false}
            conflict={false}
            onSave={vi.fn()}
            onOpenChange={vi.fn()}
          />
        </Intl>
      </QueryClientProvider>
    );

    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Jane's agent (Claude Code) made changes");
    expect(items[0]).toHaveTextContent(/Assignee.*Speaker C.*Jane/);
    expect(items[0]).toHaveTextContent(/Due date.*None.*Sat, September 19/);
    expect(items[1]).toHaveTextContent("Created when the meeting review was finished");
    expect(screen.getByRole("button", { name: "Revert" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel task" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(HANGUL);
  });
});
