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
        text: "그럼 MongoDB로 갑시다",
        role: "SUPPORTS",
      },
    ],
    ...over,
  };
}

function renderRail(
  candidates: ContextCandidateHead[],
  over: Partial<ContextState> = {},
  onEvidenceSelect = vi.fn()
) {
  const state: ContextState = {
    ...initialContextState,
    candidates: Object.fromEntries(candidates.map((c) => [c.candidateId, c])),
    ...over,
  };
  realtime.value = { context: { cards: selectCards(state), state } };
  render(<ContextRail onEvidenceSelect={onEvidenceSelect} />);
  return { onEvidenceSelect };
}

afterEach(cleanup);

describe("ContextRail", () => {
  it("사건이 없으면 오류가 아니라 조용한 빈 상태를 보인다", () => {
    renderRail([]);
    expect(screen.getByText(/아직 정리할 발화가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
            text: "가",
            role: "SUPPORTS",
          },
          {
            segmentId: "0HZX2K7M9Q4AJ",
            sequence: 11,
            startedAtMs: 1_912_000,
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
