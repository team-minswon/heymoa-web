import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RelationWebView } from "@/components/notes/meeting-review/relation-web";
import { ReviewGate } from "@/components/notes/meeting-review/review-gate";
import { ReviewItemCard } from "@/components/notes/meeting-review/review-item-card";
import { RelationsPanel } from "@/components/notes/meeting-review/relations-panel";
import { initialEdits } from "@/lib/notes/meeting-review/edits";
import {
  ITEM,
  RELATION,
  sampleApproval,
  sampleReview,
} from "@/lib/notes/meeting-review/fixtures";
import { layoutRelationWeb } from "@/lib/notes/meeting-review/relation-web";
import { toReviewScreen } from "@/lib/notes/meeting-review/select";

afterEach(() => cleanup());

const noop = () => undefined;

describe("ReviewGate", () => {
  it("승인 전에는 「검토본」이고 「확정」이라는 말이 없다. 시작자가 아니면 버튼도 없다", () => {
    render(
      <ReviewGate
        screen={toReviewScreen(sampleReview())}
        isStarter={false}
        unsavedCount={0}
        approving={false}
        rejected={null}
        approval={null}
        onApprove={noop}
        onJumpTo={noop}
      />
    );
    expect(screen.getByText("검토본 · 아직 확정되지 않음")).toBeInTheDocument();
    expect(screen.queryByText(/확정됨/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("approve-meeting")).not.toBeInTheDocument();
    expect(screen.getByText("승인은 회의 시작자가 합니다.")).toBeInTheDocument();
  });

  it("시작자에게는 버튼이 보이되 server 게이트가 막으면 비활성이고 남은 작업이 보인다", () => {
    const onJumpTo = vi.fn();
    render(
      <ReviewGate
        screen={toReviewScreen(sampleReview())}
        isStarter
        unsavedCount={2}
        approving={false}
        rejected={null}
        approval={null}
        onApprove={noop}
        onJumpTo={onJumpTo}
      />
    );
    expect(screen.getByTestId("approve-meeting")).toBeDisabled();
    expect(screen.getByText("미검토 항목")).toBeInTheDocument();
    expect(screen.getByText("저장 안 된 편집 2")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /결제 모듈 인증/ })[0]);
    expect(onJumpTo).toHaveBeenCalledWith({ itemId: ITEM.issue });
  });

  it("승인 뒤에는 「확정됨」과 승인 정보를 그리고 버튼이 사라진다", () => {
    const review = sampleReview({
      approved: { approvalVersion: 3, approvedAt: "2026-09-01T11:00:00.000Z", approvedBy: "01J0000000001" },
    });
    render(
      <ReviewGate
        screen={toReviewScreen(review)}
        isStarter
        unsavedCount={0}
        approving={false}
        rejected={null}
        approval={sampleApproval()}
        onApprove={noop}
        onJumpTo={noop}
      />
    );
    expect(screen.getByText("프로젝트 지식으로 확정됨")).toBeInTheDocument();
    expect(screen.queryByTestId("approve-meeting")).not.toBeInTheDocument();
    expect(screen.getByText(/5 · 연결 4/)).toBeInTheDocument();
  });

  it("server 거부 사유를 인라인으로 남긴다", () => {
    render(
      <ReviewGate
        screen={toReviewScreen(sampleReview())}
        isStarter
        unsavedCount={0}
        approving={false}
        rejected={{ code: "PROJECT_VERSION_CONFLICT", message: "x" }}
        approval={null}
        onApprove={noop}
        onJumpTo={noop}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("프로젝트의 승인 버전이 바뀌었습니다");
  });
});

describe("ReviewItemCard", () => {
  const item = sampleReview().items.find((entry) => entry.itemId === ITEM.humanAdded)!;
  const base = {
    item,
    shown: item,
    unreviewed: true,
    relationCount: 0,
    selected: false,
    canEdit: true,
    saving: false,
    conflict: null,
    failure: null,
    kindInHeader: false,
    onSelect: noop,
    onEdit: noop,
    onCommit: noop,
    onKeepLocal: noop,
    onTakeServer: noop,
    onEvidenceSelect: noop,
  };

  it("미검토 · 사람이 추가 · 근거 없음을 서로 다른 배지로 그린다", () => {
    render(<ul><ReviewItemCard {...base} /></ul>);
    expect(screen.getByText("미검토")).toBeInTheDocument();
    expect(screen.getByText("사람이 추가")).toBeInTheDocument();
    expect(screen.getByText("근거 없음")).toBeInTheDocument();
  });

  it("편집은 blur 에서 한 번 저장한다 — 키 입력마다 부르지 않는다", () => {
    const onEdit = vi.fn();
    const onCommit = vi.fn();
    render(<ul><ReviewItemCard {...base} onEdit={onEdit} onCommit={onCommit} /></ul>);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    const textarea = screen.getByLabelText("항목 내용");
    fireEvent.change(textarea, { target: { value: "고친 내용 1" } });
    fireEvent.change(textarea, { target: { value: "고친 내용 12" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(textarea);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(item.itemId, { content: "고친 내용 12" });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("충돌은 내 편집과 서버 값을 나란히 보여 주고 고르기 전엔 아무것도 덮지 않는다", () => {
    const onKeepLocal = vi.fn();
    const onTakeServer = vi.fn();
    render(
      <ul>
        <ReviewItemCard
          {...base}
          shown={{ ...item, content: "내 편집" }}
          conflict={{
            kind: "item",
            local: { content: "내 편집" },
            server: { ...item, content: "서버가 먼저 바꾼 내용", revision: 2 },
            currentReviewVersion: 6,
          }}
          onKeepLocal={onKeepLocal}
          onTakeServer={onTakeServer}
        />
      </ul>
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("내 편집");
    expect(alert).toHaveTextContent("서버가 먼저 바꾼 내용");
    // 화면의 본문은 여전히 내 편집이다.
    expect(screen.getByRole("button", { name: "내 편집" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "내 편집 유지" }));
    expect(onKeepLocal).toHaveBeenCalledWith(item.itemId);
    expect(onTakeServer).not.toHaveBeenCalled();
  });

  it("편집 권한이 없으면 수정·제외 컨트롤이 없다", () => {
    render(<ul><ReviewItemCard {...base} canEdit={false} /></ul>);
    expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "제외" })).not.toBeInTheDocument();
  });
});

describe("RelationWebView · RelationsPanel", () => {
  it("모르는 kind 의 관계도 label · 근거 없음으로 그린다", () => {
    const scr = toReviewScreen(sampleReview());
    const layout = layoutRelationWeb(ITEM.agenda, scr.itemsById, scr.relations)!;
    render(<RelationWebView layout={layout} onSelectNode={noop} />);
    const edge = screen.getByTestId("relation-edge");
    expect(edge).toHaveTextContent("근거 없는 연결 · 근거 없음");
    expect(edge.querySelector("line")?.getAttribute("stroke-dasharray")).toBe("4 3");
  });

  it("노드를 누르면 그 항목이 선택된다. APPROVED 끝점은 눌리지 않는다", () => {
    const scr = toReviewScreen(sampleReview());
    const onSelectNode = vi.fn();
    const layout = layoutRelationWeb(ITEM.decision, scr.itemsById, scr.relations)!;
    render(<RelationWebView layout={layout} onSelectNode={onSelectNode} />);
    const nodes = screen.getAllByTestId("relation-node");
    expect(nodes).toHaveLength(4);
    const action = nodes.find((node) => node.textContent?.includes("QA 일정"))!;
    fireEvent.click(action);
    expect(onSelectNode).toHaveBeenCalledWith(ITEM.action);
    const approved = nodes.find((node) => node.textContent?.includes("8월 말"))!;
    expect(approved.getAttribute("role")).toBeNull();
  });

  it("프로젝트 레벨 관계는 이전 확정과 이번 회의를 나란히, 효과를 함께 그린다", () => {
    const scr = toReviewScreen(sampleReview());
    render(
      <RelationsPanel
        screen={scr}
        edits={initialEdits(scr.reviewVersion)}
        selectedItemId={null}
        canEdit
        onSelectItem={noop}
        onJudge={noop}
        onKeepLocal={noop}
        onTakeServer={noop}
        onRecheck={noop}
        recheckPending={false}
        onEvidenceSelect={noop}
      />
    );
    const row = screen
      .getAllByTestId("review-relation")
      .find((entry) => entry.getAttribute("data-relation-id") === RELATION.projectReplace)!;
    expect(row).toHaveTextContent("이전 확정");
    expect(row).toHaveTextContent("출시일을 8월 말로 한다");
    expect(row).toHaveTextContent("승인하면 · 이전 결정을 현재 목록에서 뺀다");
    // 오래된 관계가 있으면 재검토 버튼이 뜬다.
    expect(screen.getByRole("button", { name: /오래된 1건 재검토/ })).toBeInTheDocument();
  });
});
