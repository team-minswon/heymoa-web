import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteStatusBand } from "@/components/notes/note-status-band";
import { getGetAnalysisFlowQueryKey } from "@/lib/api/generated/analysis/analysis";
import type {
  MeetingAnalysisFlowResponseDataStatus,
  NoteResponseData,
} from "@/lib/api/generated/models";

// KST 10월 22일 09:00
vi.mock("@/lib/notes/use-aligned-now", () => ({
  useAlignedNow: () => Date.parse("2026-10-22T00:00:00Z"),
}));

const NOTE_ID = "01K0000000002";

function note(meetingStatus: NoteResponseData["meetingStatus"]) {
  return { noteId: NOTE_ID, meetingStatus } as NoteResponseData;
}

function seedList(client: QueryClient, pausedAt: string | null) {
  client.setQueryData(
    ["/v1/workspaces/01K0000000000/notes", { limit: 30, pages: 1 }],
    {
      status: 200,
      data: {
        success: true,
        data: {
          notes: [{ noteId: NOTE_ID, pausedAt }],
          hasMore: false,
        },
      },
    }
  );
}

function renderBand(
  client: QueryClient,
  row: NoteResponseData,
  fromMail = false
) {
  return render(
    <QueryClientProvider client={client}>
      <NoteStatusBand note={row} fromMail={fromMail} />
    </QueryClientProvider>
  );
}

describe("NoteStatusBand", () => {
  afterEach(cleanup);

  it("오래 멈춘 회의에 중지 기간만 말한다", () => {
    const client = new QueryClient();
    seedList(client, "2026-10-20T05:00:00Z");
    renderBand(client, note("PAUSED"));

    expect(screen.getByTestId("note-status-band")).toHaveTextContent(
      /^3일째 중지 상태입니다\.$/
    );
    // 버튼은 없다 — 재개는 레코더 독, 종료는 상단바가 한다.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("목록이 늦게 도착해도 띠가 선다", () => {
    const client = new QueryClient();
    renderBand(client, note("PAUSED"));
    expect(screen.queryByTestId("note-status-band")).toBeNull();

    act(() => seedList(client, "2026-10-20T05:00:00Z"));
    expect(screen.getByTestId("note-status-band")).toBeInTheDocument();
  });

  it("중지가 아니거나 오늘 멈춘 회의에는 서지 않는다", () => {
    const client = new QueryClient();
    seedList(client, "2026-10-20T05:00:00Z");
    const { unmount } = renderBand(client, note("ENDED"));
    expect(screen.queryByTestId("note-status-band")).toBeNull();
    unmount();

    const today = new QueryClient();
    seedList(today, "2026-10-21T23:00:00Z");
    renderBand(today, note("PAUSED"));
    expect(screen.queryByTestId("note-status-band")).toBeNull();
  });

  describe("메일 링크로 도착 (APP-1312)", () => {
    const band = () => screen.queryByTestId("note-status-band");

    it("여전히 중지면 기간을 몰라도 할 수 있는 일을 말한다", () => {
      renderBand(new QueryClient(), note("PAUSED"), true);
      expect(band()).toHaveTextContent(
        "중지 상태입니다. 이어서 녹음하거나 종료할 수 있습니다."
      );
    });

    it("그새 녹음이 다시 시작됐거나 회의가 끝났으면 그 사실을 말한다", () => {
      const { unmount } = renderBand(
        new QueryClient(),
        note("IN_PROGRESS"),
        true
      );
      expect(band()).toHaveTextContent(
        "메일을 보낸 뒤 녹음이 다시 시작되었습니다."
      );
      unmount();

      renderBand(new QueryClient(), note("ENDED"), true);
      expect(band()).toHaveTextContent("메일을 보낸 뒤 회의가 종료되었습니다.");
    });

    it("도착한 뒤 상태가 바뀌면 거둔다", () => {
      const client = new QueryClient();
      const view = renderBand(client, note("IN_PROGRESS"), true);
      expect(band()).toBeInTheDocument();
      view.rerender(
        <QueryClientProvider client={client}>
          <NoteStatusBand note={note("ENDED")} fromMail />
        </QueryClientProvider>
      );
      expect(band()).toBeNull();
    });

    it("목록에서 연 노트에는 도착 안내가 없다", () => {
      renderBand(new QueryClient(), note("IN_PROGRESS"));
      expect(band()).toBeNull();
    });
  });
  describe("자동 종료 (APP-1319)", () => {
    const band = () => screen.queryByTestId("note-status-band");
    const autoEnd = (
      over: Partial<NonNullable<NoteResponseData["autoEnd"]>>
    ): NoteResponseData["autoEnd"] => ({
      scheduledAt: null,
      endedBy: null,
      reason: null,
      pausedAt: null,
      pausedBusinessDays: null,
      ...over,
    });

    it("예고된 중지 회의는 일수 대신 자동 종료 예정 시각을 말한다", () => {
      const client = new QueryClient();
      seedList(client, "2026-10-20T05:00:00Z");
      renderBand(client, {
        ...note("PAUSED"),
        autoEnd: autoEnd({ scheduledAt: "2026-10-23T07:20:00Z" }),
      });
      expect(band()).toHaveTextContent(
        /^계속 중지 상태라면 10월 23일\(금\) 오후 4시 20분 이후 자동 종료될 예정입니다\.$/
      );
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("예정 시각이 없으면 약속하지 않고 노트의 중지 시각으로 일수만 말한다", () => {
      renderBand(new QueryClient(), {
        ...note("PAUSED"),
        pausedAt: "2026-10-20T05:00:00Z",
        autoEnd: null,
      });
      expect(band()).toHaveTextContent(/^3일째 중지 상태입니다\.$/);
    });

    function renderEnded(
      status: MeetingAnalysisFlowResponseDataStatus,
      fromMail = false
    ) {
      const client = new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity } },
      });
      client.setQueryData(getGetAnalysisFlowQueryKey(NOTE_ID), {
        status: 200,
        data: { success: true, data: { noteId: NOTE_ID, status, regions: [] } },
      });
      return renderBand(
        client,
        {
          ...note("ENDED"),
          autoEnd: autoEnd({
            endedBy: "SYSTEM",
            reason: "PAUSE_TIMEOUT",
            pausedBusinessDays: 3,
          }),
        },
        fromMail
      );
    }

    it.each([
      ["ANALYZING", "분석 중입니다."],
      ["REVIEWABLE", "검토할 결과가 준비되었습니다."],
      ["ANALYSIS_FAILED", "분석하지 못했습니다."],
    ] as const)(
      "자동 종료된 노트는 사유·재개 불가·분석 상태(%s)를 말한다",
      (status, copy) => {
        renderEnded(status);
        expect(band()).toHaveTextContent(
          `회의를 자동으로 종료했습니다. 마지막 중지 후 3영업일이 지나 종료했습니다. 이 회의에는 이어서 녹음할 수 없습니다. ${copy}`
        );
      }
    );

    it("접으면 첫 문장만 남는다", () => {
      renderEnded("REVIEWABLE");
      fireEvent.click(screen.getByRole("button", { name: "접기" }));
      expect(band()).toHaveTextContent(
        /^회의를 자동으로 종료했습니다\.펼치기$/
      );
    });

    it("메일로 도착해도 일반 종료 문구 대신 자동 종료 안내를 보인다", () => {
      renderEnded("ANALYZING", true);
      expect(band()).toHaveTextContent("회의를 자동으로 종료했습니다.");
      expect(band()).not.toHaveTextContent(
        "메일을 보낸 뒤 회의가 종료되었습니다."
      );
    });

    it("사람이 종료한 노트와 옛 노트에는 안내가 없다", () => {
      renderBand(new QueryClient(), { ...note("ENDED"), autoEnd: null });
      expect(band()).toBeNull();
    });
  });
});
