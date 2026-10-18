import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MeetingRelations } from "@/components/notes/review/meeting-relations";
import { indexMeetingLinks } from "@/lib/notes/review/meeting-links";
import type {
  ProjectMeetingLinksResponseData,
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";

afterEach(cleanup);

const data: ProjectMeetingLinksResponseData = {
  notes: [],
  agendaLinks: [],
  meetingLinks: [],
  conflicts: [
    {
      kind: "CANCELS",
      reason: "추가 조사를 진행하지 않기로 명시했습니다.",
      evidenceSequences: [12],
      source: {
        noteId: "now",
        proposalId: "p1",
        revision: 1,
        proposalKind: "DECISION",
        content: "추가 조사를 중단한다",
      },
      target: {
        type: "APPROVED",
        itemId: "approved",
        revision: 3,
        proposalKind: "ACTION_ITEM",
        content: "추가 조사 진행",
      },
    },
  ],
};

it("취소 관계의 승격 대상·정확한 판·이유와 원문 이동을 보여 준다", () => {
  const select = vi.fn(),
    openScript = vi.fn();
  const { relations } = indexMeetingLinks(data, "now", [
    { itemId: "i1", originalProposalRef: { proposalId: "p1", revision: 1 } },
  ]);
  render(
    <MeetingRelations
      relations={relations}
      status="SUCCEEDED"
      unavailable={false}
      loading={false}
      failed={false}
      onRetry={vi.fn()}
      onSelectItem={select}
      onOpenScript={openScript}
      segments={[
        {
          segmentId: "s12",
          sequence: 12,
          startedAtMs: 65_000,
          text: "조사를 하지 않겠습니다.",
        } as TranscriptResponseDataSegmentsItem,
      ]}
    />
  );
  expect(screen.getByText("취소")).toBeInTheDocument();
  expect(screen.getByText("프로젝트 확정 항목")).toBeInTheDocument();
  expect(screen.getByText("판 3")).toBeInTheDocument();
  expect(screen.getByText(data.conflicts[0].reason)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /관계 출발 항목 보기/ }));
  expect(select).toHaveBeenCalledWith("i1");
  fireEvent.click(
    screen.getByRole("button", { name: "01:05 · 조사를 하지 않겠습니다." })
  );
  expect(openScript).toHaveBeenCalledWith("s12");
  expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
});

it.each(["PENDING", "FAILED", "SKIPPED", undefined] as const)(
  "%s를 성공한 빈 결과로 표시하지 않는다",
  (status) => {
    render(
      <MeetingRelations
        relations={[]}
        status={status}
        unavailable={false}
        loading={false}
        failed={false}
        onRetry={vi.fn()}
        onSelectItem={vi.fn()}
        onOpenScript={vi.fn()}
        segments={[]}
      />
    );
    expect(screen.queryByText("확인된 충돌과 이어짐이 없습니다.")).toBeNull();
  }
);
