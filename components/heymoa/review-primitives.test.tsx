import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssigneeCell, AssigneeFace } from "@/components/heymoa/assignee-cell";
import type { AssigneeChoice } from "@/lib/assignees/describe";
import { ChoiceToggle } from "@/components/heymoa/choice-toggle";
import { Collapse } from "@/components/heymoa/collapse";
import { DueCell } from "@/components/heymoa/due-cell";
import { formatDueDate } from "@/lib/format/date";
import { SegmentedControl } from "@/components/heymoa/segmented-control";

afterEach(cleanup);

describe("ChoiceToggle", () => {
  it("고른 쪽만 체크되고, 누르면 그 선택을 알린다", () => {
    const onChange = vi.fn();
    render(<ChoiceToggle label="이전 결정을 끝낼지" changeLabel="끝내기" value="keep" onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "유지" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "끝내기" })).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("radio", { name: "끝내기" }));
    expect(onChange).toHaveBeenCalledWith("change");
  });
});

describe("ChoiceToggle 유지 막기", () => {
  it("keepDisabled 면 유지만 막고 바꾸는 쪽은 그대로 둔다", () => {
    const onChange = vi.fn();
    render(<ChoiceToggle label="기존 할 일에 반영할지" changeLabel="반영" value={null} keepDisabled onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "유지" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "반영" }));
    expect(onChange).toHaveBeenCalledWith("change");
  });
});

describe("SegmentedControl", () => {
  it("고른 칸으로 판이 옮겨 가고 바뀐 값을 알린다", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SegmentedControl
        label="보기"
        value="graph"
        options={[
          { value: "summary", label: "요약" },
          { value: "graph", label: "그래프" },
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("radio", { name: "그래프" })).toHaveAttribute("aria-checked", "true");
    expect((container.querySelector("[aria-hidden]") as HTMLElement).style.transform).toBe("translateX(100%)");

    fireEvent.click(screen.getByRole("radio", { name: "요약" }));
    expect(onChange).toHaveBeenCalledWith("summary");
  });
});

describe("Collapse", () => {
  it("접힌 자리는 포커스에서 빠지고, lazy 면 처음 펼칠 때 내용을 만든 뒤 남긴다", () => {
    const { rerender, container } = render(
      <Collapse open={false} lazy>
        <p>수정 기록</p>
      </Collapse>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("inert");
    expect(screen.queryByText("수정 기록")).not.toBeInTheDocument();

    rerender(
      <Collapse open lazy>
        <p>수정 기록</p>
      </Collapse>
    );
    expect(screen.getByText("수정 기록")).toBeInTheDocument();
    expect(root).not.toHaveAttribute("inert");

    rerender(
      <Collapse open={false} lazy>
        <p>수정 기록</p>
      </Collapse>
    );
    expect(screen.getByText("수정 기록")).toBeInTheDocument();
    expect(root).toHaveAttribute("data-state", "closed");
  });
});

describe("DueCell", () => {
  it("날짜만 있는 값을 서울 날짜와 요일로 쓴다", () => {
    expect(formatDueDate("2026-09-19")).toBe("9월 19일 (토)");
  });

  it("비우면 기한이 없어진다", () => {
    const onChange = vi.fn();
    const { container } = render(<DueCell value="2026-09-19" editable onChange={onChange} />);

    fireEvent.change(container.querySelector("input[type=date]") as HTMLInputElement, {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("AssigneeFace", () => {
  it("사람으로 풀리지 않은 화자에는 이름 없는 화자 표시가 붙는다", () => {
    render(<AssigneeFace value={{ type: "SPEAKER_LABEL", noteId: "n", label: "F" }} />);
    expect(screen.getByText("화자 F")).toBeInTheDocument();
    expect(screen.getByLabelText("이름 없는 화자")).toBeInTheDocument();
  });

  it("담당이 없으면 자리표시 문구를 쓴다", () => {
    render(<AssigneeFace value={null} placeholder="담당 정하기" />);
    expect(screen.getByText("담당 정하기")).toBeInTheDocument();
  });
});

describe("AssigneeCell", () => {
  const choices: AssigneeChoice[] = [
    { type: "USER", id: "u1", name: "김민" },
    { type: "SPEAKER_LABEL", noteId: "n", label: "B" },
  ];

  it("고칠 수 없으면 누를 자리 없이 얼굴만 선다", () => {
    render(<AssigneeCell value={choices[0]} choices={choices} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("김민")).toBeInTheDocument();
  });

  it("열어서 다른 사람을 고르거나 담당을 비운다", async () => {
    const onChange = vi.fn();
    render(<AssigneeCell value={choices[0]} choices={choices} editable onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox", { name: "담당 김민 바꾸기" }));
    fireEvent.click(await screen.findByRole("option", { name: /화자 B/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(choices[1]));

    fireEvent.click(screen.getByRole("combobox", { name: "담당 김민 바꾸기" }));
    fireEvent.click(await screen.findByRole("button", { name: "담당 비우기" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
