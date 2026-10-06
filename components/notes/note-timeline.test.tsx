import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteTimeline } from "@/components/notes/note-timeline";
import {
  initialContextState,
  type ContextState,
  type ProposalHead,
} from "@/lib/notes/proposals/reducer";

const realtime = vi.hoisted(() => ({
  noteId: "01K0000000005",
  transcript: { finalSegments: [] as Array<{ segmentId: string; sequence: number; startedAtMs: number; endedAtMs: number; text: string; speakerLabel: string | null; assignedParticipantId?: string | null }> },
  context: {
    cards: [],
    state: null as unknown,
    loading: false,
    failed: false,
    retry: () => {},
  },
}));
vi.mock("@/components/notes/note-realtime-provider", () => ({
  useNoteRealtime: () => realtime,
}));
const own = vi.hoisted(() => ({ activeNoteId: null as string | null, session: null, finalSegments: [] }));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => own,
  useRecordingTranscript: () => own,
}));
vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useGetAnalysisFlow: () => ({ data: undefined }),
}));
const live = vi.hoisted(() => ({
  partial: null as { confirmedText: string; pendingText: string } | null,
}));
vi.mock("@/components/notes/use-live-partial", () => ({
  useLivePartial: () => live.partial,
}));

const transcript = vi.hoisted(() => ({
  real: false,
  data: undefined as unknown,
  isError: false,
  refetch: vi.fn(),
}));
vi.mock("@/lib/api/generated/transcription/transcription", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/generated/transcription/transcription")>();
  return {
    ...actual,
    useGetNoteTranscript: (noteId: string, options?: Parameters<typeof actual.useGetNoteTranscript>[1]) =>
      transcript.real ? actual.useGetNoteTranscript(noteId, options) : transcript,
  };
});

let seq = 0;
function head(over: Partial<ProposalHead> & { atMs?: number }): ProposalHead {
  seq += 1;
  const { atMs = seq * 60_000, ...rest } = over;
  return {
    proposalId: `0HZX2K7M9Q${String(seq).padStart(3, "0")}`,
    revision: 1,
    operation: "CREATE",
    kind: "DECISION",
    status: "OPEN",
    closeReason: null,
    revisionSource: "LIVE",
    content: `후보 ${seq}`,
    createdSequence: seq * 10,
    lastEvidenceSequence: seq * 10,
    aiSemanticRevisionCount: 0,
    resolvesProposalId: null,
    citations: [
      {
        segmentId: `0HZX2K7M9S${String(seq).padStart(3, "0")}`,
        sequence: seq * 10,
        startedAtMs: atMs,
        endedAtMs: atMs + 3_000,
        text: `발화 ${seq}`,
        role: "SUPPORTS",
      },
    ],
    ...rest,
  };
}

function withLedger(...proposals: ProposalHead[]) {
  const state: ContextState = {
    ...initialContextState,
    proposals: Object.fromEntries(proposals.map((p) => [p.proposalId, p])),
  };
  realtime.context = { ...realtime.context, state, loading: false, failed: false };
}

afterEach(() => {
  cleanup();
  realtime.transcript.finalSegments = [];
  transcript.real = false;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  transcript.data = undefined;
  transcript.isError = false;
  live.partial = null;
  realtime.noteId = "01K0000000005";
  realtime.context = { ...realtime.context, loading: false, failed: false };
});

describe("NoteTimeline", () => {
  it("안건 머리 아래 항목이 시각·유형과 함께 서고, 시각을 누르면 그 발화로 간다", () => {
    const agenda = head({ kind: "AGENDA", content: "MongoDB 도입 검토", atMs: 242_000 });
    const decision = head({
      kind: "DECISION",
      content: "경로 데이터 저장소는 MongoDB를 사용한다",
      atMs: 1_872_000,
    });
    withLedger(agenda, decision);
    const onEvidenceSelect = vi.fn();
    render(
      <NoteTimeline header={null} onEvidenceSelect={onEvidenceSelect} recording />
    );

    // 안건 머리의 시간 구간이 안건의 첫 발화로 가는 길이다.
    const range = screen.getByRole("button", { name: "스크립트 04:02로 가기" });
    expect(range).toHaveTextContent("04:02 – 지금");
    fireEvent.click(range);
    expect(onEvidenceSelect).toHaveBeenCalledWith(agenda.citations[0].segmentId);
    expect(screen.getByText("논의 중")).toBeVisible();
    expect(screen.getByText("경로 데이터 저장소는 MongoDB를 사용한다")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "스크립트 31:12로 가기" }));
    expect(onEvidenceSelect).toHaveBeenCalledWith(decision.citations[0].segmentId);
  });

  it("기록 중이 아니면 마지막 안건을 「논의 중」이라 하지 않는다", () => {
    withLedger(head({ kind: "AGENDA", content: "다음 스프린트 범위" }), head({}));
    render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);
    expect(screen.queryByText("논의 중")).toBeNull();
  });

  it("공간이 열린 뒤 근거에 접근할 수 있고 다시 펼쳐도 전사 이동이 유지된다", async () => {
    const proposal = head({ content: "비교 실험을 진행한다" });
    withLedger(proposal);
    const onEvidenceSelect = vi.fn();
    render(<NoteTimeline header={null} onEvidenceSelect={onEvidenceSelect} />);
    const toggle = screen.getByRole("button", { name: /비교 실험을 진행한다/ });
    const details = document.getElementById(
      toggle.getAttribute("aria-controls")!
    )!;
    // 첫 펼침 전에는 전사 DOM을 만들지 않는다.
    expect(within(details).queryByText(proposal.citations[0].text)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(details).not.toHaveAttribute("inert");
    expect(within(details).queryByRole("button")).toBeNull();
    // 펼침이 끝나기 전에 접었다 다시 열어도 이전 완료 신호가 내용을 남기지 않는다.
    fireEvent.click(toggle);
    expect(details).toHaveAttribute("inert");
    fireEvent.click(toggle);
    await within(details).findByRole("button");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(details).toHaveAttribute("inert");
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(within(details).queryByRole("button")).toBeNull();
    fireEvent.click(toggle);
    expect(within(details).queryByRole("button")).toBeNull();
    fireEvent.click(await within(details).findByRole("button"));
    expect(onEvidenceSelect).toHaveBeenCalledWith(
      proposal.citations[0].segmentId
    );
  });

  it("항목을 펼치면 근거와 답 관계가 보이고, 관계를 누르면 그 항목이 펼쳐진다", async () => {
    const question = head({
      kind: "QUESTION",
      status: "CLOSED",
      closeReason: "RESOLVED",
      content: "인덱스를 줄이면 조회 손해가 얼마나 되나",
      atMs: 620_000,
    });
    const answer = head({
      kind: "DECISION",
      operation: "RESOLVE",
      resolvesProposalId: question.proposalId,
      content: "읽기 전용 복제본은 세 대로 시작한다",
      atMs: 2_400_000,
    });
    withLedger(question, answer);
    render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);

    // 답한 질문은 언제 답했는지를 말한다.
    expect(screen.getByText("40:00에 답함")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /인덱스를 줄이면/ }));
    const details = document.getElementById(
      `timeline-item-${question.proposalId}-details`
    )!;
    await waitFor(() =>
      expect(within(details).getByText(question.citations[0].text)).toBeVisible()
    );

    fireEvent.click(within(details).getByRole("button", { name: /^답/ }));
    expect(
      document.getElementById(`timeline-item-${answer.proposalId}-details`)
    ).not.toBeNull();
  });

  it("골라 본 상태에서 관계를 눌러도 목록이 선 뒤 그 항목으로 간다", async () => {
    const question = head({
      kind: "QUESTION",
      status: "CLOSED",
      closeReason: "RESOLVED",
      content: "인덱스를 줄이면 조회 손해가 얼마나 되나",
    });
    const answer = head({
      kind: "DECISION",
      operation: "RESOLVE",
      resolvesProposalId: question.proposalId,
      content: "읽기 전용 복제본은 세 대로 시작한다",
    });
    withLedger(question, answer);
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    try {
      render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "결정 1" }));
      fireEvent.click(screen.getByRole("button", { name: /읽기 전용 복제본은/ }));
      const details = document.getElementById(
        `timeline-item-${answer.proposalId}-details`
      )!;
      fireEvent.click(await within(details).findByRole("button", { name: /답한 질문/ }));

      await waitFor(() =>
        expect(scrolled).toContain(`timeline-item-${question.proposalId}`)
      );
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("골라 보기는 그 유형만 남기고 칩에 전체에서 센 개수를 단다", () => {
    withLedger(head({ kind: "DECISION", content: "결정 하나" }), head({ kind: "ISSUE", content: "이슈 하나" }));
    render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "열린 질문 1" }));
    expect(screen.queryByText("결정 하나")).toBeNull();
    expect(screen.getByText("이슈 하나")).toBeVisible();
    expect(screen.getByRole("button", { name: "결정 1" })).toBeVisible();
  });

  it("조회 중 · 실패 · 없음을 서로 다르게 그린다", () => {
    realtime.context = { ...realtime.context, state: initialContextState, loading: true };
    const { unmount } = render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);
    expect(screen.getByRole("list", { name: "타임라인을 불러오는 중" })).toBeVisible();
    expect(screen.getByLabelText("타임라인 제목 불러오는 중")).toBeVisible();
    expect(screen.getByRole("list", { name: "타임라인을 불러오는 중" }).closest('[aria-busy]')).toHaveAttribute("aria-busy", "true");
    // 첫 snapshot 전에는 개수를 말하지 않는다.
    expect(screen.getByRole("button", { name: "전체" })).toBeVisible();
    unmount();

    realtime.context = { ...realtime.context, loading: false, failed: true };
    const failed = render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);
    expect(screen.getByText("타임라인을 불러오지 못했습니다.")).toBeVisible();
    expect(screen.queryByLabelText("타임라인 제목 불러오는 중")).not.toBeInTheDocument();
    failed.unmount();

    withLedger();
    render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} meetingEnded />);
    expect(screen.getByText("이 회의에서 정리된 항목이 없습니다.")).toBeVisible();
  });

  it("놓친 변경이 있으면 목록을 두고 다시 맞출 길을 보인다", () => {
    withLedger(head({ content: "남은 결정" }));
    const retry = vi.fn();
    realtime.context = {
      ...realtime.context,
      state: { ...(realtime.context.state as ContextState), needsRefetch: true },
      retry,
    };
    render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);

    expect(screen.getByText("남은 결정")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("놓친 변경이 있어");
    fireEvent.click(screen.getByRole("button", { name: "다시 맞추기" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("철회된 질문은 열린 질문에 세지 않고 답을 기다린다고 하지 않는다", () => {
    withLedger(
      head({ kind: "QUESTION", status: "CLOSED", closeReason: "RETRACTED", content: "취소된 질문" })
    );
    render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "열린 질문 0" })).toBeVisible();
    expect(screen.getByText("철회됨")).toBeVisible();
    expect(screen.queryByText("답을 기다리는 중")).toBeNull();
  });

  it("받아 적는 중인 발화를 끝에 보이고 화자 칸을 두지 않는다", () => {
    withLedger(head({}));
    live.partial = { confirmedText: "그러면 다음 주에", pendingText: " runbook 초안 보고" };
    render(<NoteTimeline header={null} onEvidenceSelect={vi.fn()} recording />);
    expect(screen.getByText("받아 적는 중")).toBeVisible();
    expect(screen.getByText("그러면 다음 주에")).toBeVisible();
  });

  it("문서 머리에 제목과 시각·인원·프로젝트 칩을 단다", () => {
    withLedger();
    render(
      <NoteTimeline
        header={{
          title: "주간 개발 회의",
          whenIso: "2026-10-03T05:00:00Z",
          whenLabel: "10월 3일 오후 2:00",
          participantCount: 4,
          projectName: "경로 서비스 리뉴얼",
        }}
        onEvidenceSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "주간 개발 회의" })).toBeVisible();
    expect(screen.getByText("4명")).toBeVisible();
    expect(screen.getByText("경로 서비스 리뉴얼")).toBeVisible();
  });
});

describe("타임라인의 맨 아래로 버튼", () => {
  function metrics(viewport: HTMLElement, top: number, height = 2000) {
    Object.defineProperties(viewport, {
      scrollTop: { configurable: true, writable: true, value: top },
      scrollHeight: { configurable: true, value: height },
      clientHeight: { configurable: true, value: 500 },
    });
    fireEvent.scroll(viewport);
  }

  it("완료된 긴 목록도 위에서 읽으면 화살표만 보이고 누르면 아래로 이동합니다", () => {
    withLedger(head({ content: "끝난 회의 항목" }));
    const { container } = render(
      <NoteTimeline header={null} onEvidenceSelect={() => {}} meetingEnded />
    );
    const viewport = container.querySelector<HTMLElement>(
      "[data-slot=scroll-area-viewport]"
    )!;
    metrics(viewport, 1500);
    expect(
      screen.queryByRole("button", { name: "맨 아래로" })
    ).not.toBeInTheDocument();
    metrics(viewport, 200);
    const arrow = screen.getByRole("button", { name: "맨 아래로" });
    expect(arrow.textContent).toBe("");
    expect(arrow.parentElement).toHaveClass("lg:bottom-20");
    fireEvent.click(arrow);
    expect(viewport.scrollTop).toBe(1500);
    expect(
      screen.queryByRole("button", { name: "맨 아래로" })
    ).not.toBeInTheDocument();
  });

  it("위를 읽을 때 새 전사는 위치를 유지하고 화살표로 돌아온 뒤에는 새 내용을 추종합니다", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
    const flush = () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
    };
    try {
      withLedger(head({ content: "진행 중 항목" }));
      const view = () => (
        <NoteTimeline header={null} onEvidenceSelect={() => {}} recording />
      );
      const { container, rerender } = render(view());
      const viewport = container.querySelector<HTMLElement>(
        "[data-slot=scroll-area-viewport]"
      )!;
      metrics(viewport, 1500);
      flush();
      metrics(viewport, 200);
      live.partial = { confirmedText: "", pendingText: "새로운 발화" };
      rerender(view());
      flush();
      expect(viewport.scrollTop).toBe(200);
      fireEvent.click(screen.getByRole("button", { name: "맨 아래로" }));
      expect(viewport.scrollTop).toBe(1500);
      Object.defineProperty(viewport, "scrollHeight", {
        configurable: true,
        value: 2400,
      });
      live.partial = { confirmedText: "", pendingText: "계속되는 발화" };
      rerender(view());
      flush();
      expect(viewport.scrollTop).toBe(1900);
      expect(
        screen.queryByRole("button", { name: "맨 아래로" })
      ).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

it("조회와 reducer 적용을 기다린 첫 목록만 최신으로 가고 뒤의 갱신은 읽기 위치를 지킵니다", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  };
  try {
    withLedger();
    realtime.context.loading = true;
    const view = () => (
      <NoteTimeline header={null} onEvidenceSelect={() => {}} meetingEnded />
    );
    const { container, rerender } = render(view());
    const viewport = container.querySelector<HTMLElement>(
      "[data-slot=scroll-area-viewport]"
    )!;
    Object.defineProperties(viewport, {
      scrollTop: { configurable: true, writable: true, value: 0 },
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 500 },
    });
    realtime.context.loading = false;
    rerender(view());
    flush();
    expect(viewport.scrollTop).toBe(0);
    const initial = head({ content: "첫 유효 항목" });
    withLedger(initial);
    rerender(view());
    flush();
    expect(viewport.scrollTop).toBe(1500);
    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);
    withLedger(initial, head({ content: "뒤에 추가된 항목" }));
    rerender(view());
    flush();
    expect(viewport.scrollTop).toBe(200);
    fireEvent.click(screen.getByText("첫 유효 항목").closest("button")!);
    flush();
    expect(viewport.scrollTop).toBe(200);
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each([true, false])("빈 snapshot 또는 조회 중(%s) 잠정 전사를 위에서 읽으면 첫 항목도 위치를 지킵니다", (loading) => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  };
  try {
    withLedger();
    realtime.context.loading = loading;
    live.partial = {
      confirmedText: "",
      pendingText: "조회 중에도 기록하는 글자",
    };
    const view = () => (
      <NoteTimeline header={null} onEvidenceSelect={() => {}} recording />
    );
    const { container, rerender } = render(view());
    const viewport = container.querySelector<HTMLElement>(
      "[data-slot=scroll-area-viewport]"
    )!;
    Object.defineProperties(viewport, {
      scrollTop: { configurable: true, writable: true, value: 0 },
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 500 },
    });
    flush();
    expect(viewport.scrollTop).toBe(1500);
    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);
    live.partial = {
      confirmedText: "",
      pendingText: "위를 읽는 동안 바뀐 글자",
    };
    rerender(view());
    flush();
    expect(viewport.scrollTop).toBe(200);
    // query 성공과 reducer 적용이 따로 커밋되어도 읽는 의도가 먼저다.
    realtime.context.loading = false;
    rerender(view());
    flush();
    withLedger(head({ content: "처음 도착한 타임라인 항목" }));
    rerender(view());
    flush();
    expect(viewport.scrollTop).toBe(200);
    expect(screen.getByRole("button", { name: "맨 아래로" })).toBeVisible();
    // 같은 컴포넌트로 A→B→A를 방문해도 이전 방문의 읽기 의도는 남지 않는다.
    realtime.noteId = "01K0000000006";
    rerender(view());
    flush();
    expect(viewport.scrollTop).toBe(1500);
    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);
    realtime.noteId = "01K0000000005";
    rerender(view());
    flush();
    expect(viewport.scrollTop).toBe(1500);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("근거는 현재 화자 지정·개별 지정·초기화를 따르고 없는 구간도 이동합니다", async () => {
  const proposal = head({ content: "근거의 화자 확인" });
  const missing = {
    ...proposal.citations[0],
    segmentId: "0HZX2K7M9S999",
    text: "없는 전사 근거",
  };
  proposal.citations.push(missing);
  withLedger(proposal);
  const data = {
    diarization: {
      status: "MAPPED",
      speakers: [
        { label: "A", assignedParticipantId: "person1", confirmed: true },
      ],
    },
    segments: [
      {
        segmentId: proposal.citations[0].segmentId,
        speakerLabel: "A",
        assignedParticipantId: null as string | null,
      },
    ],
  };
  transcript.real = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const key = getGetNoteTranscriptQueryKey(realtime.noteId);
  const payload = () => ({ success: true, data });
  client.setQueryData(key, { status: 200, data: structuredClone(payload()) });
  const fetch = vi.fn(async () => new Response(JSON.stringify(payload()), {
    status: 200, headers: { "Content-Type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetch);
  const refresh = () => act(async () => { await client.invalidateQueries({ queryKey: key }); });
  const onEvidenceSelect = vi.fn();
  const view = () => (
    <NoteTimeline
      header={null}
      participants={[
        { participantId: "person1", name: "민수" },
        { participantId: "person2", name: "지원" },
      ]}
      onEvidenceSelect={onEvidenceSelect}
    />
  );
  const { rerender } = render(<QueryClientProvider client={client}>{view()}</QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: /근거의 화자 확인/ }));
  const details = document.getElementById(
    `timeline-item-${proposal.proposalId}-details`
  )!;
  const evidence = await within(details).findByRole("button", {
    name: new RegExp(proposal.citations[0].text),
  });
  expect(within(evidence).getByTestId("speaker-chip")).toHaveTextContent(
    "민수"
  );
  expect(fetch).not.toHaveBeenCalled();
  data.segments[0].assignedParticipantId = "person2";
  await refresh();
  await waitFor(() => expect(within(evidence).getByTestId("speaker-chip")).toHaveTextContent("지원"));
  data.segments[0].assignedParticipantId = null;
  data.diarization.speakers[0].assignedParticipantId = "person2";
  await refresh();
  await waitFor(() => expect(within(evidence).getByTestId("speaker-chip")).toHaveTextContent("지원"));
  data.diarization.speakers = [];
  await refresh();
  await waitFor(() => expect(within(evidence).getByTestId("speaker-chip")).toHaveTextContent("화자 A"));
  fireEvent.click(
    within(details).getByRole("button", { name: /없는 전사 근거/ })
  );
  expect(onEvidenceSelect).toHaveBeenCalledWith(missing.segmentId);
  expect(within(details).getAllByTestId("speaker-chip")).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(3);
  realtime.transcript.finalSegments = [{
    segmentId: missing.segmentId, sequence: 99, startedAtMs: 10, endedAtMs: 20,
    text: missing.text, speakerLabel: "B",
  }];
  rerender(<QueryClientProvider client={client}>{view()}</QueryClientProvider>);
  expect(within(details).getByText("화자 B")).toBeVisible();
  // 저장본 지정이 실시간 사본의 라벨보다 우선한다.
  realtime.transcript.finalSegments.push({
    ...realtime.transcript.finalSegments[0], segmentId: proposal.citations[0].segmentId, speakerLabel: "C",
  });
  rerender(<QueryClientProvider client={client}>{view()}</QueryClientProvider>);
  expect(within(evidence).getByTestId("speaker-chip")).toHaveTextContent("화자 A");
  // 분리 중에는 다시 읽고, 완료 뒤에는 폴링을 멈춘다. 실제 대기 대신 Query 타이머만 진행한다.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  data.diarization.status = "SUBMITTED";
  await refresh();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
  data.diarization.status = "MAPPED";
  data.diarization.speakers = [{ label: "A", assignedParticipantId: "person1", confirmed: true }];
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  await waitFor(() => expect(within(evidence).getByTestId("speaker-chip")).toHaveTextContent("민수"));
  expect(fetch).toHaveBeenCalledTimes(5);
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(fetch).toHaveBeenCalledTimes(5);
  client.clear();
});
