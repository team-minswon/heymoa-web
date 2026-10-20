import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { workspaceOfProject } from "@/lib/mocks/assignees";
import { mockDb } from "@/lib/mocks/db";
import { MENTORING_GUEST_IDS, MENTORING_NOTE_ID } from "@/lib/mocks/fixtures/mentoring-note";
import { LARGE_REVIEW_NOTE_ID, MOCK_STEP_MS, meetingFlow, meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { projectTaskHandlers, projectTasks } from "@/lib/mocks/project-tasks";
import type { MeetingReviewResponseData, UpdateMeetingReviewItemRequest } from "@/lib/api/generated/models";

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

async function chooseTask(decision: "APPLY" | "KEEP" | "APPLIED" | null, draft?: NonNullable<UpdateMeetingReviewItemRequest["decisions"]>[number]["taskChange"], at = 0) {
  const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
  const item = current.items.filter((row) => row.taskChanges.length > 0)[at];
  return api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${item.itemId}`, "PATCH", {
    expectedReviewVersion: current.reviewVersion, expectedItemRevision: item.revision,
    projectSelected: true,
    decisions: [{ targetId: item.taskChanges[0].target.itemId, decision, ...(draft ? { taskChange: draft } : {}) }],
  });
}

async function approveCurrent() {
  const current = await review(MENTORING_NOTE_ID);
  return api(`/v1/notes/${MENTORING_NOTE_ID}/approval`, "POST", {
    requestId: "01K0000000099", reviewId: current.reviewId, reviewRevision: current.reviewVersion, projectSelectionConfirmed: true,
  });
}

describe("기존 할 일의 검토 초안", () => {
  it.each(["END", "APPLY"] as const)("사라진 %s 선택은 409로 막고 null 해제 후 승인한다", async (decision) => {
    let current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const item = current.items.find((row) => decision === "END" ? row.replacements.length : row.taskChanges.length)!;
    const target = decision === "END" ? item.replacements[0].target : item.taskChanges[0].target;
    const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${item.itemId}`;
    const chosen = await api(path, "PATCH", {
      expectedReviewVersion: current.reviewVersion, expectedItemRevision: item.revision,
      projectSelected: true,
      decisions: [{ targetId: target.itemId, decision, ...(decision === "APPLY" ? { taskChange: { expectedRevision: target.revision, due: { value: "2026-12-05" } } } : {}) }],
    });
    expect(chosen.status).toBe(200);
    meetingFlow.clearSuggestions(MENTORING_NOTE_ID);
    current = await review(MENTORING_NOTE_ID);
    const missing = current.items.find((row) => row.itemId === item.itemId)!;
    expect(missing.replacements).toEqual([]);
    expect(missing.taskChanges).toEqual([]);
    expect(missing.decisions).toEqual([expect.objectContaining({ targetId: target.itemId, decision })]);
    const before = (await api(tasksPath())).body.data;
    expect((await approveCurrent()).status).toBe(409);
    expect((await api(tasksPath())).body.data).toEqual(before);
    const cleared = await api(path, "PATCH", {
      expectedReviewVersion: current.reviewVersion, expectedItemRevision: missing.revision,
      decisions: [{ targetId: target.itemId, decision: null }],
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.items.find((row: { itemId: string }) => row.itemId === item.itemId).decisions).toEqual([]);
    expect((await api(tasksPath())).body.data).toEqual(before);
    expect((await approveCurrent()).status).toBe(200);
  });

  it("제안이 사라져도 APPLIED 이력은 조회되고 null 해제가 거절된다", async () => {
    expect((await chooseTask("APPLIED")).status).toBe(200);
    meetingFlow.clearSuggestions(MENTORING_NOTE_ID);
    const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const item = current.items.find((row) => row.decisions.some((choice) => choice.decision === "APPLIED"))!;
    const choice = item.decisions.find((row) => row.decision === "APPLIED")!;
    const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${item.itemId}`;
    const result = await api(path, "PATCH", {
      expectedReviewVersion: current.reviewVersion, expectedItemRevision: item.revision,
      projectSelected: true,
      decisions: [{ targetId: choice.targetId, decision: null }],
    });
    expect(result.status).toBe(400);
    expect(await review(MENTORING_NOTE_ID)).toEqual(current);
  });

  it("APPLY·KEEP를 바꾸고 재조회해도 편집값을 보존하며 실제 업무는 건드리지 않는다", async () => {
    const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const change = current.items.find((row) => row.taskChanges.length > 0)!.taskChanges[0];
    const before = (await api(tasksPath())).body.data;
    const draft = { expectedRevision: change.target.revision, status: null, assignee: { value: null }, due: { value: "2026-12-05" } };
    expect((await chooseTask("APPLY", draft)).status).toBe(200);
    expect((await chooseTask("KEEP")).status).toBe(200);
    const kept: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    expect(kept.items.flatMap((row) => row.taskChanges).find((row) => row.target.itemId === change.target.itemId)).toMatchObject({ decision: "KEEP", draft });
    expect(kept.items.flatMap((row) => row.decisions).find((row) => row.targetId === change.target.itemId)).toEqual({ targetId: change.target.itemId, decision: "KEEP", taskChange: draft });
    expect((await api(tasksPath())).body.data).toEqual(before);
    expect((await chooseTask("APPLY", draft)).status).toBe(200);
    expect((await api(tasksPath())).body.data).toEqual(before);
    expect((await chooseTask(null)).status).toBe(200);
    const cleared: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    expect(cleared.items.flatMap((row) => row.taskChanges).find((row) => row.target.itemId === change.target.itemId)).toMatchObject({ decision: null, draft: null });
    expect(cleared.items.flatMap((row) => row.decisions).some((row) => row.targetId === change.target.itemId)).toBe(false);
  });

  it("초안 없는 APPLY와 다른 기대 판을 거절하고 APPLIED 이력의 선택을 잠근다", async () => {
    expect((await chooseTask("APPLY")).status).toBe(400);
    expect((await chooseTask("APPLY", { expectedRevision: 999, due: { value: null } })).status).toBe(400);
    expect((await chooseTask("APPLIED")).status).toBe(200);
    expect((await chooseTask("KEEP")).status).toBe(400);
  });

  it("확정에서만 초안을 적용하고 같은 요청을 재전송해도 업무 이력이 더 늘지 않는다", async () => {
    const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const change = current.items.find((row) => row.taskChanges.length > 0)!.taskChanges[0];
    const draft = { expectedRevision: change.target.revision, status: "COMPLETED" as const, assignee: { value: null }, due: { value: "2026-12-05" } };
    expect((await chooseTask("APPLY", draft)).status).toBe(200);
    const approved = await approveCurrent();
    expect(approved.status).toBe(200);
    const after = (await api(tasksPath())).body.data.tasks;
    expect(after.find((row: { taskId: string }) => row.taskId === change.target.itemId)).toMatchObject({ taskStatus: "COMPLETED", due: "2026-12-05", assignee: null, revision: change.target.revision + 1 });
    const history = (await api(`${tasksPath()}/${change.target.itemId}/revisions`)).body.data.revisions;
    expect(history.at(-1).approvalId).not.toBeNull();
    expect((await approveCurrent()).body.data).toEqual(approved.body.data);
    expect((await api(`${tasksPath()}/${change.target.itemId}/revisions`)).body.data.revisions).toEqual(history);
  });

  it("업무 판이 다르면 새 업무 생성과 다른 변경도 남기지 않고 확정 전체를 거절한다", async () => {
    const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const changes = current.items.filter((row) => row.taskChanges.length > 0).map((row) => row.taskChanges[0]);
    for (const [at, change] of changes.entries()) {
      expect((await chooseTask("APPLY", { expectedRevision: change.target.revision, due: { value: "2026-12-05" } }, at)).status).toBe(200);
    }
    const tasks = (await api(tasksPath())).body.data.tasks;
    const stale = tasks.find((row: { taskId: string }) => row.taskId === changes.at(-1)!.target.itemId);
    expect((await api(`${tasksPath()}/${stale.taskId}`, "PUT", { ...stale, taskStatus: "CANCELLED" })).status).toBe(200);
    const before = (await api(tasksPath())).body.data;
    const reviewBefore = await review(MENTORING_NOTE_ID);
    expect((await approveCurrent()).status).toBe(409);
    expect((await api(tasksPath())).body.data).toEqual(before);
    expect(await review(MENTORING_NOTE_ID)).toEqual(reviewBefore);
    expect(await flow(MENTORING_NOTE_ID)).toBe("REVIEWABLE");
  });
});

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

  it("다시 요청은 시작자가 아니어도 실패 · 요청 전 상태에서 받는다", async () => {
    expect((await api("/v1/notes/01K0000000023/analyses", "POST")).status).toBe(202);
    expect((await api(`/v1/notes/${MENTORING_NOTE_ID}/analyses`, "POST")).body.error.code).toBe(
      "MEETING_ANALYSIS_CONFLICT"
    );
    const accepted = await api("/v1/notes/01K0000000026/analyses", "POST");
    expect(accepted.status).toBe(202);
    expect(accepted.body.data.flowStatus).toBe("ANALYZING");
    expect(accepted.body.data.requestId).toHaveLength(13);
    expect(await flow("01K0000000026")).toBe("ANALYZING");
  });

  it("회의 종료를 알리면 분석이 시작된다", async () => {
    meetingFlow.onMeetingEnded("01K0000000027");
    expect(await flow("01K0000000027")).toBe("ANALYZING");
  });
});

describe("요약", () => {
  it.each([MENTORING_NOTE_ID, LARGE_REVIEW_NOTE_ID])("소속 응답은 주 소속과 보조 소속을 구분한다: %s", (noteId) => {
    const summary = meetingFlow.summaryOf(noteId);
    expect(summary.agendas.flatMap((topic) => topic.memberships).some((member) => member.secondary)).toBe(true);
    for (const topic of summary.agendas) {
      expect(topic.memberships.filter((member) => !member.secondary).map((member) => member.itemId))
        .toEqual(topic.members.map((member) => member.itemId));
      expect(topic.memberships.filter((member) => member.secondary).map((member) => member.itemId))
        .toEqual(topic.alsoItemIds);
    }
  });

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
  it("시작자가 아니어도 편집하고, 할 일이 아닌 항목의 담당과 빈 내용은 400 이다", async () => {
    const other = await review("01K0000000021");
    expect(
      (await api("/v1/notes/01K0000000021/meeting-review/items", "POST", {
        expectedReviewVersion: other.reviewVersion,
        kind: "DECISION",
        content: "x",
      })).status
    ).toBe(201);

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

  it("topicOrdinal 이 있으면 그 주제 members 에 합치고, 요약에 없는 번호는 400 으로 저장하지 않는다", async () => {
    const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items`;
    const summaryPath = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/summary`;
    const before = (await api(summaryPath)).body.data.topics[1].members.length;
    const current = await review(MENTORING_NOTE_ID);

    const bad = await api(path, "POST", {
      expectedReviewVersion: current.reviewVersion,
      kind: "DECISION",
      content: "없는 주제",
      topicOrdinal: 999,
    });
    expect(bad.status).toBe(400);
    expect((await review(MENTORING_NOTE_ID)).items).toHaveLength(current.items.length);

    const ok = await api(path, "POST", {
      expectedReviewVersion: current.reviewVersion,
      kind: "DECISION",
      content: "둘째 주제 결정",
      topicOrdinal: 2,
    });
    expect(ok.status).toBe(201);
    const topic = (await api(summaryPath)).body.data.topics[1];
    expect(topic.members).toHaveLength(before + 1);
    expect(topic.members.at(-1)).toMatchObject({ kind: "DECISION" });
    expect(topic.memberships.at(-1)).toEqual({ itemId: topic.members.at(-1).itemId, secondary: false });
  });

  it("주제 번호가 맞아도 담당 검증이 400 이면 요약 members 를 바꾸지 않는다", async () => {
    const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items`;
    const summaryPath = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/summary`;
    const before = (await api(summaryPath)).body.data.topics[1].members.length;
    const current = await review(MENTORING_NOTE_ID);

    const bad = await api(path, "POST", {
      expectedReviewVersion: current.reviewVersion,
      kind: "ACTION_ITEM",
      content: "담당 id 가 빠진 할 일",
      topicOrdinal: 2,
      assignee: { type: "USER" },
    });
    expect(bad.status).toBe(400);
    expect((await api(summaryPath)).body.data.topics[1].members).toHaveLength(before);
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
  it("회의 시작자가 아닌 멤버도 검토본을 확정한다", async () => {
    const current = await review("01K0000000021");
    const approved = await api("/v1/notes/01K0000000021/approval", "POST", {
      requestId: "0K9GVJT2C4Q1Z",
      reviewId: current.reviewId,
      reviewRevision: current.reviewVersion,
      projectSelectionConfirmed: true,
    });
    expect(approved.status).toBe(200);
    expect(await flow("01K0000000021")).toBe("CONFIRMED");
  });

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
        projectSelected: true,
        decisions,
      });

    expect((await choose([{ targetId: "01KNOPE000000", decision: "END" }])).status).toBe(400);
    expect((await choose([{ targetId, decision: "APPLIED" }])).status).toBe(400);
    current = (await choose([{ targetId, decision: "END" }])).body.data;
    const chosen = current.items.find((item: { itemId: string }) => item.itemId === owner.itemId);
    expect(chosen.replacements[0].decision).toBe("END");

    const path = `/v1/notes/${MENTORING_NOTE_ID}/approval`;
    const body = { requestId: "0K9GVJT2C4Q1Z", reviewId: current.reviewId, reviewRevision: current.reviewVersion, projectSelectionConfirmed: true };
    expect((await api(path, "POST", { ...body, reviewId: "01KNOPE000000" })).status).toBe(400);
    expect((await api(path, "POST", { ...body, reviewRevision: 1 })).body.error.code).toBe(
      "PROJECT_KNOWLEDGE_CONFLICT"
    );

    const before = (await api(tasksPath())).body.data.tasks.length;
    const approved = await api(path, "POST", body);
    expect(approved.status).toBe(200);
    expect(await flow(MENTORING_NOTE_ID)).toBe("CONFIRMED");
    const promoted = current.items.filter(
      (item: { kind: string; included: boolean; projectSelected: boolean }) => item.kind === "ACTION_ITEM" && item.included && item.projectSelected
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

describe("노트 안건", () => {
  it("안건 정본은 조회만 있고, 끝난 회의는 검토 요약의 주제를 안건으로 돌려준다", async () => {
    const empty = (await api("/v1/notes/01K0000000002/agendas")).body.data;
    expect(empty).toEqual({ asOfSequence: null, agendas: [] });

    const mentoring = (await api(`/v1/notes/${MENTORING_NOTE_ID}/agendas`)).body.data;
    expect(mentoring.asOfSequence).toEqual(expect.any(Number));
    expect(mentoring.agendas[0]).toEqual(
      expect.objectContaining({ agendaId: expect.any(String), title: expect.any(String), completed: true, proposalIds: expect.any(Array) })
    );
  });
});

describe("회의 간 연결", () => {
  it("멘토링 노트만 지난 회의와 이어지고, 다른 노트는 비어 있다", async () => {
    const links = (await api(`/v1/projects/p/meeting-links?noteId=${MENTORING_NOTE_ID}`)).body.data;
    expect(links.notes).toHaveLength(2);
    expect(links.conflicts.map((row: { kind: string }) => row.kind)).toContain("SUPERSEDES");
    expect(links.meetingLinks.map((row: { kind: string }) => row.kind)).toEqual(expect.arrayContaining(["COMPLETES", "SUCCEEDS"]));
    expect(links.agendaLinks).toHaveLength(3);
    expect((await api("/v1/projects/p/meeting-links?noteId=01K0000000002")).body.data).toEqual({ notes: [], meetingLinks: [], conflicts: [], agendaLinks: [] });
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

describe("명시적 프로젝트 반영", () => {
  it("처음에는 모두 OFF이며 하나만 골라 승인하면 그 결정만 반영하고 회의록은 유지합니다", async () => {
    const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    expect(current.items.filter((row) => row.kind === "DECISION" || row.kind === "ACTION_ITEM").every((row) => !row.projectSelected)).toBe(true);
    const picked = current.items.find((row) => row.kind === "DECISION" && !row.replacements.length)!;
    const saved = await api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${picked.itemId}`, "PATCH", {
      expectedReviewVersion: current.reviewVersion, expectedItemRevision: picked.revision, projectSelected: true,
    });
    expect(saved.status).toBe(200);
    const before = (await api(tasksPath())).body.data.tasks.length;
    const approved = await approveCurrent();
    expect(approved.status).toBe(200);
    const approvedIds = approved.body.data.items.map((row: { review: { itemId: string } }) => row.review.itemId);
    expect(approvedIds).toContain(picked.itemId);
    expect(approvedIds.filter((id: string) => current.items.some((row) => row.itemId === id && (row.kind === "DECISION" || row.kind === "ACTION_ITEM")))).toEqual([picked.itemId]);
    expect((await api(tasksPath())).body.data.tasks.length).toBe(before);
    expect((await review(MENTORING_NOTE_ID)).items).toHaveLength(current.items.length);
  });

  it("선택 확인이 없는 이전 화면의 승인 요청은 거절합니다", async () => {
    const current = await review(MENTORING_NOTE_ID);
    expect((await api(`/v1/notes/${MENTORING_NOTE_ID}/approval`, "POST", { requestId: "old", reviewId: current.reviewId, reviewRevision: current.reviewVersion })).status).toBe(400);
    expect(await flow(MENTORING_NOTE_ID)).toBe("REVIEWABLE");
  });

  it("반영을 해제하면 저장된 대체 선택을 실행하지 않습니다", async () => {
    meetingFlow.seedApprovalCase("replace");
    const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const selected = current.items.find((row) => row.projectSelected)!;
    expect((await api(`/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${selected.itemId}`, "PATCH", { expectedReviewVersion: current.reviewVersion, expectedItemRevision: selected.revision, projectSelected: false })).status).toBe(200);
    expect((await approveCurrent()).status).toBe(200);
    const after: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    expect(after.items.find((row) => row.itemId === selected.itemId)!.replacements[0].target.endedAt).toBeNull();
  });

  it.each(["save-error", "save-conflict"] as const)("%s 이후 다시 선택할 수 있습니다", async (key) => {
    meetingFlow.seedApprovalCase(key);
    const current: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const item = current.items.find((row) => row.kind === "DECISION")!;
    const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${item.itemId}`;
    const patch = (version: number, revision: number) => api(path, "PATCH", { expectedReviewVersion: version, expectedItemRevision: revision, projectSelected: true });
    expect((await patch(current.reviewVersion, item.revision)).status).toBe(key === "save-error" ? 500 : 409);
    const latest: MeetingReviewResponseData = await review(MENTORING_NOTE_ID);
    const found = latest.items.find((row) => row.itemId === item.itemId)!;
    expect(found.projectSelected).toBe(false);
    expect((await patch(latest.reviewVersion, found.revision)).status).toBe(200);
  });
});
