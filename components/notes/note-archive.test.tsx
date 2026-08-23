import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteArchive } from "@/components/notes/note-archive";

const data = vi.hoisted(() => ({
  segments: [] as unknown[],
  messages: [] as unknown[],
  transcriptFails: false,
  chatFails: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: () => {} }),
}));
vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  getGetNoteTranscriptQueryKey: () => ["transcript"],
  useAssignNoteSpeaker: () => ({ mutate: () => {}, isPending: false }),
  useGetNoteTranscript: () => ({
    isPending: false,
    isError: data.transcriptFails,
    refetch: () => {},
    data: data.transcriptFails
      ? undefined
      : {
          status: 200,
          data: { success: true, data: { segments: data.segments } },
        },
  }),
}));
vi.mock("@/lib/api/generated/note-shared-chat/note-shared-chat", () => ({
  useGetNoteSharedChatMessages: () => ({
    isError: data.chatFails,
    refetch: () => {},
    data: data.chatFails
      ? undefined
      : {
          status: 200,
          data: {
            success: true,
            data: { chatId: "c", messages: data.messages, lock: null },
          },
        },
  }),
}));

describe("NoteArchive", () => {
  afterEach(() => {
    cleanup();
    data.segments = [];
    data.messages = [];
    data.transcriptFails = false;
    data.chatFails = false;
  });

  it("전사와 공유 Q&A를 함께 병치한다", () => {
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
    data.messages = [
      {
        messageId: "u1",
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "결정된 것만 정리해줘",
        authorName: "홍길동",
        toolEvent: null,
      },
      {
        messageId: "a1",
        createdAt: "2026-07-24T00:00:01Z",
        role: "ASSISTANT",
        content: "배포는 금요일로 정했습니다.",
        authorName: null,
        toolEvent: null,
      },
    ];
    render(
      <NoteArchive
        noteId="01K0000000002"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );

    // 전사와 Q&A는 세그먼트로 갈라 한 번에 하나만 보인다.
    expect(screen.getByText("배포 일정을 정합시다.")).toBeTruthy();
    expect(screen.queryByText("결정된 것만 정리해줘")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "회의 중 챗봇" }));

    expect(screen.getByText("결정된 것만 정리해줘")).toBeTruthy();
    expect(screen.getByText("배포는 금요일로 정했습니다.")).toBeTruthy();
    expect(screen.getByText("홍길동")).toBeTruthy();
    expect(screen.queryByText("배포 일정을 정합시다.")).toBeNull();
  });

  it("전사 로드 실패를 빈 아카이브가 아니라 오류·재시도로 보인다", () => {
    data.transcriptFails = true;
    render(
      <NoteArchive
        noteId="01K0000000002"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );
    expect(screen.getByText("전사를 불러오지 못했습니다.")).toBeTruthy();
    expect(screen.queryByText("전사된 대화가 없습니다.")).toBeNull();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("Q&A 로드 실패를 빈 섹션으로 삼키지 않는다", () => {
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 1000,
        text: "회의 내용.",
      },
    ];
    data.chatFails = true;
    render(
      <NoteArchive
        noteId="01K0000000002"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "회의 중 챗봇" }));
    expect(screen.getByText("챗봇 대화를 불러오지 못했습니다.")).toBeTruthy();
    // 전사 실패와 같은 재시도 경로를 준다.
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  // 탭이 나타났다 사라지면 같은 자리인지 알기 어렵다 — 비어 있어도 탭은 남기고 안내를 준다.
  it("공유 Q&A가 없어도 탭은 남기고 빈 안내를 보인다", () => {
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 1000,
        text: "짧은 회의.",
      },
    ];
    render(
      <NoteArchive
        noteId="01K0000000002"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    );
    expect(screen.getByText("짧은 회의.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "회의 중 챗봇" }));

    expect(
      screen.getByText("회의 중 챗봇에 물어본 내용이 없습니다.")
    ).toBeTruthy();
  });

  it("모바일은 본문 하단 여백을 줄이고 데스크톱 독 여백은 유지한다", () => {
    render(
      <NoteArchive
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
          noteId="01K0000000002"
          focusSegmentId="s3"
          onFocusHandled={() => {}}
        />
      );
      const short = penOf(screen.getAllByTestId("archive-transcript-block")[2]);
      unmount();

      render(
        <NoteArchive
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
});
