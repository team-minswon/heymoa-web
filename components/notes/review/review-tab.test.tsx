import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
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
import { workspaceOfProject } from "@/lib/mocks/assignees";
import { mockDb } from "@/lib/mocks/db";
import { MENTORING_NOTE_ID } from "@/lib/mocks/fixtures/mentoring-note";
import { meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { projectTaskHandlers, projectTasks } from "@/lib/mocks/project-tasks";
import { restHandlers } from "@/lib/mocks/rest-handlers";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import { toast } from "@/lib/ui/toast";

vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/**
 * 요약 탭을 목 서버와 끝까지 굴린다. 훅을 가짜로 바꾸지 않고 목 핸들러를 그대로 지나야
 * 판(CAS) · 흐름 상태 · 할 일 반영이 실제 계약대로 도는지 볼 수 있다.
 */
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
});
afterAll(() => server.close());

function renderTab(
  noteId = MENTORING_NOTE_ID,
  over: Partial<Parameters<typeof ReviewTab>[0]> = {}
) {
  const note = mockDb.getNote(noteId);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onEvidenceSelect = vi.fn();
  const onOpenTranscript = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ReviewTab
        noteId={noteId}
        workspaceId={workspaceOfProject(note.projectId)}
        projectId={note.projectId}
        isEnded
        participants={note.participants}
        onEvidenceSelect={onEvidenceSelect}
        onOpenTranscript={onOpenTranscript}
        {...over}
      />
    </QueryClientProvider>
  );
  return { onEvidenceSelect, onOpenTranscript };
}

const row = (content: string) => screen.findByRole("button", { name: content });
const section = (title: string) => screen.getByRole("region", { name: title });
/** 검토 줄 하나. 제안 토글은 줄마다 서 있어 이름이 같은 것이 여럿이다 */
const rowBox = async (content: string) =>
  (await row(content)).closest("[data-item-id]") as HTMLElement;

describe("검토 가능한 회의", () => {
  it("개요와 네 섹션을 그리고, 주제 칩으로 그 주제의 항목만 남긴다", async () => {
    renderTab();

    expect(
      await screen.findByText(
        /문제 정의를 「회의 뒤 할 일이 확정되지 않는다」로 좁히고/
      )
    ).toBeInTheDocument();
    for (const title of ["결정", "할 일", "이슈 · 질문", "참고"]) {
      expect(section(title)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: /차별점과 요금/ }));

    expect(
      await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다",
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("주제 02 · 항목 1");
    expect(
      screen.getByRole("heading", { name: "차별점과 요금" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(
      await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다")
    ).toBeInTheDocument();
  });

  it("주제 목차는 번호 · 제목 · 한 줄 서술 · 항목 수를 세우고, 줄에는 주제 이름이 붙는다", async () => {
    renderTab();

    const index = await screen.findByRole("list", { name: "주제 목차" });
    expect(
      within(index).getByRole("button", {
        name: /01\s*회의가 끝난 뒤 할 일이 흐려지는 문제/,
      })
    ).toHaveTextContent("회의 뒤 할 일이 흐려지는 문제를 한 문장으로 좁히고");
    expect(within(index).getAllByRole("button")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "주제 5개 더" }));
    expect(
      await screen.findByRole("button", { name: /08\s*다음 멘토링과 활동비/ })
    ).toBeInTheDocument();
    expect(
      screen.getAllByTitle("주제 01 · 회의가 끝난 뒤 할 일이 흐려지는 문제")
        .length
    ).toBeGreaterThan(0);
  });

  it("항목을 펼치면 수정 기록과 인용된 스크립트가 서고, 줄을 누르면 스크립트로 간다", async () => {
    const { onEvidenceSelect } = renderTab();

    // 결정은 앞의 몇 줄만 선다. 그 주제로 걸러 줄을 앞으로 부른다.
    fireEvent.click(
      await screen.findByRole("button", { name: /차별점과 요금/ })
    );
    fireEvent.click(
      await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다")
    );

    expect(await screen.findByText("고쳐 말함")).toBeInTheDocument();
    expect(screen.getByText("처음 나옴")).toBeInTheDocument();
    expect(screen.getByText("반대 의견")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "스크립트에서 열기" }));
    expect(onEvidenceSelect).toHaveBeenCalledTimes(1);
  });

  it("수정하고, 제외했다가 제외를 취소한다", async () => {
    renderTab();
    fireEvent.click(
      await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다")
    );

    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "항목 내용" }), {
      target: { value: "설문 근거는 출처 · 표본 수 · 조사 연도를 함께 적는다" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(
      await row("설문 근거는 출처 · 표본 수 · 조사 연도를 함께 적는다")
    ).toBeInTheDocument();
    expect(await screen.findByText(/수정됨/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "제외" }));
    expect(await screen.findByText(/제외됨/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "제외 취소" }));
    await waitFor(() =>
      expect(screen.queryByText(/제외됨/)).not.toBeInTheDocument()
    );
  });

  it("섹션에 항목을 추가하면 그 섹션에 선다", async () => {
    renderTab();
    await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");

    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "다음 멘토링 전에 발표 자료를 한 번 더 맞춰 본다" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(
      await within(section("결정")).findByRole("button", {
        name: "다음 멘토링 전에 발표 자료를 한 번 더 맞춰 본다",
      })
    ).toBeInTheDocument();
  });

  it("고를 제안을 다 고르기 전에는 확정을 막고, 이전 결정을 끝내기로 고르면 확정 줄이 바뀐 뒤 확정한다", async () => {
    renderTab();
    // 목의 멘토링 회의에는 아직 안 고른 제안이 셋이다(대체 하나 · 기존 할 일 변경 둘).
    expect(
      await screen.findByText("고르지 않은 제안이 3개 남았습니다")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();

    // 제안은 줄을 펼치지 않아도 줄 아래에 서 있다.
    const box = await rowBox(
      "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다"
    );
    fireEvent.click(within(box).getByRole("radio", { name: /끝내기/ }));
    // 선택은 검토본에 저장된 뒤에 선다.
    await waitFor(() =>
      expect(screen.getByText(/개 끝남/)).toHaveTextContent(
        "이전 결정 1개 끝남"
      )
    );
    expect(within(box).getByRole("radio", { name: /끝내기/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    for (const content of [
      "경쟁 서비스 요금제를 한 표로 정리한다",
      "구현 결과를 기대 효과 순서로 다시 배치한다",
    ]) {
      const toggle = within(await rowBox(content)).getByRole("radiogroup", {
        name: "기존 할 일에 반영할지",
      });
      await waitFor(() =>
        expect(
          within(toggle).getByRole("radio", { name: "유지" })
        ).toBeEnabled()
      );
      fireEvent.click(within(toggle).getByRole("radio", { name: "유지" }));
      await waitFor(() =>
        expect(
          within(toggle).getByRole("radio", { name: "유지" })
        ).toHaveAttribute("aria-checked", "true")
      );
    }
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );

    fireEvent.click(screen.getByRole("button", { name: "검토 완료" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "검토 완료" }));

    expect(await screen.findByText("확정됨")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "검토 완료" })
    ).not.toBeInTheDocument();
  });

  it("제안의 선택은 저장돼 다시 열어도 같게 보이고, 끝낼 이전 결정의 내용과 출처가 선다", async () => {
    renderTab();
    const box = await rowBox(
      "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다"
    );
    expect(
      within(box).getByText(/로드맵 브레인스토밍 · .* 확정/)
    ).toBeInTheDocument();
    fireEvent.click(within(box).getByRole("radio", { name: /끝내기/ }));
    await waitFor(() =>
      expect(
        within(box).getByRole("radio", { name: /끝내기/ })
      ).toHaveAttribute("aria-checked", "true")
    );

    cleanup();
    renderTab();
    const again = await rowBox(
      "첫 화면 메시지는 회의 기록보다 회의 뒤 실행 연결로 둔다"
    );
    expect(
      within(again).getByRole("radio", { name: /끝내기/ })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("이슈 · 질문에도 담당 · 기한 칸이 서고, 회의 중에 풀린 것은 해결됨으로 선다", async () => {
    renderTab();
    await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");
    const open = section("이슈 · 질문");
    expect(
      within(open).getAllByRole("button", { name: "기한 정하기" }).length
    ).toBeGreaterThan(0);

    fireEvent.click(
      within(open).getByRole("button", { name: /이슈 · 질문 \d+개 더/ })
    );
    expect((await within(open).findAllByText("해결됨")).length).toBeGreaterThan(
      0
    );
  });

  it("기존 할 일 변경을 반영하면 그 할 일에 바로 저장된다", async () => {
    renderTab();
    const toggle = within(
      await rowBox("구현 결과를 기대 효과 순서로 다시 배치한다")
    ).getByRole("radiogroup", {
      name: "기존 할 일에 반영할지",
    });
    await waitFor(() =>
      expect(within(toggle).getByRole("radio", { name: "반영" })).toBeEnabled()
    );
    fireEvent.click(within(toggle).getByRole("radio", { name: "반영" }));

    expect(
      await within(toggle).findByRole("radio", { name: /반영됨/ })
    ).toHaveAttribute("aria-checked", "true");
    const note = mockDb.getNote(MENTORING_NOTE_ID);
    const response = await fetch(
      `http://localhost/v1/workspaces/${workspaceOfProject(note.projectId)}/projects/${note.projectId}/tasks`
    );
    const { data } = await response.json();
    const task = data.tasks.find(
      (row: { taskId: string }) =>
        row.taskId === projectTasks.idOf("results-slide")
    );
    expect(task.taskStatus).toBe("COMPLETED");
  });

  it("요약이 오는 동안 그래프 보기는 없다고 하지 않고 자리만 잡는다", async () => {
    server.use(
      http.get("*/v1/notes/:noteId/meeting-review/summary", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      })
    );
    renderTab();
    await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");

    fireEvent.click(screen.getByRole("radio", { name: "그래프" }));
    expect(
      await screen.findByLabelText("그래프 불러오는 중")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("주제 묶음이 없어 그래프를 그릴 수 없습니다")
    ).not.toBeInTheDocument();
  });

  it("요약 조회가 실패하면 요약이 없다고 하지 않고 다시 불러올 길을 둔다", async () => {
    server.use(
      http.get("*/v1/notes/:noteId/meeting-review/summary", () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: "INTERNAL", message: "오류" },
          },
          { status: 500 }
        )
      )
    );
    renderTab();

    expect(
      await screen.findByText("요약을 불러오지 못했습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/주제 요약이 없습니다/)).not.toBeInTheDocument();
    expect(
      within(section("개요")).getByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
  });

  it("담당으로 고를 사람 목록을 못 읽으면 빈 목록처럼 두지 않고 다시 불러올 길을 둔다", async () => {
    server.use(
      http.get("*/v1/workspaces/:workspaceId/members", () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: "INTERNAL", message: "오류" },
          },
          { status: 500 }
        )
      )
    );
    renderTab();

    expect(
      await screen.findByText("담당으로 고를 사람 목록을 불러오지 못했습니다.")
    ).toBeInTheDocument();
  });

  it("할 일에 반영한 뒤 선택 저장이 실패하면 알리고, 다시 누르면 선택만 저장한다", async () => {
    renderTab();
    const toggle = within(
      await rowBox("구현 결과를 기대 효과 순서로 다시 배치한다")
    ).getByRole("radiogroup", {
      name: "기존 할 일에 반영할지",
    });
    await waitFor(() =>
      expect(within(toggle).getByRole("radio", { name: "반영" })).toBeEnabled()
    );

    server.use(
      http.patch(
        "*/v1/notes/:noteId/meeting-review/items/:itemId",
        () =>
          HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "INTERNAL", message: "오류" },
            },
            { status: 500 }
          ),
        { once: true }
      )
    );
    fireEvent.click(within(toggle).getByRole("radio", { name: "반영" }));
    expect(
      await screen.findByText(/할 일에는 반영했지만 선택을 저장하지 못했습니다/)
    ).toBeInTheDocument();

    fireEvent.click(within(toggle).getByRole("radio", { name: "반영" }));
    expect(
      await within(toggle).findByRole("radio", { name: /반영됨/ })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.queryByText(/할 일에는 반영했지만 선택을 저장하지 못했습니다/)
    ).not.toBeInTheDocument();
  });

  it("다른 사람이 먼저 수정했으면 그 줄에 최신 내용을 불러왔다고 알린다", async () => {
    renderTab();
    fireEvent.click(
      await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다")
    );
    await screen.findByRole("button", { name: "제외" });

    // 화면이 읽은 뒤 누군가 다른 항목을 고쳐 검토본 판을 올린다.
    const review = await (
      await fetch(
        `http://localhost/v1/notes/${MENTORING_NOTE_ID}/meeting-review`
      )
    ).json();
    const other = review.data.items[0];
    await fetch(
      `http://localhost/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${other.itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedReviewVersion: review.data.reviewVersion,
          expectedItemRevision: other.revision,
          included: false,
        }),
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "제외" }));

    expect(
      await screen.findByText(
        /다른 사람이 먼저 수정해 최신 내용을 불러왔습니다/
      )
    ).toBeInTheDocument();
  });

  it("항목을 추가하는 사이 다른 사람이 먼저 수정했으면 쓴 내용을 남긴 채 알린다", async () => {
    renderTab();
    await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "발표는 10분 안에 끝낸다" },
    });

    const review = await (
      await fetch(
        `http://localhost/v1/notes/${MENTORING_NOTE_ID}/meeting-review`
      )
    ).json();
    const other = review.data.items[0];
    await fetch(
      `http://localhost/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${other.itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedReviewVersion: review.data.reviewVersion,
          expectedItemRevision: other.revision,
          included: false,
        }),
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(CONFLICT_MESSAGE)
    );
    expect(screen.getByRole("textbox", { name: "새 항목 내용" })).toHaveValue(
      "발표는 10분 안에 끝낸다"
    );
  });

  it("그래프 보기에서 항목을 고르면 그 아래에 수정 기록이 선다", async () => {
    renderTab();
    await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");

    fireEvent.click(screen.getByRole("radio", { name: "그래프" }));
    const node = (
      await screen.findAllByRole("button", {
        name: /무료 구간은 월 5시간으로 두고 팀 요금제에서는 뺀다/,
      })
    )[0];
    fireEvent.click(node);

    expect(
      await screen.findByRole("button", { name: "닫기" })
    ).toBeInTheDocument();
    expect(await screen.findByText("검토에서 수정")).toBeInTheDocument();
  });

  it("노트 멤버는 시작자와 관계없이 검토할 수 있다", async () => {
    renderTab(MENTORING_NOTE_ID);
    fireEvent.click(
      await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다")
    );

    expect(
      screen.getByRole("button", { name: "결정 추가" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "제외" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "검토 완료" })
    ).toBeInTheDocument();
  });
});

describe("검토본이 서기 전과 뒤", () => {
  it("분석이 도는 동안 진행과 이유를 보인다", async () => {
    renderTab("01K0000000022");
    expect(
      await screen.findByText("회의를 분석하는 중입니다")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "화자 나누기: 완료" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "분석: 진행 중" })
    ).toBeInTheDocument();
  });

  it("분석이 실패하면 노트 멤버가 다시 요청해 진행으로 넘어간다", async () => {
    renderTab("01K0000000026");
    expect(
      await screen.findByRole("listitem", { name: "분석: 실패" })
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "다시 분석" }));
    expect(
      await screen.findByText("회의를 분석하는 중입니다")
    ).toBeInTheDocument();
  });

  it("지난 노트는 구형 요약을 읽기만 한다", async () => {
    renderTab("01K0000000020");
    expect(
      await screen.findByRole("heading", { name: /개요/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "요약 다시 만들기" })
    ).not.toBeInTheDocument();
  });

  it("확정된 회의는 확정됨으로 서고 고칠 수 없다", async () => {
    renderTab("01K0000000024");
    expect(await screen.findByText("확정됨")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "검토 완료" })
    ).not.toBeInTheDocument();
  });

  it("회의가 끝나기 전에는 요약이 언제 생기는지만 말한다", () => {
    renderTab(MENTORING_NOTE_ID, { isEnded: false });
    expect(
      screen.getByText("요약은 회의가 끝나면 정리됩니다")
    ).toBeInTheDocument();
  });
});
