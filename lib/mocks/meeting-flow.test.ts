import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { workspaceOfProject } from "@/lib/mocks/assignees";
import { mockDb } from "@/lib/mocks/db";
import { MENTORING_GUEST_IDS, MENTORING_NOTE_ID } from "@/lib/mocks/fixtures/mentoring-note";
import { MOCK_STEP_MS, meetingFlow, meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { projectTaskHandlers, projectTasks } from "@/lib/mocks/project-tasks";

/**
 * 회의 뒤 흐름 · 할 일 목이 계약대로 답하는지. 화면 테스트가 성공 경로를 밟으니 여기서는
 * 거절 경로와 상태 전이를 본다 — 목이 너그러우면 화면이 실서버에서 처음 거절을 만난다.
 */
const server = setupServer(...meetingFlowHandlers, ...projectTaskHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  mockDb.reset();
  vi.useRealTimers();
});
afterAll(() => server.close());

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`http://localhost${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  };
}

const flow = async (noteId: string) => (await api(`/v1/notes/${noteId}/analyses/flow`)).body.data.status;
const review = async (noteId: string) => (await api(`/v1/notes/${noteId}/meeting-review`)).body.data;
const tasksPath = () => {
  const projectId = mockDb.getNote(MENTORING_NOTE_ID).projectId;
  return `/v1/workspaces/${workspaceOfProject(projectId)}/projects/${projectId}/tasks`;
};

describe("흐름 상태", () => {
  it("화자 분리와 분석은 시간이 지나면 다음 단계로 넘어가 검토본이 선다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    expect(await flow("01K0000000025")).toBe("DIARIZING");

    vi.setSystemTime(Date.now() + MOCK_STEP_MS);
    expect(await flow("01K0000000025")).toBe("ANALYZING");

    vi.setSystemTime(Date.now() + MOCK_STEP_MS);
    expect(await flow("01K0000000025")).toBe("REVIEWABLE");
    expect((await review("01K0000000025")).items.length).toBeGreaterThan(0);
  });

  it("개발 화면의 진행 버튼은 도는 분석을 바로 끝낸다", async () => {
    expect(await flow("01K0000000022")).toBe("ANALYZING");
    expect((await api("/v1/notes/01K0000000022/_mock/advance-analysis", "POST")).status).toBe(204);
    expect(await flow("01K0000000022")).toBe("REVIEWABLE");
  });

  it("다시 요청은 시작자만, 실패 · 요청 전 상태에서만 받는다", async () => {
    expect((await api("/v1/notes/01K0000000023/analyses", "POST")).status).toBe(403);
    expect((await api(`/v1/notes/${MENTORING_NOTE_ID}/analyses`, "POST")).body.error.code).toBe(
      "MEETING_ANALYSIS_CONFLICT"
    );
    const accepted = await api("/v1/notes/01K0000000026/analyses", "POST");
    expect(accepted.status).toBe(202);
    expect(accepted.body.data.requestId).toHaveLength(13);
    expect(await flow("01K0000000026")).toBe("ANALYZING");
  });

  it("회의 종료를 알리면 분석이 시작된다", async () => {
    meetingFlow.onMeetingEnded("01K0000000027");
    expect(await flow("01K0000000027")).toBe("ANALYZING");
  });
});

describe("요약", () => {
  it("검토 화면이 쓰는 세 상태를 모두 낸다", async () => {
    const mentoring = (await api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/summary`)).body.data;
    expect(mentoring.status).toBe("SUCCEEDED");
    expect(mentoring.topics).toHaveLength(8);
    expect((await api("/v1/notes/01K0000000021/meeting-review/summary")).body.data.status).toBe("FAILED");
    expect((await api("/v1/notes/01K0000000026/meeting-review/summary")).body.data.status).toBe("NOT_AVAILABLE");
    expect((await api("/v1/notes/01KNOPE0000000/meeting-review/summary")).status).toBe(404);
  });

  it("주제의 모든 항목 ID 가 검토본에 있다", async () => {
    const ids = new Set((await review(MENTORING_NOTE_ID)).items.map((item: { itemId: string }) => item.itemId));
    const summary = meetingFlow.summaryOf(MENTORING_NOTE_ID);
    expect(summary.topics.flatMap((topic) => topic.members).every((member) => ids.has(member.itemId))).toBe(true);
  });
});

describe("검토 항목 추가 · 수정", () => {
  it("시작자가 아니면 403, 할 일이 아닌 항목의 담당은 400, 빈 내용은 400 이다", async () => {
    const other = await review("01K0000000021");
    expect(
      (await api("/v1/notes/01K0000000021/meeting-review/items", "POST", {
        expectedReviewVersion: other.reviewVersion,
        kind: "DECISION",
        content: "x",
      })).status
    ).toBe(403);

    const current = await review(MENTORING_NOTE_ID);
    const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items`;
    expect(
      (await api(path, "POST", {
        expectedReviewVersion: current.reviewVersion,
        kind: "DECISION",
        content: "담당이 있는 결정",
        assignee: { type: "USER", id: mockDb.getCurrentUser().userId },
      })).status
    ).toBe(400);
    expect(
      (await api(path, "POST", { expectedReviewVersion: current.reviewVersion, kind: "ISSUE", content: "  " })).status
    ).toBe(400);
  });

  it("읽은 판이 낡으면 409, 없는 항목은 404, 같은 값은 판을 올리지 않는다", async () => {
    const current = await review(MENTORING_NOTE_ID);
    const item = current.items[0];
    const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${item.itemId}`;

    const same = await api(path, "PATCH", {
      expectedReviewVersion: current.reviewVersion,
      expectedItemRevision: item.revision,
      included: item.included,
    });
    expect(same.body.data.reviewVersion).toBe(current.reviewVersion);

    expect(
      (await api(path, "PATCH", {
        expectedReviewVersion: current.reviewVersion - 1,
        expectedItemRevision: item.revision,
        included: false,
      })).body.error.code
    ).toBe("MEETING_REVIEW_CONFLICT");
    expect(
      (await api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/01KNOPE000000`, "PATCH", {
        expectedReviewVersion: current.reviewVersion,
        expectedItemRevision: 1,
        included: false,
      })).status
    ).toBe(404);
  });

  it("담당은 화자 라벨로 저장해도 한 사람이면 그 사람으로 풀린다", async () => {
    const current = await review(MENTORING_NOTE_ID);
    const action = current.items.find((item: { kind: string }) => item.kind === "ACTION_ITEM");
    const saved = await api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${action.itemId}`, "PATCH", {
      expectedReviewVersion: current.reviewVersion,
      expectedItemRevision: action.revision,
      assignee: { type: "SPEAKER_LABEL", label: "A" },
      due: null,
    });
    const updated = saved.body.data.items.find((item: { itemId: string }) => item.itemId === action.itemId);
    expect(updated.assignee).toEqual({ type: "GUEST", id: MENTORING_GUEST_IDS.hanJiwon, name: "한지원" });
    expect(updated.due).toBeNull();
  });

  it("이슈 · 질문은 담당 · 기한을 받고, 결정은 거절한다", async () => {
    const current = await review(MENTORING_NOTE_ID);
    const pick = (kind: string) => current.items.find((item: { kind: string }) => item.kind === kind);
    const setDue = (row: { itemId: string; revision: number }) =>
      api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${row.itemId}`, "PATCH", {
        expectedReviewVersion: current.reviewVersion,
        expectedItemRevision: row.revision,
        due: "2026-09-20",
      });

    expect((await setDue(pick("DECISION"))).status).toBe(400);
    const saved = await setDue(pick("QUESTION"));
    expect(saved.status).toBe(200);
    expect(saved.body.data.items.find((item: { itemId: string }) => item.itemId === pick("QUESTION").itemId).due).toBe(
      "2026-09-20"
    );
  });
});

describe("확정", () => {
  it("선택을 저장하고, 확정은 저장된 끝내기를 끝내며 할 일을 만들고 같은 재전송은 같은 결과로 모은다", async () => {
    let current = await review(MENTORING_NOTE_ID);
    const owner = current.items.find(
      (item: { included: boolean; replacements: unknown[] }) => item.included && item.replacements.length > 0
    );
    const targetId = owner.replacements[0].target.itemId;
    const choose = (decisions: unknown) =>
      api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${owner.itemId}`, "PATCH", {
        expectedReviewVersion: current.reviewVersion,
        expectedItemRevision: owner.revision,
        decisions,
      });

    expect((await choose([{ targetId: "01KNOPE000000", decision: "END" }])).status).toBe(400);
    expect((await choose([{ targetId, decision: "APPLIED" }])).status).toBe(400);
    current = (await choose([{ targetId, decision: "END" }])).body.data;
    const chosen = current.items.find((item: { itemId: string }) => item.itemId === owner.itemId);
    expect(chosen.replacements[0].decision).toBe("END");

    const path = `/v1/notes/${MENTORING_NOTE_ID}/approval`;
    const body = { requestId: "0K9GVJT2C4Q1Z", reviewId: current.reviewId, reviewRevision: current.reviewVersion };
    expect((await api(path, "POST", { ...body, reviewId: "01KNOPE000000" })).status).toBe(400);
    expect((await api(path, "POST", { ...body, reviewRevision: 1 })).body.error.code).toBe(
      "PROJECT_KNOWLEDGE_CONFLICT"
    );

    const before = (await api(tasksPath())).body.data.tasks.length;
    const approved = await api(path, "POST", body);
    expect(approved.status).toBe(200);
    expect(await flow(MENTORING_NOTE_ID)).toBe("CONFIRMED");
    const promoted = current.items.filter(
      (item: { kind: string; included: boolean }) => item.kind === "ACTION_ITEM" && item.included
    ).length;
    expect((await api(tasksPath())).body.data.tasks.length).toBe(before + promoted);
    const confirmed = (await review(MENTORING_NOTE_ID)).items.find(
      (item: { itemId: string }) => item.itemId === owner.itemId
    );
    expect(confirmed.replacements[0].target.endedAt).not.toBeNull();

    expect((await api(path, "POST", body)).body).toEqual(approved.body);
    expect((await api(path, "POST", { ...body, reviewRevision: current.reviewVersion + 1 })).status).toBe(409);
  });
});

describe("사전 안건", () => {
  it("목록 · 추가 · 고치기 · 지우기를 계약대로 답한다", async () => {
    expect((await api("/v1/notes/01K0000000002/agendas")).body.data.agendas).toHaveLength(1);
    const created = await api("/v1/notes/01K0000000002/agendas", "POST", { content: "배포 일정 확인" });
    expect(created.status).toBe(201);
    const agendaId = created.body.data.agendaId;

    expect((await api(`/v1/notes/01K0000000002/agendas/${agendaId}`, "PUT", { content: "배포 일정 다시 확인" })).body.data.content).toBe(
      "배포 일정 다시 확인"
    );
    expect((await api("/v1/notes/01K0000000002/agendas/01KNOPE000000", "PUT", { content: "x" })).status).toBe(404);
    expect((await api(`/v1/notes/01K0000000002/agendas/${agendaId}`, "DELETE")).status).toBe(204);
    expect((await api(`/v1/notes/${MENTORING_NOTE_ID}/agendas`, "POST", { content: "끝난 회의" })).status).toBe(409);
  });
});

describe("할 일", () => {
  it("사람만 담당으로 만들고, 빈 내용은 거절한다", async () => {
    const me = mockDb.getCurrentUser().userId;
    const created = await api(tasksPath(), "POST", { content: "회고 일정을 잡는다", assignee: { type: "USER", id: me }, due: "2026-10-01" });
    expect(created.status).toBe(201);
    expect(created.body.data.assignee).toMatchObject({ type: "USER", id: me });
    expect((await api(tasksPath(), "POST", { content: "x", assignee: { type: "SPEAKER_LABEL", label: "A" } })).status).toBe(400);
    expect((await api(tasksPath(), "POST", { content: " " })).status).toBe(400);
  });

  it("낡은 판은 409, 같은 값은 판을 올리지 않고, 바꾸면 바꾼 사람과 함께 이력이 남는다", async () => {
    const taskId = projectTasks.idOf("pricing-table");
    const current = (await api(tasksPath())).body.data.tasks.find((task: { taskId: string }) => task.taskId === taskId);
    const base = {
      content: current.content,
      taskStatus: current.taskStatus,
      assignee: { type: current.assignee.type, id: current.assignee.id },
      due: current.due,
    };

    expect((await api(`${tasksPath()}/${taskId}`, "PUT", { ...base, revision: current.revision + 1 })).status).toBe(409);
    expect((await api(`${tasksPath()}/${taskId}`, "PUT", { ...base, revision: current.revision })).body.data.revision).toBe(
      current.revision
    );

    const changed = await api(`${tasksPath()}/${taskId}`, "PUT", { ...base, taskStatus: "COMPLETED", revision: current.revision });
    expect(changed.body.data.revision).toBe(current.revision + 1);
    const history = (await api(`${tasksPath()}/${taskId}/revisions`)).body.data.revisions;
    expect(history.at(-1)).toMatchObject({ taskStatus: "COMPLETED", changedBy: mockDb.getCurrentUser().userId, approvalId: null });
    expect(history[0]).toMatchObject({ changedBy: null });
    expect((await api(`${tasksPath()}/01KNOPE000000/revisions`)).status).toBe(404);
  });

  it("한 사람으로 풀리지 않는 화자는 라벨로 남는다", async () => {
    const task = (await api(tasksPath())).body.data.tasks.find((row: { taskId: string }) => row.taskId === projectTasks.idOf("stt-cost"));
    expect(task.assignee).toEqual({ type: "SPEAKER_LABEL", noteId: MENTORING_NOTE_ID, label: "F" });
  });

  it("다른 워크스페이스의 프로젝트로는 읽을 수 없다", async () => {
    const projectId = mockDb.getNote(MENTORING_NOTE_ID).projectId;
    expect((await api(`/v1/workspaces/01KNOPE000000/projects/${projectId}/tasks`)).status).toBe(404);
  });
});
