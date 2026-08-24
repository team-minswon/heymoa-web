import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextRail, formatFreshness } from "@/components/notes/context-rail";
import type { ContextCandidateHead } from "@/lib/notes/context-candidates/contract";
import {
  initialContextState,
  selectCards,
  type ContextState,
} from "@/lib/notes/context-candidates/reducer";

const realtime = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("@/components/notes/note-realtime-provider", () => ({
  useNoteRealtime: () => realtime.value,
}));

function head(
  over: Partial<ContextCandidateHead> & { candidateId: string }
): ContextCandidateHead {
  return {
    revision: 1,
    operation: "CREATE",
    kind: "DECISION",
    status: "OPEN",
    closeReason: null,
    revisionSource: "LIVE",
    content: "경로 데이터 저장소는 MongoDB를 사용한다",
    createdSequence: 10,
    lastEvidenceSequence: 10,
    aiSemanticRevisionCount: 0,
    resolvesCandidateId: null,
    evidence: [
      {
        segmentId: "0HZX2K7M9Q4AH",
        sequence: 10,
        startedAtMs: 1_872_000,
        endedAtMs: 1_876_000,
        text: "그럼 MongoDB로 갑시다",
        role: "SUPPORTS",
      },
    ],
    ...over,
  };
}

function renderRail(
  candidates: ContextCandidateHead[],
  over: Partial<ContextState> & { failed?: boolean; loading?: boolean } = {},
  onEvidenceSelect = vi.fn(),
  onRetry = vi.fn()
) {
  const state: ContextState = {
    ...initialContextState,
    candidates: Object.fromEntries(candidates.map((c) => [c.candidateId, c])),
    ...over,
  };
  realtime.value = {
    context: {
      cards: selectCards(state),
      state,
      failed: Boolean((over as { failed?: boolean }).failed),
      loading: Boolean((over as { loading?: boolean }).loading),
      retry: onRetry,
    },
  };
  render(<ContextRail onEvidenceSelect={onEvidenceSelect} />);
  return { onEvidenceSelect, onRetry };
}

afterEach(cleanup);

describe("ContextRail", () => {
  it("사건이 없으면 오류가 아니라 조용한 빈 상태를 보인다", () => {
    renderRail([]);
    expect(screen.getByText(/아직 정리할 발화가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("로딩도 빈 상태로 접지 않는다 — 아직 모르는 것을 없다고 하지 않는다", () => {
    renderRail([], { loading: true });

    expect(screen.queryByText(/아직 정리할 발화가 없습니다/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("정리 결과를 불러오는 중")).toBeInTheDocument();
    // 실패와도 갈린다 — 셋이 서로 다른 상태다.
    expect(screen.queryByText(/불러오지 못했습니다/)).not.toBeInTheDocument();
  });

  it("조회 실패를 정상 빈 상태로 접지 않는다", () => {
    // **이게 접히면 사용자가 후보 0건을 사실로 믿는다.** 실제로는 서버가 못 답한 것이다.
    const { onRetry } = renderRail([], { failed: true });

    expect(screen.queryByText(/아직 정리할 발화가 없습니다/)).not.toBeInTheDocument();
    expect(screen.getByText(/불러오지 못했습니다/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /다시 시도/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("개수가 목록에 보이는 카드 수와 같고 완결을 주장하지 않는다", () => {
    renderRail([
      head({ candidateId: "0HZX2K7M9Q4A1", createdSequence: 10 }),
      head({ candidateId: "0HZX2K7M9Q4A2", createdSequence: 20 }),
    ]);
    // 「총 N건」이 아니라 「지금까지 N건」이다.
    expect(screen.getByText("지금까지 2건")).toBeInTheDocument();
  });

  it("RESOLVE 결과도 개수에 든다", () => {
    renderRail([
      head({
        candidateId: "0HZX2K7M9Q4AQ",
        kind: "QUESTION",
        status: "CLOSED",
        closeReason: "RESOLVED",
        createdSequence: 10,
      }),
      head({
        candidateId: "0HZX2K7M9Q4AR",
        resolvesCandidateId: "0HZX2K7M9Q4AQ",
        createdSequence: 11,
      }),
    ]);
    expect(screen.getByText("지금까지 2건")).toBeInTheDocument();
  });

  it("철회와 해결이 서로 다르게 보인다 — 성취를 취소처럼 그리지 않는다", () => {
    renderRail([
      head({
        candidateId: "0HZX2K7M9Q4A1",
        content: "철회된 안건",
        kind: "AGENDA",
        status: "CLOSED",
        closeReason: "RETRACTED",
        createdSequence: 10,
      }),
      head({
        candidateId: "0HZX2K7M9Q4A2",
        content: "답이 나온 질문",
        kind: "QUESTION",
        status: "CLOSED",
        closeReason: "RESOLVED",
        createdSequence: 20,
      }),
    ]);

    expect(screen.getByText("철회됨")).toBeInTheDocument();
    expect(screen.getByText("답변됨")).toBeInTheDocument();

    const retracted = screen.getByText("철회된 안건");
    const resolved = screen.getByText("답이 나온 질문");
    expect(retracted.className).toContain("line-through");
    expect(resolved.className).not.toContain("line-through");
  });

  it("근거를 펼치면 인용이 나오고 누르면 그 발화를 짚는다", async () => {
    const { onEvidenceSelect } = renderRail([
      head({ candidateId: "0HZX2K7M9Q4A1" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /MongoDB를 사용한다/ }));
    const quote = await screen.findByRole("button", {
      name: /그럼 MongoDB로 갑시다/,
    });
    fireEvent.click(quote);

    expect(onEvidenceSelect).toHaveBeenCalledWith("0HZX2K7M9Q4AH");
  });

  it("근거가 여럿이면 시각도 여럿 적는다", () => {
    renderRail([
      head({
        candidateId: "0HZX2K7M9Q4A1",
        evidence: [
          {
            segmentId: "0HZX2K7M9Q4AH",
            sequence: 10,
            startedAtMs: 1_872_000,
            endedAtMs: 1_876_000,
            text: "가",
            role: "SUPPORTS",
          },
          {
            segmentId: "0HZX2K7M9Q4AJ",
            sequence: 11,
            startedAtMs: 1_912_000,
            endedAtMs: 1_916_000,
            text: "나",
            role: "SUPPORTS",
          },
        ],
      }),
    ]);
    expect(screen.getByText("전사 31:12 · 31:52")).toBeInTheDocument();
  });

  it("유형 필터가 목록을 좁히지만 개수는 전체를 유지한다", () => {
    renderRail([
      head({ candidateId: "0HZX2K7M9Q4A1", kind: "DECISION", createdSequence: 10 }),
      head({
        candidateId: "0HZX2K7M9Q4A2",
        kind: "AGENDA",
        content: "안건 하나",
        createdSequence: 20,
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "안건" }));

    expect(screen.getByText("안건 하나")).toBeInTheDocument();
    expect(screen.queryByText(/MongoDB를 사용한다/)).not.toBeInTheDocument();
    // 필터는 보는 각도이지 원장의 크기가 아니다.
    expect(screen.getByText("지금까지 2건")).toBeInTheDocument();
  });

  it("결과 후보가 질문 아래로 들어간다", () => {
    renderRail([
      head({
        candidateId: "0HZX2K7M9Q4AQ",
        kind: "QUESTION",
        content: "손해가 얼마나 되나",
        createdSequence: 10,
      }),
      head({
        candidateId: "0HZX2K7M9Q4AR",
        kind: "STATUS_REPORT",
        content: "15% 안쪽이다",
        resolvesCandidateId: "0HZX2K7M9Q4AQ",
        createdSequence: 11,
      }),
    ]);

    const items = screen.getAllByRole("listitem");
    const parent = items.find((item) =>
      within(item).queryByText("손해가 얼마나 되나")
    );
    expect(parent).toBeDefined();
    expect(within(parent!).getByText("15% 안쪽이다")).toBeInTheDocument();
  });

  it("스크린리더가 후보·근거·필터를 맥락과 함께 읽는다", () => {
    renderRail([head({ candidateId: "0HZX2K7M9Q4A1" })]);

    // 필터 넷이 맥락 없는 토글로 흩어지면 무엇을 고르는지 알 수 없다.
    const filters = screen.getByRole("group", { name: "유형으로 좁히기" });
    expect(within(filters).getAllByRole("button")).toHaveLength(4);
    expect(
      within(filters).getByRole("button", { name: "전체" })
    ).toHaveAttribute("aria-pressed", "true");

    // 목록에 이름이 있어야 「무엇의 목록인가」가 읽힌다.
    expect(screen.getByRole("list", { name: "사건 흐름" })).toBeInTheDocument();
  });

  it("근거 펼침이 키보드로 열리고 상태를 알린다", () => {
    renderRail([head({ candidateId: "0HZX2K7M9Q4A1" })]);
    const claim = screen.getByRole("button", { name: /MongoDB를 사용한다/ });

    // 접힘·펼침이 aria 로 드러나야 스크린리더가 상태를 안다.
    expect(claim).toHaveAttribute("aria-expanded", "false");
    // 근거 개수는 화면에 아이콘뿐이라 말로도 준다.
    expect(claim).toHaveAccessibleName(/근거 1개/);

    fireEvent.click(claim);
    expect(claim).toHaveAttribute("aria-expanded", "true");
    expect(claim.getAttribute("aria-controls")).toBeTruthy();
  });

  it("근거가 없는 후보는 펼칠 것이 없으므로 비활성이다", () => {
    renderRail([head({ candidateId: "0HZX2K7M9Q4A1", evidence: [] })]);
    const claim = screen.getByRole("button", { name: /MongoDB를 사용한다/ });

    expect(claim).toBeDisabled();
    expect(claim).not.toHaveAttribute("aria-expanded");
  });

  it("갱신 시각은 서버 값에서 오고 없으면 안 그린다", () => {
    const now = Date.parse("2026-08-24T02:00:00.000Z");
    expect(formatFreshness(null, now)).toBeNull();
    expect(formatFreshness("2026-08-24T01:59:40.000Z", now)).toBe("방금");
    expect(formatFreshness("2026-08-24T01:57:00.000Z", now)).toBe("3분 전");
  });

  it("배치가 아직 없으면 갱신 시각을 그리지 않는다", () => {
    renderRail([head({ candidateId: "0HZX2K7M9Q4A1" })]);
    expect(screen.queryByText("방금")).not.toBeInTheDocument();
  });
});
