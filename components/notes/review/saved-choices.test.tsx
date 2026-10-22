import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { getResponse, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ReviewTab } from "@/components/notes/review/review-tab";
import type {
  MeetingReviewResponseData,
  UpdateMeetingReviewItemRequest,
} from "@/lib/api/generated/models";
import { workspaceOfProject } from "@/lib/mocks/assignees";
import { mockDb } from "@/lib/mocks/db";
import { MENTORING_NOTE_ID } from "@/lib/mocks/fixtures/mentoring-note";
import { meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { projectTaskHandlers } from "@/lib/mocks/project-tasks";
import { restHandlers } from "@/lib/mocks/rest-handlers";
import { toast } from "@/lib/ui/toast";

vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { name: "김민수" } }),
}));

const server = setupServer(
  ...meetingFlowHandlers,
  ...projectTaskHandlers,
  ...restHandlers
);
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  mockDb.reset();
  vi.clearAllMocks();
});
afterAll(() => server.close());

const path = `/v1/notes/${MENTORING_NOTE_ID}/meeting-review`;
const orphanId = "0HZX2K7M9Q4AD";
const appliedId = "0HZX2K7M9Q4AE";
const envelope = (data: unknown) => ({ success: true, data, error: null });
const conflict = (code = "MEETING_REVIEW_CONFLICT") =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code, message: "검토 내용이 변경되었습니다." },
    },
    { status: 409 }
  );

async function fixture(
  decision: "END" | "APPLY" | "KEEP" | "APPLIED" | null,
  kind = "DECISION"
) {
  const response = await getResponse(
    meetingFlowHandlers,
    new Request(`http://localhost${path}`)
  );
  const review: MeetingReviewResponseData = (await response!.json()).data;
  // 현재 제안은 모두 유지로 검토를 마친 상태입니다. 복구해야 할 선택만 별도로 둡니다.
  for (const item of review.items) {
    item.projectSelected = item.included;
    for (const row of [...item.replacements, ...item.taskChanges])
      row.decision = "KEEP";
    item.decisions = [
      ...item.replacements.map((row) => ({
        targetId: row.target.itemId,
        decision: "KEEP" as const,
        taskChange: null,
      })),
      ...item.taskChanges.map((row) => ({
        targetId: row.target.itemId,
        decision: "KEEP" as const,
        taskChange: null,
      })),
    ];
  }
  const item = review.items.find((row) => row.kind === kind && row.included)!;
  const draft = {
    expectedRevision: 3,
    status: null,
    assignee: {
      value: { type: "SPEAKER_LABEL" as const, id: null, label: "A" },
    },
    due: { value: "2026-12-05" },
  };
  if (decision)
    item.decisions.push({
      targetId: orphanId,
      decision,
      taskChange: decision === "APPLY" ? draft : null,
    });
  const patches: UpdateMeetingReviewItemRequest[] = [];
  const puts = vi.fn();
  const controls = {
    patchFailure: 0,
    readFailure: false,
    conflictOnApproval: false,
    approvals: 0,
  };
  server.use(
    http.get(`*${path}`, () =>
      controls.readFailure
        ? HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "INTERNAL", message: "조회 실패" },
            },
            { status: 500 }
          )
        : HttpResponse.json(envelope(structuredClone(review)))
    ),
    http.patch(`*${path}/items/:itemId`, async ({ params, request }) => {
      const body = (await request.json()) as UpdateMeetingReviewItemRequest;
      patches.push(body);
      if (controls.patchFailure) {
        const status = controls.patchFailure;
        controls.patchFailure = 0;
        if (status === 409) {
          review.reviewVersion++;
          item.revision++;
          return conflict();
        }
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: "INTERNAL", message: "저장 실패" },
          },
          { status }
        );
      }
      const target = review.items.find((row) => row.itemId === params.itemId)!;
      expect(body.expectedReviewVersion).toBe(review.reviewVersion);
      expect(body.expectedItemRevision).toBe(target.revision);
      for (const choice of body.decisions ?? []) {
        expect(choice).toEqual({ targetId: orphanId, decision: null });
        target.decisions = target.decisions.filter(
          (row) => row.targetId !== choice.targetId
        );
      }
      target.revision++;
      review.reviewVersion++;
      return HttpResponse.json(envelope(structuredClone(review)));
    }),
    http.post("*/v1/notes/:noteId/approval", () => {
      controls.approvals++;
      if (controls.conflictOnApproval) {
        controls.conflictOnApproval = false;
        item.decisions.push({
          targetId: orphanId,
          decision: "END",
          taskChange: null,
        });
        return conflict("PROJECT_KNOWLEDGE_CONFLICT");
      }
      return HttpResponse.json(
        envelope({
          approvalVersion: 1,
          items: [],
          relationIds: [],
          evidenceIds: [],
        })
      );
    }),
    http.put(
      "*/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId",
      () => {
        puts();
        return HttpResponse.json(envelope({}));
      }
    )
  );
  const show = () => {
    const note = mockDb.getNote(MENTORING_NOTE_ID);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReviewTab
          noteId={MENTORING_NOTE_ID}
          workspaceId={workspaceOfProject(note.projectId)}
          projectId={note.projectId}
          participants={note.participants}
          isEnded
          onEvidenceSelect={() => {}}
          onOpenTranscript={() => {}}
        />
      </QueryClientProvider>
    );
    return client;
  };
  const box = async () =>
    (await screen.findByRole("button", { name: item.content })).closest(
      "[data-item-id]"
    ) as HTMLElement;
  return { review, item, draft, patches, puts, controls, show, box };
}

async function approve() {
  fireEvent.click(screen.getByRole("button", { name: "검토 완료" }));
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "검토 완료",
    })
  );
}

describe("현재 제안에서 사라진 저장 선택", () => {
  it.each(["END", "APPLY"] as const)(
    "fresh GET의 %s를 해제하고 재접속해도 다른 선택과 초안은 보존한다",
    async (decision) => {
      const f = await fixture(decision);
      const other = f.review.items.find((row) => row.itemId !== f.item.itemId)!;
      // 같은 대상이어도 다른 항목의 선택은 해제하지 않습니다.
      other.included = false;
      other.decisions.push({
        targetId: orphanId,
        decision: "APPLY",
        taskChange: f.draft,
      });
      const others = structuredClone(
        f.review.items.filter((row) => row.itemId !== f.item.itemId)
      );
      f.show();
      const box = await f.box();
      expect(
        await within(box).findByRole("button", { name: /선택 해제/ })
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();
      fireEvent.click(within(box).getByRole("button", { name: /선택 해제/ }));
      await waitFor(() =>
        expect(
          within(box).queryByRole("button", { name: /선택 해제/ })
        ).toBeNull()
      );
      expect(f.patches).toHaveLength(1);
      expect(f.patches[0].decisions).toEqual([
        { targetId: orphanId, decision: null },
      ]);
      expect(
        f.review.items.filter((row) => row.itemId !== f.item.itemId)
      ).toEqual(others);
      cleanup();
      f.show();
      const refreshed = await f.box();
      expect(
        within(refreshed).queryByRole("button", { name: /선택 해제/ })
      ).toBeNull();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
      );
      await approve();
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("검토를 완료했습니다")
      );
      expect(f.puts).not.toHaveBeenCalled();
    }
  );

  it("KEEP은 해제할 수 있고 APPLIED 이력은 버튼 없이 유지한다", async () => {
    const f = await fixture("KEEP");
    f.item.decisions.push({
      targetId: appliedId,
      decision: "APPLIED",
      taskChange: f.draft,
    });
    f.show();
    const box = await f.box();
    expect(
      await within(box).findByText("이전 분석의 선택 · 반영됨")
    ).toBeInTheDocument();
    expect(
      within(box).getAllByRole("button", { name: /선택 해제/ })
    ).toHaveLength(1);
    fireEvent.click(within(box).getByRole("button", { name: /선택 해제/ }));
    await waitFor(() => expect(f.patches).toHaveLength(1));
    expect(f.item.decisions.find((row) => row.targetId === appliedId)).toEqual({
      targetId: appliedId,
      decision: "APPLIED",
      taskChange: f.draft,
    });
    expect(f.puts).not.toHaveBeenCalled();
  });

  it("실패한 선택 해제는 화면에 남고 다시 저장할 수 있다", async () => {
    const f = await fixture("END");
    f.controls.patchFailure = 500;
    f.show();
    const box = await f.box();
    const clear = await within(box).findByRole("button", { name: /선택 해제/ });
    fireEvent.click(clear);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("저장 실패"));
    expect(clear).toBeInTheDocument();
    expect(clear).toBeEnabled();
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();
    fireEvent.click(clear);
    await waitFor(() =>
      expect(
        within(box).queryByRole("button", { name: /선택 해제/ })
      ).toBeNull()
    );
    expect(f.puts).not.toHaveBeenCalled();
  });

  it("해제 PATCH의 409 뒤 새 판을 읽어 재시도한다", async () => {
    const f = await fixture("END");
    f.controls.patchFailure = 409;
    f.show();
    const box = await f.box();
    const version = f.review.reviewVersion;
    fireEvent.click(
      await within(box).findByRole("button", { name: /선택 해제/ })
    );
    expect(
      await within(box).findByText(/최신 내용을 불러왔습니다/)
    ).toBeInTheDocument();
    fireEvent.click(within(box).getByRole("button", { name: /선택 해제/ }));
    await waitFor(() => expect(f.patches).toHaveLength(2));
    expect(f.patches[1].expectedReviewVersion).toBe(version + 1);
    await waitFor(() =>
      expect(
        within(box).queryByRole("button", { name: /선택 해제/ })
      ).toBeNull()
    );
  });

  it("승인 409 재조회에서 사라진 선택을 복원하고 해제한 뒤 승인한다", async () => {
    const f = await fixture(null);
    f.controls.conflictOnApproval = true;
    f.show();
    await f.box();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );
    await approve();
    const dialog = await screen.findByRole("alertdialog");
    expect(
      await within(dialog).findByText("이전 분석의 선택을 해제해 주세요")
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    fireEvent.click(
      within(await f.box()).getByRole("button", { name: /선택 해제/ })
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );
    await approve();
    await waitFor(() => expect(f.controls.approvals).toBe(2));
    expect(f.puts).not.toHaveBeenCalled();
  });

  it("409 뒤 GET 실패는 빈 제안으로 처리하지 않고 재조회 후 복구한다", async () => {
    const f = await fixture(null);
    f.controls.conflictOnApproval = true;
    f.show();
    await f.box();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );
    f.controls.readFailure = true;
    await approve();
    const dialog = await screen.findByRole("alertdialog");
    expect(
      await within(dialog).findByText("최신 검토본을 다시 확인해 주세요")
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(
      screen.getByText("최신 검토본을 불러오지 못했습니다.")
    ).toBeInTheDocument();
    f.controls.readFailure = false;
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(
      await within(await f.box()).findByRole("button", { name: /선택 해제/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();
  });

  it("요약에서 숨은 이슈의 선택도 그래프 상세로 이동해 해제한다", async () => {
    const f = await fixture("END", "ISSUE");
    f.show();
    fireEvent.click(
      await screen.findByRole("button", { name: "선택으로 가기" })
    );
    expect(
      await screen.findByRole("radio", { name: "그래프" })
    ).toHaveAttribute("aria-checked", "true");
    const clear = await screen.findByRole("button", { name: /대체 선택 해제/ });
    await waitFor(() => expect(clear).toHaveFocus());
    fireEvent.click(clear);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /대체 선택 해제/ })
      ).toBeNull()
    );
    expect(f.puts).not.toHaveBeenCalled();
  });

  it("제외한 항목의 사라진 선택은 완료를 막지 않고 명시적으로 해제할 수 있다", async () => {
    const f = await fixture("END");
    f.item.included = false;
    f.show();
    const box = await f.box();
    expect(
      await within(box).findByRole("button", { name: /선택 해제/ })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "선택으로 가기" })).toBeNull();
  });

  it("분석 중 읽기 전용 화면은 해제를 요구하지 않고 선택만 보존한다", async () => {
    const f = await fixture("END");
    server.use(
      http.get("*/v1/notes/:noteId/analyses/flow", () =>
        HttpResponse.json(
          envelope({
            noteId: MENTORING_NOTE_ID,
            status: "ANALYZING",
            regions: [
              { region: "SUMMARY", status: "SUCCEEDED" },
              { region: "RELATIONS", status: "PENDING" },
            ],
          })
        )
      )
    );
    f.show();
    expect(
      await within(await f.box()).findByRole("button", { name: /선택 해제/ })
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "선택으로 가기" })).toBeNull();
    expect(f.patches).toEqual([]);
  });
});
