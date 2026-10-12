import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCard } from "@/components/chat/approval-card";
import { parseApprovalCard } from "@/lib/chat/stream-protocol";

const due = parseApprovalCard({
  title: "할 일 기한 바꾸기",
  target: "멘토링 · [시험] PRO-56 운영 확인",
  fields: [{ label: "기한", before: "없음", after: "2026-10-31" }],
})!;

afterEach(cleanup);

describe("parseApprovalCard", () => {
  it("제목이 없으면 카드가 아니다 — summary 로 묻는다", () => {
    expect(parseApprovalCard({ fields: [] })).toBeNull();
    expect(parseApprovalCard("할 일 만들기")).toBeNull();
    expect(parseApprovalCard(null)).toBeNull();
  });

  it("모양이 틀린 칸은 그 칸만 뺀다", () => {
    const card = parseApprovalCard({
      title: "할 일 만들기",
      fields: [
        { label: "내용", value: "공지" },
        { value: "라벨 없음" },
        3,
        { label: "빈 칸" },
      ],
      items: [{ title: "1번" }, { fields: [] }],
      body: { text: "본문" },
    });
    expect(card?.fields.map((field) => field.label)).toEqual(["내용"]);
    expect(card?.items.map((item) => item.title)).toEqual(["1번"]);
    expect(card?.body).toEqual({ label: "본문", text: "본문" });
  });
});

describe("ApprovalCard", () => {
  it("제목·대상·「전 → 후」를 그리고 승인·거절을 보낸다", () => {
    const onApprove = vi.fn();
    render(
      <ApprovalCard
        card={due}
        summary="무시"
        status={{ kind: "open" }}
        onApprove={onApprove}
      />
    );
    expect(screen.getByTestId("approval-summary").textContent).toBe(
      "할 일 기한 바꾸기"
    );
    expect(screen.getByText("멘토링 · [시험] PRO-56 운영 확인")).toBeTruthy();
    expect(screen.getByText("없음").className).toContain("line-through");
    expect(screen.getByText("2026-10-31").className).toContain("font-semibold");
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(onApprove.mock.calls).toEqual([["APPROVED"], ["REJECTED"]]);
  });

  it("★ 마크다운·HTML 을 해석하지 않는다 — 승인 근거가 화면이라 평문으로만 그린다", () => {
    const card = parseApprovalCard({
      title: "**굵게** <b>태그</b>",
      fields: [
        {
          label: "링크",
          value: "[누르기](https://evil.example) https://x.example",
        },
      ],
    })!;
    const { container } = render(
      <ApprovalCard card={card} summary={null} status={{ kind: "open" }} />
    );
    expect(screen.getByTestId("approval-summary").textContent).toBe(
      "**굵게** <b>태그</b>"
    );
    expect(container.querySelector("b, strong")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });

  it("일괄은 항목 목록이고 버튼에 건수를 붙인다. 5건을 넘으면 접는다", () => {
    const card = parseApprovalCard({
      title: "할 일 7건 한 번에 만들기",
      items: Array.from({ length: 7 }, (_, index) => ({
        title: `할 일 ${index + 1}`,
        fields: [{ label: "담당", value: "김하늘" }],
      })),
    })!;
    render(
      <ApprovalCard card={card} summary={null} status={{ kind: "open" }} />
    );
    expect(screen.getByRole("button", { name: "7건 승인" })).toBeTruthy();
    expect(screen.getByText("2건 더 보기")).toBeTruthy();
    const details = screen.getByText("할 일 7").closest("details");
    expect(details?.open).toBe(false);
    // 펼친 뒤에도 접을 수 있어야 한다 — 요약 줄이 사라지면 긴 목록이 스레드를 계속 차지한다.
    expect(details?.querySelector("summary")?.textContent).toContain("접기");
  });

  it("명단 바꾸기는 더함·뺌·그대로를 사람 칩으로 가른다", () => {
    const card = parseApprovalCard({
      title: "참석 멤버 바꾸기",
      warning: "아래 명단에 없는 멤버는 참석자에서 빠집니다.",
      fields: [
        {
          label: "참석자",
          added: ["김하늘"],
          removed: ["박도윤"],
          kept: ["이민호"],
        },
      ],
    })!;
    render(
      <ApprovalCard card={card} summary={null} status={{ kind: "open" }} />
    );
    expect(
      screen.getByText("아래 명단에 없는 멤버는 참석자에서 빠집니다.")
    ).toBeTruthy();
    expect(screen.getByLabelText("더함")).toBeTruthy();
    expect(screen.getByText("박도윤").className).toContain("line-through");
    expect(screen.getByText("이민호")).toBeTruthy();
  });

  it("긴 본문만 접는다", () => {
    const long = parseApprovalCard({
      title: "메일 보내기",
      body: { label: "본문", text: "한 줄\n".repeat(8) },
    })!;
    const { container, rerender } = render(
      <ApprovalCard card={long} summary={null} status={{ kind: "open" }} />
    );
    expect(container.querySelector("details")?.textContent).toContain("펼치기");

    const short = parseApprovalCard({
      title: "GitHub 이슈 만들기",
      body: { label: "본문", text: "짧은 본문" },
    })!;
    rerender(
      <ApprovalCard card={short} summary={null} status={{ kind: "open" }} />
    );
    expect(container.querySelector("details")).toBeNull();
  });

  it.each([
    [{ kind: "running" as const }, "실행 중", true],
    [{ kind: "done" as const, url: null }, "완료", true],
    [{ kind: "rejected" as const }, "거절됨", false],
    [{ kind: "failed" as const }, "실패", false],
    [
      {
        kind: "invalid" as const,
        reason: "이미 처리됐거나 지나간 승인입니다.",
      },
      "무효",
      false,
    ],
    [
      { kind: "check" as const, reason: "결과를 받지 못했습니다." },
      "확인 필요",
      false,
    ],
  ])("결정 뒤 %o 는 버튼 없이 배지로 말한다", (status, label, showsFields) => {
    render(<ApprovalCard card={due} summary={null} status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(Boolean(screen.queryByText("2026-10-31"))).toBe(showsFields);
  });

  it("거절은 「실행하지 않았습니다」로 고정한다", () => {
    render(
      <ApprovalCard card={due} summary={null} status={{ kind: "rejected" }} />
    );
    expect(screen.getByText("실행하지 않았습니다.")).toBeTruthy();
  });
});
