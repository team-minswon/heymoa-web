import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { delay, getResponse, http, HttpResponse } from "msw";
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
  it("요약 · 주제 · 결정 · 할 일만 그리고, 주제 칩으로 그 주제의 항목만 남긴다", async () => {
    renderTab();

    expect(
      await screen.findByText(
        /문제 정의를 「회의 뒤 할 일이 확정되지 않는다」로 좁히고/
      )
    ).toBeInTheDocument();
    for (const title of ["요약", "주제", "결정", "할 일"]) {
      expect(section(title)).toBeInTheDocument();
    }
    // 이슈 · 질문과 참고는 요약 보기에 서지 않는다(APP-864).
    expect(screen.queryByRole("region", { name: "이슈 · 질문" })).toBeNull();
    expect(screen.queryByRole("region", { name: "참고" })).toBeNull();
    expect(
      screen.queryByText("설문의 54%가 우리 사용자층에도 맞는 수치인지 알 수 없다")
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /차별점과 요금/ }));

    expect(
      await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다",
      })
    ).not.toBeInTheDocument();
    // 목차의 수는 그 주제로 좁혔을 때 화면에 서는 항목의 수다 — 이슈 · 질문 · 참고는 세지 않는다.
    const scoped = screen.getByRole("status").textContent ?? "";
    const rows = document.querySelectorAll("section[aria-label] [data-item-id]").length;
    expect(Number(/항목 (\d+)/.exec(scoped)?.[1])).toBe(rows);
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

  it("항목을 제외하면 주제 칩과 주제 머리 개수가 하나 줄고 제외 취소하면 늘어난다", async () => {
    renderTab();
    const chip = await screen.findByRole("button", { name: /차별점과 요금/ });
    const num = (text: string | null) => Number(/항목 (\d+)/.exec(text ?? "")?.[1]);
    const chipCount = () => num(chip.textContent);
    const headCount = () => num(screen.getByRole("status").textContent);
    fireEvent.click(chip);
    fireEvent.click(await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다"));
    await screen.findByRole("button", { name: "제외" });
    const before = chipCount();
    expect(headCount()).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "제외" }));
    await waitFor(() => expect(chipCount()).toBe(before - 1));
    expect(headCount()).toBe(before - 1);

    fireEvent.click(screen.getByRole("button", { name: "제외 취소" }));
    await waitFor(() => expect(chipCount()).toBe(before));
    expect(headCount()).toBe(before);
  });

  it("확정 때문에 거절되면 확정 안내를 띄우고 판 충돌 문구 없이 흐름 상태를 다시 읽는다", async () => {
    let flowReads = 0;
    server.use(
      http.get("*/v1/notes/:noteId/analyses/flow", () => {
        flowReads += 1;
        return HttpResponse.json({ success: true, data: { noteId: MENTORING_NOTE_ID, status: "REVIEWABLE" }, error: null });
      }),
      http.patch("*/v1/notes/:noteId/meeting-review/items/:itemId", () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: "MEETING_REVIEW_CONFIRMED", message: "확정된 검토본은 고칠 수 없습니다." } },
          { status: 409 }
        )
      )
    );
    renderTab();
    fireEvent.click(await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다"));
    await screen.findByRole("button", { name: "제외" });
    await waitFor(() => expect(flowReads).toBeGreaterThan(0));
    const before = flowReads;

    fireEvent.click(screen.getByRole("button", { name: "제외" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("확정된 검토본은 고칠 수 없습니다."));
    await waitFor(() => expect(flowReads).toBeGreaterThan(before));
    expect(screen.queryByText(/다른 사람이 먼저 수정해/)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(CONFLICT_MESSAGE);
  });

  describe("확정 거절 뒤", () => {
    const confirmedPatch = () =>
      http.patch("*/v1/notes/:noteId/meeting-review/items/:itemId", () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: "MEETING_REVIEW_CONFIRMED", message: "확정된 검토본은 고칠 수 없습니다." } },
          { status: 409 }
        )
      );
    const flowOf = (status: string) =>
      HttpResponse.json({ success: true, data: { noteId: MENTORING_NOTE_ID, status }, error: null });

    it("흐름 재조회가 실패해도 확정으로 남아 편집 컨트롤이 다시 켜지지 않는다", async () => {
      let rejected = false;
      server.use(
        http.get("*/v1/notes/:noteId/analyses/flow", () =>
          rejected ? HttpResponse.json({ success: false }, { status: 500 }) : flowOf("REVIEWABLE")
        ),
        confirmedPatch()
      );
      renderTab();
      fireEvent.click(await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다"));
      await screen.findByRole("button", { name: "제외" });
      rejected = true;

      fireEvent.click(screen.getByRole("button", { name: "제외" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("확정된 검토본은 고칠 수 없습니다."));
      await waitFor(() => expect(screen.queryByRole("button", { name: "제외" })).not.toBeInTheDocument());
      expect(screen.getByText("확정됨")).toBeInTheDocument();
    });

    it("검토본도 다시 읽어 읽기 전용 화면이 최종 항목을 보인다", async () => {
      let reviewReads = 0;
      server.use(
        http.get("*/v1/notes/:noteId/meeting-review", () => {
          reviewReads += 1;
          return undefined;
        }),
        confirmedPatch()
      );
      renderTab();
      fireEvent.click(await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다"));
      await screen.findByRole("button", { name: "제외" });
      const before = reviewReads;

      fireEvent.click(screen.getByRole("button", { name: "제외" }));

      await waitFor(() => expect(reviewReads).toBeGreaterThan(before));
    });

    it("확정으로 바뀌어도 쓰던 수정 초안은 남는다", async () => {
      let rejected = false;
      server.use(
        http.get("*/v1/notes/:noteId/analyses/flow", () => flowOf(rejected ? "CONFIRMED" : "REVIEWABLE")),
        confirmedPatch()
      );
      renderTab();
      fireEvent.click(await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다"));
      fireEvent.click(await screen.findByRole("button", { name: "수정" }));
      fireEvent.change(screen.getByRole("textbox", { name: "항목 내용" }), { target: { value: "고치던 문장" } });
      rejected = true;

      fireEvent.click(screen.getByRole("button", { name: "저장" }));

      await waitFor(() => expect(screen.getByText("확정됨")).toBeInTheDocument());
      expect(screen.getByRole("textbox", { name: "항목 내용" })).toHaveValue("고치던 문장");
    });

    it("요약과 프로젝트 할 일도 다시 읽는다", async () => {
      let summaryReads = 0;
      let taskReads = 0;
      server.events.on("request:start", ({ request }) => {
        if (request.method !== "GET") return;
        if (request.url.endsWith("/meeting-review/summary")) summaryReads += 1;
        if (/\/projects\/[^/]+\/tasks(\?|$)/.test(request.url)) taskReads += 1;
      });
      server.use(confirmedPatch());
      renderTab();
      fireEvent.click(await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다"));
      await screen.findByRole("button", { name: "제외" });
      await waitFor(() => expect(taskReads).toBeGreaterThan(0));
      const [summaryBefore, taskBefore] = [summaryReads, taskReads];

      fireEvent.click(screen.getByRole("button", { name: "제외" }));

      await waitFor(() => expect(summaryReads).toBeGreaterThan(summaryBefore));
      await waitFor(() => expect(taskReads).toBeGreaterThan(taskBefore));
      server.events.removeAllListeners();
    });

    it("확정으로 바뀐 뒤 남은 초안의 저장 버튼은 꺼진다", async () => {
      let rejected = false;
      server.use(
        http.get("*/v1/notes/:noteId/analyses/flow", () => flowOf(rejected ? "CONFIRMED" : "REVIEWABLE")),
        confirmedPatch()
      );
      renderTab();
      fireEvent.click(await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다"));
      fireEvent.click(await screen.findByRole("button", { name: "수정" }));
      fireEvent.change(screen.getByRole("textbox", { name: "항목 내용" }), { target: { value: "고치던 문장" } });
      rejected = true;
      fireEvent.click(screen.getByRole("button", { name: "저장" }));

      await waitFor(() => expect(screen.getByText("확정됨")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    });

    it("확정으로 바뀐 뒤 남은 새 항목 초안의 추가 버튼은 꺼진다", async () => {
      let rejected = false;
      server.use(
        http.get("*/v1/notes/:noteId/analyses/flow", () => flowOf(rejected ? "CONFIRMED" : "REVIEWABLE")),
        http.post("*/v1/notes/:noteId/meeting-review/items", () =>
          HttpResponse.json(
            { success: false, data: null, error: { code: "MEETING_REVIEW_CONFIRMED", message: "확정" } },
            { status: 409 }
          )
        )
      );
      renderTab();
      await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");
      fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
      fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), { target: { value: "쓰던 새 항목" } });
      rejected = true;
      fireEvent.click(screen.getByRole("button", { name: "추가" }));

      await waitFor(() => expect(screen.getByText("확정됨")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
    });

    it("토스트는 서버 문구를 쓴다", async () => {
      server.use(
        http.patch("*/v1/notes/:noteId/meeting-review/items/:itemId", () =>
          HttpResponse.json(
            { success: false, data: null, error: { code: "MEETING_REVIEW_CONFIRMED", message: "서버가 준 확정 문구" } },
            { status: 409 }
          )
        )
      );
      renderTab();
      fireEvent.click(await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다"));
      fireEvent.click(await screen.findByRole("button", { name: "제외" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("서버가 준 확정 문구"));
    });

    it("확정으로 바뀌어도 쓰던 새 항목 초안은 남는다", async () => {
      let rejected = false;
      server.use(
        http.get("*/v1/notes/:noteId/analyses/flow", () => flowOf(rejected ? "CONFIRMED" : "REVIEWABLE")),
        http.post("*/v1/notes/:noteId/meeting-review/items", () =>
          HttpResponse.json(
            { success: false, data: null, error: { code: "MEETING_REVIEW_CONFIRMED", message: "확정" } },
            { status: 409 }
          )
        )
      );
      renderTab();
      await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");
      fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
      fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), { target: { value: "쓰던 새 항목" } });
      rejected = true;

      fireEvent.click(screen.getByRole("button", { name: "추가" }));

      await waitFor(() => expect(screen.getByText("확정됨")).toBeInTheDocument());
      expect(screen.getByRole("textbox", { name: "새 항목 내용" })).toHaveValue("쓰던 새 항목");
    });
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

  it("주제로 좁혀 본 채 추가하면 그 주제 결정에 서고 주제 칩 개수가 늘며, 요청에 topicOrdinal 이 실린다", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/meeting-review/items")) {
        bodies.push(await request.clone().json());
      }
    });
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /차별점과 요금/ }));
    await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다");
    const count = () =>
      Number(/항목 (\d+)/.exec(screen.getByRole("status").textContent ?? "")?.[1]);
    const before = count();

    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "요금표는 다음 회의에서 확정한다" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(
      await within(section("결정")).findByRole("button", {
        name: "요금표는 다음 회의에서 확정한다",
      })
    ).toBeInTheDocument();
    expect(count()).toBe(before + 1);
    expect(bodies[0]).toMatchObject({ topicOrdinal: 2 });
    server.events.removeAllListeners();
  });

  it("전체 보기에서 추가하면 요청 본문에 topicOrdinal 키가 없다", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/meeting-review/items")) {
        bodies.push(await request.clone().json());
      }
    });
    renderTab();
    await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "전체 보기에서 더한 결정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await within(section("결정")).findByRole("button", {
      name: "전체 보기에서 더한 결정",
    });
    expect(bodies).toHaveLength(1);
    expect("topicOrdinal" in bodies[0]).toBe(false);
    server.events.removeAllListeners();
  });

  it("요약에 없는 주제라고 서버가 400 을 주면 입력을 남기고 서버 메시지를 토스트로 보인다", async () => {
    server.use(
      http.post("*/v1/notes/:noteId/meeting-review/items", () =>
        HttpResponse.json(
          { success: false, error: { code: "TOPIC_UNKNOWN", message: "요약에 없는 주제입니다." } },
          { status: 400 }
        )
      )
    );
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /차별점과 요금/ }));
    await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다");
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "거절될 결정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: "새 항목 내용" })).toHaveValue("거절될 결정");
  });

  it("저장은 됐는데 요약을 다시 읽지 못하면 폼은 닫히되 새로고침을 알리는 토스트를 띄운다", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /차별점과 요금/ }));
    await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다");
    server.use(
      http.get("*/v1/notes/:noteId/meeting-review/summary", () =>
        HttpResponse.json(
          { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
          { status: 500 }
        )
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "요약 재조회가 실패하는 결정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("새로고침"))
    );
  });

  it("전체 보기에서 추가하면 요약을 다시 읽지 않는다", async () => {
    let summaryReads = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "GET" && request.url.endsWith("/meeting-review/summary")) summaryReads += 1;
    });
    renderTab();
    await row("설문 근거는 출처와 표본 수를 발표 자료에 함께 적는다");
    const before = summaryReads;
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "요약 재조회가 필요 없는 결정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await within(section("결정")).findByRole("button", { name: "요약 재조회가 필요 없는 결정" });
    expect(summaryReads).toBe(before);
    server.events.removeAllListeners();
  });

  it("추가가 판 충돌로 거절되면 검토본과 함께 요약도 다시 읽는다", async () => {
    let summaryReads = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.method === "GET" && request.url.endsWith("/meeting-review/summary")) summaryReads += 1;
    });
    server.use(
      http.post("*/v1/notes/:noteId/meeting-review/items", () =>
        HttpResponse.json(
          { success: false, error: { code: "MEETING_REVIEW_CONFLICT", message: "다른 사람이 먼저 수정했습니다." } },
          { status: 409 }
        )
      )
    );
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /차별점과 요금/ }));
    await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다");
    const before = summaryReads;
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "충돌로 거절될 결정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(summaryReads).toBeGreaterThan(before));
    server.events.removeAllListeners();
  });

  it("주제를 바꾸면 작성 중이던 추가 폼은 닫혀 다른 주제에 저장되지 않는다", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /차별점과 요금/ }));
    await row("요금은 좌석이 아니라 회의 시간 기준으로 계산한다");
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 항목 내용" }), {
      target: { value: "다른 주제로 새어 나가면 안 되는 결정" },
    });
    // 주제 A 에서 쓰던 중에 주제 B 를 누른다. 제출 시점의 주제로 저장되면 A 의 글이 B 에 들어간다.
    fireEvent.click(screen.getByRole("button", { name: /01\s*회의가 끝난 뒤 할 일이 흐려지는 문제/ }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "새 항목 내용" })).not.toBeInTheDocument()
    );
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

  it("요약 보기에 없는 이슈 · 질문 · 참고에 붙은 제안은 검토 완료를 막지 않는다", async () => {
    server.use(
      // 제안을 모두 걷고 이슈 하나에만 고르지 않은 대체를 붙인다 — 제안은 종류를 가리지 않고 붙는다.
      http.get("*/v1/notes/:noteId/meeting-review", async ({ request }) => {
        const original = await getResponse(meetingFlowHandlers, request);
        const body = await original!.json();
        type Row = { kind: string; included: boolean; replacements: Array<Record<string, unknown>>; taskChanges: unknown[] };
        const items: Row[] = body.data.items;
        const replacement = items.flatMap((item) => item.replacements)[0];
        for (const item of items) {
          item.replacements = [];
          item.taskChanges = [];
        }
        items.find((item) => item.kind === "ISSUE" && item.included)!.replacements = [
          { ...replacement, decision: null },
        ];
        return HttpResponse.json(body);
      })
    );
    renderTab();

    await screen.findByRole("region", { name: "결정" });
    // 고를 곳이 없는 제안을 세면 검토 완료가 영영 막힌다.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );
    expect(screen.queryByText(/고르지 않은 제안이/)).toBeNull();
  });

  it("그래프에서 감춘 항목의 할 일 변경을 반영하고 선택 저장만 실패하면 검토 완료를 막는다", async () => {
    let issueContent = "";
    server.use(
      // 할 일 변경 하나를 이슈로 옮기고 나머지 제안은 걷는다.
      http.get("*/v1/notes/:noteId/meeting-review", async ({ request }) => {
        const original = await getResponse(meetingFlowHandlers, request);
        const body = await original!.json();
        type Row = { kind: string; content: string; included: boolean; replacements: unknown[]; taskChanges: Array<Record<string, unknown>> };
        const items: Row[] = body.data.items;
        const change = items.flatMap((item) => item.taskChanges)[0];
        for (const item of items) {
          item.replacements = [];
          item.taskChanges = [];
        }
        const issue = items.find((item) => item.kind === "ISSUE" && item.included)!;
        issue.taskChanges = [{ ...change, decision: null }];
        issueContent = issue.content;
        return HttpResponse.json(body);
      })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );

    fireEvent.click(screen.getByRole("radio", { name: "그래프" }));
    const node = (
      await screen.findAllByRole("button", { name: (name) => name.includes(issueContent) })
    )[0];
    fireEvent.click(node);
    const toggle = await screen.findByRole("radiogroup", { name: "기존 할 일에 반영할지" });
    await waitFor(() =>
      expect(within(toggle).getByRole("radio", { name: "반영" })).toBeEnabled()
    );

    server.use(
      http.patch(
        "*/v1/notes/:noteId/meeting-review/items/:itemId",
        () =>
          HttpResponse.json(
            { success: false, data: null, error: { code: "INTERNAL", message: "오류" } },
            { status: 500 }
          ),
        { once: true }
      )
    );
    fireEvent.click(within(toggle).getByRole("radio", { name: "반영" }));
    await screen.findByText(/할 일에는 반영했지만 선택을 저장하지 못했습니다/);
    // 할 일은 이미 바뀌었다. 선택이 저장되기 전에 확정하면 기록과 실제가 갈린다.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled()
    );
  });

  it("할 일을 바꾼 뒤 목록을 다시 읽는 동안에도 반영이 진행 중이라 검토 완료를 막는다", async () => {
    let issueContent = "";
    let taskSaved = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let arrived!: () => void;
    const refetching = new Promise<void>((resolve) => (arrived = resolve));
    server.use(
      http.get("*/v1/notes/:noteId/meeting-review", async ({ request }) => {
        const original = await getResponse(meetingFlowHandlers, request);
        const body = await original!.json();
        type Row = { kind: string; content: string; included: boolean; replacements: unknown[]; taskChanges: Array<Record<string, unknown>> };
        const items: Row[] = body.data.items;
        const change = items.flatMap((item) => item.taskChanges)[0];
        for (const item of items) {
          item.replacements = [];
          item.taskChanges = [];
        }
        const issue = items.find((item) => item.kind === "ISSUE" && item.included)!;
        issue.taskChanges = [{ ...change, decision: null }];
        issueContent = issue.content;
        return HttpResponse.json(body);
      }),
      // 할 일 저장 뒤의 목록 재조회를 붙잡는다. 아무것도 돌려주지 않으면 원래 목이 답한다.
      http.put("*/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId", () => {
        taskSaved = true;
      }),
      http.get("*/v1/workspaces/:workspaceId/projects/:projectId/tasks", async () => {
        if (!taskSaved) return;
        arrived();
        await held;
      })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );

    fireEvent.click(screen.getByRole("radio", { name: "그래프" }));
    fireEvent.click(
      (await screen.findAllByRole("button", { name: (name) => name.includes(issueContent) }))[0]
    );
    const toggle = await screen.findByRole("radiogroup", { name: "기존 할 일에 반영할지" });
    await waitFor(() =>
      expect(within(toggle).getByRole("radio", { name: "반영" })).toBeEnabled()
    );
    fireEvent.click(within(toggle).getByRole("radio", { name: "반영" }));

    await refetching;
    await new Promise((resolve) => setTimeout(resolve, 50));
    // 할 일은 이미 바뀌었고 선택은 아직 저장 전이다. 이 틈에 확정하면 기록과 실제가 갈린다.
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();
    release();
  });

  it("그래프에서 감춘 항목의 할 일 변경을 반영해 저장되면 같은 할 일을 겨냥한 다른 감춘 제안은 막지 않는다", async () => {
    let firstContent = "";
    let applied = false;
    // 같은 할 일 변경을 감춘 항목 둘에 붙이고 나머지 제안은 걷는다. 첫 항목의 선택만 기억한다.
    const reviewBody = async (url: string) => {
      const original = await getResponse(meetingFlowHandlers, new Request(url));
      const body = await original!.json();
      type Row = { kind: string; content: string; included: boolean; replacements: unknown[]; taskChanges: Array<Record<string, unknown>> };
      const items: Row[] = body.data.items;
      const change = items.flatMap((item) => item.taskChanges)[0];
      for (const item of items) {
        item.replacements = [];
        item.taskChanges = [];
      }
      const hidden = items.filter(
        (item) => (item.kind === "ISSUE" || item.kind === "QUESTION") && item.included
      );
      hidden[0].taskChanges = [{ ...change, decision: applied ? "APPLIED" : null }];
      hidden[1].taskChanges = [{ ...change, decision: null }];
      firstContent = hidden[0].content;
      return body;
    };
    server.use(
      http.get("*/v1/notes/:noteId/meeting-review", async ({ request }) =>
        HttpResponse.json(await reviewBody(request.url))
      ),
      http.patch("*/v1/notes/:noteId/meeting-review/items/:itemId", async ({ request }) => {
        const patch = (await request.json()) as { decisions?: Array<{ decision: string }> };
        applied ||= patch.decisions?.some((row) => row.decision === "APPLIED") ?? false;
        return HttpResponse.json(await reviewBody(request.url.replace(/\/items\/[^/]+$/, "")));
      })
    );
    renderTab();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );

    fireEvent.click(screen.getByRole("radio", { name: "그래프" }));
    fireEvent.click(
      (await screen.findAllByRole("button", { name: (name) => name.includes(firstContent) }))[0]
    );
    const toggle = await screen.findByRole("radiogroup", { name: "기존 할 일에 반영할지" });
    await waitFor(() =>
      expect(within(toggle).getByRole("radio", { name: "반영" })).toBeEnabled()
    );
    fireEvent.click(within(toggle).getByRole("radio", { name: "반영" }));
    expect(
      await within(toggle).findByRole("radio", { name: /반영됨/ })
    ).toHaveAttribute("aria-checked", "true");
    // 저장된 반영은 더 막을 것이 없다. 다른 감춘 제안은 고르지 않아도 확정이 건너뛴다.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled()
    );
  });

  it("요약 보기의 관련 항목은 요약에 서는 항목만 잇는다", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /^문제 정의를/ }));
    await screen.findAllByText(/수정 기록/);
    // 인사이트라 요약 보기에 없다 — 이으면 눌러도 열 자리가 없다.
    expect(
      screen.queryByRole("button", { name: /기록이 없어서가 아니라 누가 할지 안 정해서 놓친다/ })
    ).toBeNull();
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
      within(section("요약")).getByRole("button", { name: "다시 시도" })
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
