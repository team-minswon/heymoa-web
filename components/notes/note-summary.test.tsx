import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteSummary } from "@/components/notes/note-summary";

const state = vi.hoisted(() => ({
  analysis: null as Record<string, unknown> | null,
  missing: false,
  isLoading: false,
  isFetching: false,
  requestMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useGetLatestAnalysis: () => ({
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    isError: state.missing,
    refetch: state.refetchMock,
    error: state.missing
      ? {
          success: false,
          data: null,
          error: { code: "ANALYSIS_JOB_NOT_FOUND", message: "없음" },
        }
      : null,
    data: state.analysis
      ? { status: 200, data: { success: true, data: state.analysis } }
      : undefined,
  }),
  useRequestAnalysis: () => ({ mutate: state.requestMock, isPending: false }),
}));

const onEvidenceSelect = vi.fn();

function renderSummary(isEnded: boolean) {
  return render(
    <NoteSummary
      noteId="01K0000000002"
      isEnded={isEnded}
      onEvidenceSelect={onEvidenceSelect}
    />
  );
}

const SUCCEEDED = {
  status: "SUCCEEDED",
  sections: [
    {
      kind: "OVERVIEW",
      items: [
        {
          itemId: "01K0000000070",
          content: "결제 실패율이 3%로 올랐다",
          evidence: [
            {
              segmentId: "01K0000000061",
              text: "그럼 결제 쪽부터 보죠",
              startedAtMs: 252000,
            },
            {
              segmentId: "01K0000000062",
              text: "실패율이 어제부터 3%예요",
              startedAtMs: 271000,
            },
          ],
        },
      ],
    },
    {
      kind: "ACTION_ITEM",
      items: [
        {
          itemId: "01K0000000071",
          content: "이번 주 안에 원인을 좁힌다",
          evidence: [],
        },
      ],
    },
    { kind: "DECISION", items: [] },
  ],
};

describe("NoteSummary 항목 리스트", () => {
  beforeEach(() => {
    state.analysis = structuredClone(SUCCEEDED);
    state.missing = false;
    state.isLoading = false;
    state.isFetching = false;
    onEvidenceSelect.mockReset();
  });
  afterEach(cleanup);

  // 세 섹션을 한 화면에 위에서 아래로 낸다 — 탭으로 가르면 회의 하나를 파악하는 데 세 번 눌러야 한다.
  it("세 섹션 헤딩과 항목을 한 화면에 낸다", () => {
    renderSummary(true);

    expect(screen.getByRole("region", { name: "개요" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "액션 아이템" })
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "결정" })).toBeInTheDocument();
    expect(screen.getByText("결제 실패율이 3%로 올랐다")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("빈 섹션도 헤딩은 남기고 안내를 보여준다", () => {
    renderSummary(true);
    expect(screen.getByText("이 회의에서는 나오지 않았습니다.")).toBeInTheDocument();
  });

  // 누를 자리는 마커가 아니라 줄 전체다. 마커만 컨트롤이면 문장 전체가 죽은 영역이 된다.
  it("근거는 접힌 채로 시작하고 항목을 누르면 펼쳐진다", () => {
    renderSummary(true);

    const claim = screen.getByRole("button", { name: /결제 실패율이 3%로 올랐다/ });
    expect(claim).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/그럼 결제 쪽부터 보죠/)).toBeNull();

    fireEvent.click(claim);

    expect(claim).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/그럼 결제 쪽부터 보죠/)).toBeInTheDocument();
    expect(screen.getByText("04:12")).toBeInTheDocument();
  });

  // 마커는 그림이라 스크린리더에서 사라진다. 개수는 펼칠지 말지의 근거라 말로도 있어야 한다.
  it("근거 개수를 접근 가능 이름에 남긴다", () => {
    renderSummary(true);

    expect(
      screen.getByRole("button", { name: /근거 2개/ })
    ).toBeInTheDocument();
  });

  // 근거 0개는 계약상 정상이다. 그 항목을 컨트롤로 만들면 눌러도 열릴 것이 없다.
  it("근거가 없는 항목은 컨트롤이 아니다", () => {
    renderSummary(true);

    expect(screen.getByText("이번 주 안에 원인을 좁힌다")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /이번 주 안에 원인을 좁힌다/ })
    ).toBeNull();
  });

  // 드래그로 글자를 집은 뒤 Space·Enter를 누르는 사람이 있다. 그 click은 detail===0이라
  // 선택 방어에 걸리면 안 된다 — 포인터에만 건다.
  it("선택이 남아 있어도 키보드로는 펼쳐진다", () => {
    renderSummary(true);
    const claim = screen.getByRole("button", { name: /결제 실패율이 3%로 올랐다/ });

    fireEvent.click(claim, { detail: 0 });

    expect(claim).toHaveAttribute("aria-expanded", "true");
  });

  it("인용을 누르면 그 세그먼트로 점프를 요청한다", () => {
    renderSummary(true);

    fireEvent.click(
      screen.getByRole("button", { name: /결제 실패율이 3%로 올랐다/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /그럼 결제 쪽부터 보죠/ }));

    expect(onEvidenceSelect).toHaveBeenCalledWith("01K0000000061");
  });
});

describe("NoteSummary", () => {
  beforeEach(() => {
    state.analysis = null;
    state.missing = false;
    state.isLoading = false;
    state.isFetching = false;
    state.requestMock.mockReset();
    state.refetchMock.mockReset();
  });
  afterEach(cleanup);

  /**
   * **조회와 분석은 다른 기다림이다.** 둘 다 같은 스켈레톤 하나로 그렸었고, 그 화면의 문구가
   * 「다른 화면으로 옮겨도 됩니다」였다 — 수백 ms 조회에 붙으면 거짓말이다. 반대로 몇 분
   * 걸리는 분석에 스켈레톤을 쓰면 「곧 이 자리에 들어찬다」는 약속이 거짓이 된다.
   */
  it("PENDING이면 스켈레톤이 아니라 진행 표시를 보인다", () => {
    state.analysis = { status: "PENDING", sections: [] };
    const { container } = renderSummary(true);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("회의를 정리하고 있습니다")).toBeTruthy();
    expect(screen.getByText(/다른 화면으로 옮겨도 됩니다/)).toBeTruthy();
    // 끝나는 시각을 모르는 기다림에는 자리표시 막대를 두지 않는다.
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it("조회 중이면 최종 화면 모양의 스켈레톤을 보인다", () => {
    state.isLoading = true;
    const { container } = renderSummary(true);

    // 섹션 제목 셋은 응답이 아니라 고정 순서다 — 스켈레톤이 가리지 않는다.
    ["개요", "액션 아이템", "결정"].forEach((label) => {
      expect(screen.getByRole("heading", { name: label })).toBeTruthy();
    });
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(7);
    // 분석 작업 문구는 조회에 붙지 않는다 — 여기는 몇 분이 걸리는 자리가 아니다.
    expect(screen.queryByText(/다른 화면으로 옮겨도 됩니다/)).toBeNull();
  });

  it("FAILED면 사유와 다시 분석 버튼을 보인다", () => {
    state.analysis = {
      status: "FAILED",
      sections: [],
      errorCode: "LLM_TIMEOUT",
      errorMessage: "분석이 시간 초과됐습니다.",
    };
    renderSummary(true);
    expect(screen.getByText(/시간 초과/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
    expect(state.requestMock).toHaveBeenCalledWith(
      { noteId: "01K0000000002" },
      expect.anything()
    );
  });

  it("종료됐는데 분석이 없으면(404) 요약 만들기를 준다", () => {
    state.missing = true;
    renderSummary(true);
    expect(screen.getByText("아직 요약이 없습니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "요약 만들기" }));
    expect(state.requestMock).toHaveBeenCalled();
  });

  it("종료 전에는 안내만 보이고 요약 만들기 버튼이 없다", () => {
    state.missing = true;
    renderSummary(false);
    expect(screen.getByText("요약은 회의가 끝나면 생성됩니다")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "요약 만들기" })).toBeNull();
  });

  it("요청 뒤 refetch가 끝날 때까지 재분석 버튼을 잠근다 — 중복 202 방지", () => {
    // 202 뒤 mutation은 끝나지만 refetch가 도착하기 전 낡은 FAILED가 남는다. isFetching 동안 잠근다.
    state.analysis = {
      status: "FAILED",
      sections: [],
      errorCode: "X",
      errorMessage: "실패",
    };
    state.isFetching = true;
    renderSummary(true);
    expect(screen.getByRole("button", { name: "다시 분석" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("회의가 (다른 참가자에 의해) 종료된 순간 분석을 다시 읽는다", () => {
    // 404가 폴링을 멈춘 상태에서 isEnded가 참으로 바뀌면 자동 생성된 분석을 잡아야 한다.
    state.missing = true;
    const view = renderSummary(false);
    expect(state.refetchMock).not.toHaveBeenCalled();

    view.rerender(
      <NoteSummary
        noteId="01K0000000002"
        isEnded
        onEvidenceSelect={onEvidenceSelect}
      />
    );
    expect(state.refetchMock).toHaveBeenCalled();
  });
});
