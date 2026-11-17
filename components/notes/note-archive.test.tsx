import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteArchive } from "@/components/notes/note-archive";

const WORKSPACE_ID = "01K0000000000";

const NOTE_META = {
  title: "2월 스프린트 회의",
  whenIso: "2026-08-25T05:02:00Z",
  participantCount: 2,
};

const data = vi.hoisted(() => ({
  segments: [] as unknown[],
  diarization: null as unknown,
  recording: undefined as unknown,
  refetched: null as unknown[] | null,
  transcriptFails: false,
  flowStatus: "REVIEWABLE" as string,
  flowRegions: [] as Array<{ region: string; status: string }>,
}));

type PollOptions = {
  query?: {
    refetchInterval?: (query: { state: { data: unknown } }) => number | false;
  };
};
const polled = vi.hoisted(() => ({
  transcript: undefined as PollOptions | undefined,
  flow: undefined as PollOptions | undefined,
}));

const spies = vi.hoisted(() => ({
  assignLabel: vi.fn(),
  assignLabelAsync: vi.fn(() => Promise.resolve({ status: 200 })),
  assignSegment: vi.fn(),
  createGuest: vi.fn(),
}));

const members = vi.hoisted(() => ({ rows: [] as unknown[] }));
const guests = vi.hoisted(() => ({ rows: [] as unknown[] }));

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/track")>()),
  track,
}));

vi.mock("@/components/notes/note-realtime-provider", () => ({
  useNoteRealtime: () => ({
    context: { state: { runs: [] } },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: () => {} }),
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNoteQueryKey: (noteId: string) => ["note", noteId],
  useCreateNoteGuestParticipant: () => ({
    mutateAsync: spies.createGuest,
    isPending: false,
  }),
}));
vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  getGetNoteTranscriptQueryKey: () => ["transcript"],
  useAssignNoteSpeaker: () => ({
    mutate: spies.assignLabel,
    mutateAsync: spies.assignLabelAsync,
    isPending: false,
  }),
  useAssignSegmentSpeaker: () => ({
    mutate: spies.assignSegment,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useGetNoteTranscript: (_noteId: string, options?: PollOptions) => {
    polled.transcript = options;
    return {
      isPending: false,
      isError: data.transcriptFails,
      refetch: () =>
        Promise.resolve({
          data: {
            status: 200,
            data: {
              success: true,
              data: {
                segments: data.refetched ?? data.segments,
                diarization: data.diarization,
              },
            },
          },
        }),
      data: data.transcriptFails
        ? undefined
        : {
            status: 200,
            data: {
              success: true,
              data: {
                segments: data.segments,
                diarization: data.diarization,
                recording: data.recording,
              },
            },
          },
    };
  },
}));
const flowEnvelope = (status: string) => ({
  status: 200,
  data: {
    success: true,
    data: { noteId: "n1", status, regions: data.flowRegions },
  },
});
vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useGetAnalysisFlow: (_noteId: string, options?: PollOptions) => {
    polled.flow = options;
    return { data: flowEnvelope(data.flowStatus) };
  },
}));
const candidateQuery =
  (rows: unknown[], key: string) =>
  (_id: string, options?: { query?: { enabled?: boolean } }) =>
    options?.query?.enabled === false
      ? { data: undefined, isPending: true, isError: false, refetch: vi.fn() }
      : {
          data: { status: 200, data: { success: true, data: { [key]: rows } } },
          isPending: false,
          isError: false,
          refetch: vi.fn(),
        };

vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  getGetWorkspaceMembersQueryKey: (id: string) => ["members", id],
  useGetWorkspaceMembers: (id: string, options?: never) =>
    candidateQuery(members.rows, "members")(id, options),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceGuestsQueryKey: (id: string) => ["guests", id],
  useGetWorkspaceGuests: (id: string, options?: never) =>
    candidateQuery(guests.rows, "guests")(id, options),
}));

describe("NoteArchive", () => {
  afterEach(() => {
    cleanup();
    data.segments = [];
    data.diarization = null;
    data.recording = undefined;
    data.transcriptFails = false;
    spies.assignLabel.mockReset();
    spies.assignLabelAsync.mockClear();
    spies.assignSegment.mockReset();
  });

  it("전사가 있으면 복사가 선다 — 탭이 없어져도 자리를 지킨다", () => {
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 3000,
        text: "배포 일정을 정합시다.",
      },
    ];
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "복사" })).toBeTruthy();

    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("복사할 전사가 없으면 버튼도 없다", () => {
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: "복사" })).toBeNull();
  });

  it("스크립트 로드 실패를 빈 아카이브가 아니라 오류·재시도로 보인다", () => {
    data.transcriptFails = true;
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );
    expect(screen.getByText("스크립트를 불러오지 못했습니다.")).toBeTruthy();
    expect(screen.queryByText("스크립트가 없습니다.")).toBeNull();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("모바일은 본문 하단 여백을 줄이고 데스크톱 독 여백은 유지한다", () => {
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );

    const content = screen.getByTestId("note-archive-content");
    expect(content.classList.contains("pb-7")).toBe(true);
    expect(content.classList.contains("sm:pb-9")).toBe(true);
    expect(content.classList.contains("lg:pb-28")).toBe(true);
    expect(content.classList.contains("pb-28")).toBe(false);
  });

  describe("맨 아래로", () => {
    function renderScrollable({ scrollTop = 0, scrollHeight = 1_000 } = {}) {
      data.segments = [
        {
          segmentId: "s1",
          transcriptionSessionId: "sess1",
          sequence: 0,
          startedAtMs: 0,
          endedAtMs: 1000,
          text: "긴 회의.",
        },
      ];
      const view = render(
        <NoteArchive
          workspaceId={WORKSPACE_ID}
          noteId="01K0000000002"
          focusSegmentId={null}
          onFocusHandled={() => {}}
        />
      );
      const viewport = view.container.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      );
      Object.defineProperties(viewport!, {
        scrollTop: { configurable: true, writable: true, value: scrollTop },
        scrollHeight: { configurable: true, value: scrollHeight },
        clientHeight: { configurable: true, value: 400 },
      });
      return { ...view, viewport: viewport! };
    }

    it("바닥에 있으면 안 보인다", () => {
      const { viewport } = renderScrollable({ scrollTop: 600 });
      fireEvent.scroll(viewport);
      expect(screen.queryByRole("button", { name: "맨 아래로" })).toBeNull();
    });

    it("위로 올리면 뜬다 — 종료된 회의라고 되돌아갈 길이 없으면 안 된다", () => {
      const { viewport } = renderScrollable({ scrollTop: 0 });
      fireEvent.scroll(viewport);
      expect(screen.getByRole("button", { name: "맨 아래로" })).toBeTruthy();
    });

    it("모바일 버튼은 콘텐츠 가까이에 두고 데스크톱에서만 독을 피한다", () => {
      const { viewport } = renderScrollable({ scrollTop: 0 });
      fireEvent.scroll(viewport);

      const overlay = screen.getByRole("button", {
        name: "맨 아래로",
      }).parentElement!;
      expect(overlay.classList.contains("bottom-4")).toBe(true);
      expect(overlay.classList.contains("lg:bottom-20")).toBe(true);
      expect(overlay.classList.contains("bottom-20")).toBe(false);
    });

    it("눌러 바닥으로 간다. 자동으로 따라가지는 않는다", () => {
      const { viewport } = renderScrollable({ scrollTop: 0 });
      fireEvent.scroll(viewport);
      fireEvent.click(screen.getByRole("button", { name: "맨 아래로" }));

      expect(viewport.scrollTop).toBe(1_000);
      expect(screen.queryByRole("button", { name: "맨 아래로" })).toBeNull();
    });
  });

  describe("요약 근거 점프", () => {
    function seedThreeSegments() {
      data.segments = [
        {
          segmentId: "s1",
          transcriptionSessionId: "sess1",
          sequence: 0,
          startedAtMs: 0,
          endedAtMs: 1000,
          text: "첫 줄.",
        },
        {
          segmentId: "s2",
          transcriptionSessionId: "sess1",
          sequence: 1,
          startedAtMs: 1200,
          endedAtMs: 2000,
          text: "둘째 줄.",
        },
        {
          segmentId: "s3",
          transcriptionSessionId: "sess1",
          sequence: 2,
          startedAtMs: 60_000,
          endedAtMs: 61_000,
          text: "셋째 줄.",
        },
        {
          segmentId: "s4",
          transcriptionSessionId: "sess1",
          sequence: 3,
          startedAtMs: 120_000,
          endedAtMs: 140_000,
          text: "넷째 줄은 아주 길어서 읽기 폭 안에서 여러 줄로 감깁니다. ".repeat(
            3
          ),
        },
      ];
    }

    const penOf = (block: Element) => {
      const style =
        block.querySelector("p > span")?.getAttribute("style") ?? "";
      const read = (name: string, unit: string) =>
        Number(
          new RegExp(`--evidence-${name}:\\s*(\\d+)${unit}`).exec(style)?.[1] ??
            NaN
        );
      return { spanEm: read("span", "em"), strokeMs: read("stroke", "ms") };
    };

    it("가리킨 발화를 그 줄에서 정확히 짚는다", () => {
      seedThreeSegments();
      render(
        <NoteArchive
          workspaceId={WORKSPACE_ID}
          noteId="01K0000000002"
          focusSegmentId="s2"
          onFocusHandled={() => {}}
        />
      );

      const rows = screen.getAllByTestId("archive-transcript-block");
      expect(rows).toHaveLength(4);
      expect(rows[1]).toHaveAttribute("data-focused", "true");
      expect(rows[0]).not.toHaveAttribute("data-focused");
      expect(rows[2]).not.toHaveAttribute("data-focused");
      expect(rows[3]).not.toHaveAttribute("data-focused");
    });

    it("형광을 글자에만 칠하고 여백은 그대로 둔다", () => {
      seedThreeSegments();
      render(
        <NoteArchive
          workspaceId={WORKSPACE_ID}
          noteId="01K0000000002"
          focusSegmentId="s2"
          onFocusHandled={() => {}}
        />
      );

      const [plain, focused] = screen.getAllByTestId(
        "archive-transcript-block"
      );
      const spacing = (node: Element) =>
        [...node.classList].filter((name) => /^-?(p|m)[xytrbl]?-/.test(name));
      expect(spacing(focused)).toEqual(spacing(plain));
      expect(focused.className).not.toContain("evidence-mark");

      const mark = focused.querySelector("p > span");
      expect(mark?.className).toContain("evidence-mark");
      expect(spacing(mark!)).toEqual([]);
      expect(plain.querySelector("p > span")?.className ?? "").not.toContain(
        "evidence-mark"
      );
    });

    it("긴 발화일수록 길게·오래 긋는다", () => {
      seedThreeSegments();
      const { unmount } = render(
        <NoteArchive
          workspaceId={WORKSPACE_ID}
          noteId="01K0000000002"
          focusSegmentId="s3"
          onFocusHandled={() => {}}
        />
      );
      const short = penOf(screen.getAllByTestId("archive-transcript-block")[2]);
      unmount();

      render(
        <NoteArchive
          workspaceId={WORKSPACE_ID}
          noteId="01K0000000002"
          focusSegmentId="s4"
          onFocusHandled={() => {}}
        />
      );
      const long = penOf(screen.getAllByTestId("archive-transcript-block")[3]);

      expect(long.spanEm).toBeGreaterThan(short.spanEm);
      expect(long.strokeMs).toBeGreaterThan(short.strokeMs);
    });

    it("하이라이트가 끝나면 focus를 비우라고 알린다", () => {
      vi.useFakeTimers();
      try {
        seedThreeSegments();
        const onFocusHandled = vi.fn();
        render(
          <NoteArchive
            workspaceId={WORKSPACE_ID}
            noteId="01K0000000002"
            focusSegmentId="s3"
            onFocusHandled={onFocusHandled}
          />
        );

        const { strokeMs } = penOf(
          screen.getAllByTestId("archive-transcript-block")[2]
        );
        vi.advanceTimersByTime(strokeMs * 2 + 1_000 - 1);
        expect(onFocusHandled).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onFocusHandled).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("짚은 발화로 포커스를 옮긴다", async () => {
      seedThreeSegments();
      render(
        <NoteArchive
          workspaceId={WORKSPACE_ID}
          noteId="01K0000000002"
          focusSegmentId="s3"
          onFocusHandled={() => {}}
        />
      );

      await waitFor(() =>
        expect(
          screen.getAllByTestId("archive-transcript-block")[2]
        ).toHaveFocus()
      );
    });

    it("focus가 없으면 아무 블록도 짚지 않는다", () => {
      seedThreeSegments();
      render(
        <NoteArchive
          workspaceId={WORKSPACE_ID}
          noteId="01K0000000002"
          focusSegmentId={null}
          onFocusHandled={() => {}}
        />
      );

      expect(
        screen
          .getAllByTestId("archive-transcript-block")
          .some((block) => block.hasAttribute("data-focused"))
      ).toBe(false);
    });
  });

  const MEMBER = {
    participantId: "01K0000000101",
    userId: "01K0000000001",
    name: "한지원",
    email: "jiwon@heymoa.com",
  };
  const GUEST = {
    participantId: "01K0000000102",
    userId: null,
    name: "박서준",
    email: null,
  };

  function seedDiarizedNote() {
    data.refetched = null;
    data.diarization = {
      status: "MAPPED",
      speakers: [
        {
          label: "A",
          speakingMs: 9000,
          segmentCount: 2,
          representativeSegmentId: "s1",
          assignedParticipantId: MEMBER.participantId,
          assignedName: MEMBER.name,
          confirmed: true,
        },
      ],
    };
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 3000,
        text: "배포 일정을 정합시다.",
        speakerLabel: "A",
        assignedParticipantId: null,
      },
      {
        segmentId: "s2",
        transcriptionSessionId: "sess1",
        sequence: 1,
        startedAtMs: 4000,
        endedAtMs: 7000,
        text: "저는 다음 주가 낫습니다.",
        speakerLabel: "A",
        assignedParticipantId: GUEST.participantId,
      },
    ];
  }

  function renderDiarized() {
    seedDiarizedNote();
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={[MEMBER, GUEST]}
      />
    );
  }

  it("개별로 지정한 발화는 그 줄만 다른 이름으로 선다", () => {
    renderDiarized();

    const chips = screen.getAllByTestId("speaker-chip");
    expect(chips[0]).toHaveTextContent("한지원");
    expect(chips[1]).toHaveTextContent("박서준");
  });

  it("개별 지정이 남은 화자에 전체 적용하면 먼저 확인한다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));

    expect(
      await screen.findByText(/개별로 지정한 발화가 1개/)
    ).toBeInTheDocument();
    expect(spies.assignLabel).not.toHaveBeenCalled();
  });

  it("확인하면 그때 전체 적용을 보낸다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: "모든 발화에 적용" })
    );

    await waitFor(() =>
      expect(spies.assignLabel).toHaveBeenCalledWith({
        noteId: "01K0000000002",
        label: "A",
        data: { participantId: MEMBER.participantId },
      })
    );
  });

  it("개별 지정이 남은 화자에 새 이름을 만들면 확인 전에는 안 만든다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.input(screen.getByRole("combobox", { name: /참석자 검색/ }), {
      target: { value: "정하윤" },
    });
    fireEvent.click(screen.getByRole("button", { name: /"정하윤" 추가/ }));

    expect(
      await screen.findByText(/개별로 지정한 발화가 1개/)
    ).toBeInTheDocument();
    expect(spies.createGuest).not.toHaveBeenCalled();
  });

  it("취소하면 아무것도 안 보낸다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));

    expect(spies.assignLabel).not.toHaveBeenCalled();
  });

  it("소속이 확인되기 전에는 만들기를 안 연다", async () => {
    seedDiarizedNote();
    render(
      <NoteArchive
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={[MEMBER, GUEST]}
      />
    );

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.input(screen.getByRole("combobox", { name: /참석자 검색/ }), {
      target: { value: "정하윤" },
    });

    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();
    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument();
  });

  it("캐시엔 없어도 다시 읽어 개별 지정을 찾아내면 확인한다", async () => {
    seedDiarizedNote();
    data.segments = (
      data.segments as { assignedParticipantId?: string | null }[]
    ).map((segment) => ({ ...segment, assignedParticipantId: null }));
    data.refetched = (data.segments as { speakerLabel?: string | null }[]).map(
      (segment, index) =>
        index === 0
          ? { ...segment, assignedParticipantId: GUEST.participantId }
          : segment
    );
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={[MEMBER, GUEST]}
      />
    );

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));

    expect(
      await screen.findByText(/개별로 지정한 발화가 1개/)
    ).toBeInTheDocument();
    expect(spies.assignLabel).not.toHaveBeenCalled();
  });

  it("개별 지정이 없는 화자는 확인 없이 바로 적용한다", async () => {
    data.refetched = null;
    data.diarization = {
      status: "MAPPED",
      speakers: [
        {
          label: "A",
          speakingMs: 3000,
          segmentCount: 1,
          representativeSegmentId: "s1",
          assignedParticipantId: null,
          assignedName: null,
          confirmed: false,
        },
      ],
    };
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 3000,
        text: "배포 일정을 정합시다.",
        speakerLabel: "A",
        assignedParticipantId: null,
      },
    ];
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={[MEMBER, GUEST]}
      />
    );

    fireEvent.click(screen.getByTestId("speaker-assign-trigger"));
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));

    await waitFor(() => expect(spies.assignLabel).toHaveBeenCalled());
    expect(screen.queryByText(/개별로 지정한 발화/)).toBeNull();
  });

  it("현재 발화에만 적용은 그 발화로 보낸다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.click(screen.getByRole("radio", { name: "현재 발화에만 적용" }));
    fireEvent.click(screen.getByRole("option", { name: /박서준/ }));

    await waitFor(() =>
      expect(spies.assignSegment).toHaveBeenCalledWith({
        noteId: "01K0000000002",
        segmentId: "s1",
        data: { participantId: GUEST.participantId },
      })
    );
    expect(spies.assignLabel).not.toHaveBeenCalled();
  });

  it("개별 지정 해제는 그 발화만 라벨로 되돌린다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[1]);
    fireEvent.click(screen.getByRole("radio", { name: "현재 발화에만 적용" }));
    fireEvent.click(screen.getByRole("button", { name: "개별 지정 해제" }));

    await waitFor(() =>
      expect(spies.assignSegment).toHaveBeenCalledWith({
        noteId: "01K0000000002",
        segmentId: "s2",
        data: { participantId: null },
      })
    );
  });

  const SILENT = {
    participantId: "01K0000000103",
    userId: "01K0000000003",
    name: "조용한 사람",
    email: "quiet@heymoa.com",
  };

  function renderPanelNote(people: unknown[] = [MEMBER, SILENT]) {
    data.refetched = null;
    data.diarization = {
      status: "MAPPED",
      speakers: [
        {
          label: "A",
          speakingMs: 3000,
          segmentCount: 1,
          representativeSegmentId: "s1",
          assignedParticipantId: MEMBER.participantId,
          assignedName: MEMBER.name,
          confirmed: true,
        },
        {
          label: "B",
          speakingMs: 1000,
          segmentCount: 1,
          representativeSegmentId: "s2",
          assignedParticipantId: null,
          assignedName: null,
          confirmed: false,
        },
        {
          label: "C",
          speakingMs: 1000,
          segmentCount: 1,
          representativeSegmentId: "s3",
          assignedParticipantId: null,
          assignedName: null,
          confirmed: true,
        },
      ],
    };
    data.segments = ["A", "B", "C"].map((label, index) => ({
      segmentId: `s${index + 1}`,
      transcriptionSessionId: "sess1",
      sequence: index,
      startedAtMs: index * 4000,
      endedAtMs: index * 4000 + 3000,
      text: `발화 ${index}`,
      speakerLabel: label,
      assignedParticipantId: null,
    }));
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={people as never}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "화자" }));
  }

  it("「미지정」을 누르면 미지정 화자를 차례로 넘긴다", async () => {
    renderPanelNote();
    fireEvent.keyDown(document.body, { key: "Escape" });

    const next = await screen.findByRole("button", { name: /미지정 2/ });
    const focusedText = () =>
      screen
        .getAllByTestId("archive-transcript-block")
        .find((block) => block.hasAttribute("data-focused"))?.textContent;

    fireEvent.click(next);
    await waitFor(() => expect(focusedText()).toContain("발화 1"));

    fireEvent.click(next);
    await waitFor(() => expect(focusedText()).toContain("발화 2"));

    fireEvent.click(next);
    await waitFor(() => expect(focusedText()).toContain("발화 1"));
  });

  it("이미 화자로 고른 사람이 후보 맨 위에 선다", () => {
    renderPanelNote([SILENT, MEMBER]);
    fireEvent.keyDown(document.body, { key: "Escape" });

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[1]);

    const names = screen
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(names[0]).toContain(MEMBER.name);
    expect(names[0]).toContain("화자 A");
  });

  it("초기화는 한 번에 하나씩 보낸다", async () => {
    let release!: () => void;
    spies.assignLabelAsync.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({ status: 200 })))
    );
    renderPanelNote();
    data.diarization = {
      status: "MAPPED",
      speakers: [
        ...(data.diarization as { speakers: unknown[] }).speakers.slice(0, 2),
        {
          label: "C",
          speakingMs: 1000,
          segmentCount: 1,
          representativeSegmentId: "s3",
          assignedParticipantId: GUEST.participantId,
          assignedName: GUEST.name,
          confirmed: true,
        },
      ],
    };

    fireEvent.click(screen.getByRole("button", { name: /전체 초기화/ }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "전체 초기화" }));

    await waitFor(() =>
      expect(spies.assignLabelAsync).toHaveBeenCalledTimes(1)
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(spies.assignLabelAsync).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() =>
      expect(spies.assignLabelAsync).toHaveBeenCalledTimes(2)
    );
  });

  it("전사를 다시 읽지 못하면 화자 도구도 내린다", () => {
    renderPanelNote();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByRole("button", { name: "화자" })).toBeTruthy();

    cleanup();
    data.transcriptFails = true;
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={[MEMBER]}
      />
    );

    expect(screen.queryByRole("button", { name: "화자" })).toBeNull();
    expect(screen.queryByRole("button", { name: /미지정/ })).toBeNull();
  });

  it("다 붙인 회의에는 「미지정」 버튼이 없다", () => {
    renderDiarized();
    expect(screen.queryByRole("button", { name: /미지정/ })).toBeNull();
  });

  it("한 마디도 안 한 참여자도 패널에 선다", () => {
    renderPanelNote();

    expect(screen.getByText("조용한 사람")).toBeTruthy();
    expect(screen.getByText("말한 기록 없음")).toBeTruthy();
  });

  it("미지정 화자가 맨 위에 선다 — 이 패널을 여는 이유가 대개 그것이다", () => {
    renderPanelNote();

    const names = screen
      .getAllByTestId("speaker-panel-row")
      .map((row) => row.textContent);
    expect(names[0]).toContain("화자 B");
    expect(names[1]).toContain("화자 C");
  });

  it("전체 초기화는 이름이 붙은 라벨에만 빈 본문을 보낸다", async () => {
    renderPanelNote();

    fireEvent.click(screen.getByRole("button", { name: /전체 초기화/ }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "전체 초기화" }));

    await waitFor(() =>
      expect(spies.assignLabelAsync).toHaveBeenCalledTimes(1)
    );
    expect(spies.assignLabelAsync).toHaveBeenCalledWith({
      noteId: "01K0000000002",
      label: "A",
      data: { participantId: null },
    });
  });

  it("초기화가 도는 동안에는 전사의 화자 지정도 잠긴다", async () => {
    let release!: () => void;
    spies.assignLabelAsync.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({ status: 200 })))
    );
    renderPanelNote();

    fireEvent.click(screen.getByRole("button", { name: /전체 초기화/ }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "전체 초기화" }));

    await waitFor(() =>
      expect(screen.queryByTestId("speaker-assign-trigger")).toBeNull()
    );

    release();
    await waitFor(() =>
      expect(
        screen.queryAllByTestId("speaker-assign-trigger").length
      ).toBeGreaterThan(0)
    );
  });

  it("도크 띠의 뒤쪽 점을 누르면 그 발화로 간다 — 녹음 길이가 짧게 와도", async () => {
    data.refetched = null;
    data.recording = { durationMs: 500_000 };
    data.diarization = {
      status: "MAPPED",
      speakers: [
        {
          label: "A",
          speakingMs: 30_000,
          segmentCount: 3,
          representativeSegmentId: "s1",
          assignedParticipantId: null,
          assignedName: null,
          confirmed: false,
        },
      ],
    };
    data.segments = [60_000, 540_000, 2_400_000].map((start, index) => ({
      segmentId: `s${index + 1}`,
      transcriptionSessionId: "sess1",
      sequence: index,
      startedAtMs: start,
      endedAtMs: start + 10_000,
      text: `발화 ${index}`,
      speakerLabel: "A",
      assignedParticipantId: null,
    }));
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={[]}
      />
    );
    const strip = screen.getByTestId("speaker-dock-strip");
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: 1000, top: 0, height: 24 }) as DOMRect;
    fireEvent.click(strip, { clientX: 995 });

    await waitFor(() => {
      const focused = screen
        .getAllByTestId("archive-transcript-block")
        .filter((block) => block.hasAttribute("data-focused"));
      expect(focused).toHaveLength(1);
      expect(focused[0].textContent).toContain("발화 2");
    });
    expect(track).toHaveBeenCalledWith("speaker_timeline_jumped", {
      workspace_id: WORKSPACE_ID,
      surface: "dock",
      via: "strip",
    });
  });

  it("형광이 남아 있어도 방금 누른 이동이 이긴다", async () => {
    data.refetched = null;
    data.diarization = {
      status: "MAPPED",
      speakers: [
        {
          label: "A",
          speakingMs: 3000,
          segmentCount: 1,
          representativeSegmentId: "s1",
          assignedParticipantId: MEMBER.participantId,
          assignedName: MEMBER.name,
          confirmed: true,
        },
        {
          label: "B",
          speakingMs: 3000,
          segmentCount: 1,
          representativeSegmentId: "s2",
          assignedParticipantId: null,
          assignedName: null,
          confirmed: false,
        },
      ],
    };
    data.segments = ["A", "B"].map((label, index) => ({
      segmentId: `s${index + 1}`,
      transcriptionSessionId: "sess1",
      sequence: index,
      startedAtMs: index * 4000,
      endedAtMs: index * 4000 + 3000,
      text: `발화 ${index}`,
      speakerLabel: label,
      assignedParticipantId: null,
    }));
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId="s1"
        onFocusHandled={() => {}}
        participants={[MEMBER]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "화자" }));

    const unassignedRow = screen
      .getAllByTestId("speaker-panel-row")
      .find((row) => row.textContent?.startsWith("화자 B"))!;
    fireEvent.click(unassignedRow.querySelector("button")!);

    await waitFor(() => {
      const focused = screen
        .getAllByTestId("archive-transcript-block")
        .filter((block) => block.hasAttribute("data-focused"));
      expect(focused).toHaveLength(1);
      expect(focused[0].textContent).toContain("발화 1");
    });
  });

  it("초기화 대상은 서버에 다시 물어 센다", async () => {
    renderPanelNote();
    data.diarization = {
      status: "MAPPED",
      speakers: [
        ...(data.diarization as { speakers: unknown[] }).speakers.slice(0, 2),
        {
          label: "C",
          speakingMs: 1000,
          segmentCount: 1,
          representativeSegmentId: "s3",
          assignedParticipantId: GUEST.participantId,
          assignedName: GUEST.name,
          confirmed: true,
        },
      ],
    };

    fireEvent.click(screen.getByRole("button", { name: /전체 초기화/ }));
    await waitFor(() =>
      expect(screen.getByRole("alertdialog").textContent).toContain("화자 2개")
    );
    fireEvent.click(screen.getByRole("button", { name: "전체 초기화" }));

    await waitFor(() =>
      expect(spies.assignLabelAsync).toHaveBeenCalledTimes(2)
    );
    expect(
      spies.assignLabelAsync.mock.calls
        .map((call) => (call as unknown as [{ label: string }])[0].label)
        .sort()
    ).toEqual(["A", "C"]);
  });

  it("다시 읽지 못하면 초기화를 멈춘다 — 실패를 「되돌릴 것 없음」으로 안 읽는다", async () => {
    renderPanelNote();
    data.transcriptFails = true;

    fireEvent.click(screen.getByRole("button", { name: /전체 초기화/ }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(spies.assignLabelAsync).not.toHaveBeenCalled();
  });

  it("되돌릴 이름이 없으면 초기화가 잠긴다", () => {
    data.refetched = null;
    data.diarization = {
      status: "MAPPED",
      speakers: [
        {
          label: "A",
          speakingMs: 3000,
          segmentCount: 1,
          representativeSegmentId: "s1",
          assignedParticipantId: null,
          assignedName: null,
          confirmed: true,
        },
      ],
    };
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 3000,
        text: "발화",
        speakerLabel: "A",
        assignedParticipantId: null,
      },
    ];
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        noteMeta={NOTE_META}
        focusSegmentId={null}
        onFocusHandled={() => {}}
        participants={[MEMBER]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "화자" }));

    expect(
      screen
        .getByRole("button", { name: /전체 초기화/ })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  describe("회의가 끝난 뒤 연 노트의 화자 분리", () => {
    const renderArchive = () =>
      render(
        <NoteArchive
          noteId="n1"
          workspaceId={WORKSPACE_ID}
          focusSegmentId={null}
          onFocusHandled={() => {}}
        />
      );
    const transcriptInterval = (status: string) =>
      polled.transcript?.query?.refetchInterval?.({
        state: {
          data: {
            status: 200,
            data: {
              success: true,
              data: { segments: [], diarization: { status, speakers: [] } },
            },
          },
        },
      }) ?? false;
    const flowInterval = (status: string) =>
      polled.flow?.query?.refetchInterval?.({
        state: { data: flowEnvelope(status) },
      }) ?? false;

    afterEach(() => {
      data.flowStatus = "REVIEWABLE";
      data.flowRegions = [];
    });

    it("화자를 나누는 동안 전사를 다시 읽는다 — 소켓 없이 열린 화면도 결과를 받는다", () => {
      data.flowStatus = "DIARIZING";
      renderArchive();

      expect(transcriptInterval("NOT_REQUESTED")).toBe(5_000);
      expect(transcriptInterval("ASSEMBLING")).toBe(5_000);
      expect(flowInterval("DIARIZING")).toBe(5_000);
    });

    it("흐름이 먼저 넘어가도 전사가 아직 분리 중이면 한 번 더 읽는다", () => {
      data.flowStatus = "ANALYZING";
      renderArchive();

      expect(transcriptInterval("SUBMITTED")).toBe(5_000);
    });

    it("요약이 먼저 끝나도 담당 영역이 대기 중이면 화자 결과를 계속 읽는다", () => {
      data.flowRegions = [{ region: "ITEM_ENRICHMENT", status: "PENDING" }];
      renderArchive();
      expect(flowInterval("REVIEWABLE")).toBe(5_000);
      expect(transcriptInterval("NOT_REQUESTED")).toBe(5_000);
      expect(transcriptInterval("MAPPED")).toBe(false);
    });

    it("분리가 끝났거나 실패했으면 멈춘다 — 지난 노트는 두드리지 않는다", () => {
      renderArchive();

      expect(transcriptInterval("MAPPED")).toBe(false);
      expect(transcriptInterval("FAILED")).toBe(false);
      expect(transcriptInterval("NOT_REQUESTED")).toBe(false);
      for (const status of [
        "NOT_APPLICABLE",
        "NOT_REQUESTED",
        "ANALYZING",
        "REVIEWABLE",
        "CONFIRMED",
      ]) {
        expect(flowInterval(status)).toBe(false);
      }
    });
  });
});
