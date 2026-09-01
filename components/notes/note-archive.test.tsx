import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteArchive } from "@/components/notes/note-archive";

// 이 테스트는 화자 후보에 멤버를 섞지 않는다 — 멤버 조회는 목이 없으면 빈 목록이라
// 후보가 이 회의의 참여자로 좁아진다. 그 자리는 아래 「워크스페이스 멤버」 테스트가 본다.
const WORKSPACE_ID = "01K0000000000";

const NOTE_META = {
  title: "2월 스프린트 회의",
  whenIso: "2026-08-25T05:02:00Z",
  participantCount: 2,
};

const data = vi.hoisted(() => ({
  segments: [] as unknown[],
  diarization: null as unknown,
  /** 다시 읽었을 때 서버가 주는 발화. `null`이면 캐시와 같은 것을 준다. */
  refetched: null as unknown[] | null,
  transcriptFails: false,
}));

const spies = vi.hoisted(() => ({
  assignLabel: vi.fn(),
  assignSegment: vi.fn(),
  createGuest: vi.fn(),
}));

/** 화자 후보에 섞이는 워크스페이스 멤버. 비우면 후보가 이 회의의 참여자로 좁아진다. */
const members = vi.hoisted(() => ({ rows: [] as unknown[] }));
/** 워크스페이스의 임시 참여자. 이 회의에 없는 사람은 **검색해야** 후보로 나온다. */
const guests = vi.hoisted(() => ({ rows: [] as unknown[] }));

// 이 파일이 보는 것은 아카이브지 실시간 배선이 아니다 — 커버리지 원장은 비워 둔다.
vi.mock("@/components/notes/note-realtime-provider", () => ({
  useNoteRealtime: () => ({
    context: { state: { appliedRanges: [] } },
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
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAssignSegmentSpeaker: () => ({
    mutate: spies.assignSegment,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useGetNoteTranscript: () => ({
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
            data: { segments: data.segments, diarization: data.diarization },
          },
        },
  }),
}));
// **`enabled` 를 지킨다.** 소속이 확인되기 전에는 조회를 안 걸어야 하는데, 목이 늘 데이터를
// 주면 화면이 「후보를 다 읽었다」로 믿어 그 규칙을 아무도 안 지킨다.
const candidateQuery = (rows: unknown[], key: string) => (
  _id: string,
  options?: { query?: { enabled?: boolean } }
) =>
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
    data.transcriptFails = false;
    spies.assignLabel.mockReset();
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

    // 공유 챗봇이 사라지며 탭도 함께 없어졌다. 「어느 탭이냐」로 가리던 것이
    // 「전사가 있느냐」 하나로 줄었다 — 아래 검사가 그 반대쪽을 본다.
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

  it("전사 로드 실패를 빈 아카이브가 아니라 오류·재시도로 보인다", () => {
    data.transcriptFails = true;
    render(
      <NoteArchive
        workspaceId={WORKSPACE_ID}
        noteId="01K0000000002"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );
    expect(screen.getByText("전사를 불러오지 못했습니다.")).toBeTruthy();
    expect(screen.queryByText("전사된 대화가 없습니다.")).toBeNull();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });


  // 탭이 나타났다 사라지면 같은 자리인지 알기 어렵다 — 비어 있어도 탭은 남기고 안내를 준다.

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

      // 정적 문서라 마운트 시 튀면 안 되고, 명령을 받았을 때만 내려간다.
      expect(viewport.scrollTop).toBe(1_000);
      expect(screen.queryByRole("button", { name: "맨 아래로" })).toBeNull();
    });
  });

  describe("요약 근거 점프", () => {
    // 세 세그먼트가 한 블록으로 묶이고 blockId는 첫 세그먼트다 — 가운데를 가리키는 DOM
    // 노드가 없으므로 `segmentIds.includes()`로 블록을 찾지 않으면 아무 데도 못 간다.
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
        // 여러 줄로 감기는 발화. 형광펜 속도가 고정이면 이 줄은 위 셋보다 오래 그어진다.
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
      // 묶기를 지운 뒤로 행이 곧 세그먼트다 — 예전에는 s2 가 s1 과 한 블록이라
      // 첫 줄이 짚혔고, 인용이 문단 어디를 가리키는지 표시할 방법이 없었다.
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

    /**
     * **형광은 글자에만 칠하고 여백은 건드리지 않는다.** 예전에는 행 배경을 통째로
     * 칠하면서 `px-3`이 함께 붙어, 도착한 줄만 글자가 12px 밀리고 아래 hairline이 24px
     * 짧아졌다 — 찾아간 자리가 도착과 동시에 움직였다.
     *
     * jsdom은 px를 못 재니 **어느 요소에 칠하는지**와 **여백 유틸리티가 붙는지**로 검사한다.
     */
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
      // 행은 짚혀도 그대로다 — 여백도 배경도.
      expect(spacing(focused)).toEqual(spacing(plain));
      expect(focused.className).not.toContain("evidence-mark");

      // 칠하는 것은 글자를 감싼 인라인 span이다.
      const mark = focused.querySelector("p > span");
      expect(mark?.className).toContain("evidence-mark");
      // 인라인 여백은 첫 글자를 밀기 때문에 쓰지 않는다.
      expect(spacing(mark!)).toEqual([]);
      expect(plain.querySelector("p > span")?.className ?? "").not.toContain(
        "evidence-mark"
      );
    });

    /**
     * **펜 속도가 고정이고 시간이 길이를 따라간다.** 어느 줄이든 같은 시간에 그으면 긴
     * 발화에서는 펜이 몇 배 빨리 지나가고 짧은 발화에서는 기어가서, 같은 표시가 줄마다
     * 다른 물건으로 보인다. 표시의 수명도 그만큼 길어지고 짧아진다.
     */
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

      // 펜이 지나갈 길이도, 그 시간도 길이를 따라간다 — 속도는 그대로다.
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

        // 수명은 **긋기 + 머물기 + 지우기**다. 획이 다 지워지기 전에 비우면 표시가
        // 중간에 끊기고, 늦게 비우면 다 지워진 자리가 남는다.
        const { strokeMs } = penOf(
          screen.getAllByTestId("archive-transcript-block")[2]
        );
        vi.advanceTimersByTime(strokeMs * 2 + 1_500 - 1);
        expect(onFocusHandled).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        // 안 비우면 전사 탭을 다시 열 때마다 같은 자리로 끌려간다.
        expect(onFocusHandled).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    /**
     * **각주를 따라가는 일이 눈에만 일어나면 안 된다.** 인용 버튼은 탭이 바뀌며 사라지고
     * 포커스는 `<body>`로 떨어지므로, 보지 않는 사람에게는 화면만 바뀌고 아무 일도 안
     * 일어난 것이 된다. 도착한 발화를 포커스로 잡아야 그 줄이 읽히고 다음 Tab도 거기서
     * 이어진다.
     */
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

      // 스크롤·포커스는 다음 프레임에 일어난다(목록이 아직 자라는 중이라서).
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

  // ── 화자 지정 범위 ──────────────────────────────────────────────────────────

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

  /** 화자 A 는 한지원. 두 발화 중 뒤쪽 한 줄만 박서준으로 개별 지정돼 있다. */
  function seedDiarizedNote() {
    // 다시 읽기는 기본으로 캐시와 같은 것을 준다 — 그 차이를 보는 테스트만 따로 세운다.
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
          assignedUserId: MEMBER.userId,
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

  /** 라벨은 한지원인데 그 줄만 박서준이다 — 이 기능이 보이는 자리다. */
  it("개별로 지정한 발화는 그 줄만 다른 이름으로 선다", () => {
    renderDiarized();

    const chips = screen.getAllByTestId("speaker-chip");
    expect(chips[0]).toHaveTextContent("한지원");
    expect(chips[1]).toHaveTextContent("박서준");
  });

  /**
   * **말없이 사라지면 「분명 고쳤는데」가 된다.** 서버는 어차피 지우지만, 그 몇 줄은
   * 사람이 콕 집어 고쳐 둔 것이라 누르기 전에 말해야 한다.
   */
  it("개별 지정이 남은 화자에 전체 적용하면 먼저 확인한다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));

    expect(
      await screen.findByText(/개별로 지정한 발화가 1개/)
    ).toBeInTheDocument();
    // 확인 전에는 아무것도 안 보낸다
    expect(spies.assignLabel).not.toHaveBeenCalled();
  });

  it("확인하면 그때 전체 적용을 보낸다", async () => {
    renderDiarized();

    fireEvent.click(screen.getAllByTestId("speaker-assign-trigger")[0]);
    fireEvent.click(screen.getByRole("option", { name: /한지원/ }));
    fireEvent.click(await screen.findByRole("button", { name: "모든 발화에 적용" }));

    await waitFor(() =>
      expect(spies.assignLabel).toHaveBeenCalledWith({
        noteId: "01K0000000002",
        label: "A",
        data: { participantId: MEMBER.participantId },
      })
    );
  });

  /**
   * **만들기가 확인보다 앞서면 취소가 취소가 아니다.** 임시 참여자와 참여 기록은 이미
   * 영구히 생긴 뒤라, 사람은 취소했는데 워크스페이스에 이름이 하나 남는다.
   */
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

  /**
   * **캐시로 세면 남의 수정을 못 본다.** 종료된 전사는 마운트할 때만 당기므로, 다른 사람이
   * 그 사이 발화 하나를 고쳤으면 여기서는 0으로 보인다 — 그대로 보내면 서버가 **경고 없이**
   * 그 지정을 지운다. 0으로 보일 때 한 번 더 읽는 이유다.
   */
  /**
   * **URL 의 워크스페이스로 후보를 세우면 안 된다.** `/w/B/notes/<A의 노트>` 로 들어오면
   * 소속이 확인되기 전인데, 그때 B 의 멤버를 후보로 세우면 고르는 순간 422 로 거절되고
   * A 에 이미 있는 사람을 못 찾아 **동명이인을 또 만든다.**
   */
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
    // 캐시에는 개별 지정이 없다
    data.segments = (data.segments as { assignedParticipantId?: string | null }[]).map(
      (segment) => ({ ...segment, assignedParticipantId: null })
    );
    // 그런데 서버는 하나 갖고 있다
    data.refetched = (data.segments as { speakerLabel?: string | null }[]).map(
      (segment, index) =>
        index === 0 ? { ...segment, assignedParticipantId: GUEST.participantId } : segment
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

    expect(await screen.findByText(/개별로 지정한 발화가 1개/)).toBeInTheDocument();
    expect(spies.assignLabel).not.toHaveBeenCalled();
  });

  /** 지울 개별 지정이 없으면 확인이 끼어들 이유가 없다. */
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
          assignedUserId: null,
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

    // **개별 지정이 0으로 보이면 전사를 다시 읽고 나서 보낸다** — 캐시가 남의 수정을 못 봤을
    // 수 있어서다. 그래서 여기도 기다린다.
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
    // 라벨은 안 건드린다
    expect(spies.assignLabel).not.toHaveBeenCalled();
  });

  it("개별 지정 해제는 그 발화만 라벨로 되돌린다", async () => {
    renderDiarized();

    // 두 번째 줄이 개별 지정된 발화다
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
});
