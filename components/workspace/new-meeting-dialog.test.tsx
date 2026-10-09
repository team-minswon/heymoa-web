import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewMeetingDialog } from "@/components/workspace/new-meeting-dialog";

const PROJECTS = [
  { projectId: "P1", name: "제품" },
  { projectId: "P2", name: "리서치" },
];

function renderDialog(
  onSubmit = vi.fn().mockResolvedValue(true),
  isPending = false,
  options: {
    projects?: typeof PROJECTS;
    defaultProjectId?: string | null;
  } = {}
) {
  render(
    <NewMeetingDialog
      open
      onOpenChange={() => {}}
      onSubmit={onSubmit}
      isPending={isPending}
      workspaceId="W1"
      projects={options.projects ?? PROJECTS}
      defaultProjectId={options.defaultProjectId ?? null}
    />
  );
  return onSubmit;
}

describe("NewMeetingDialog", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("입력한 이름으로 만든다", async () => {
    const onSubmit = renderDialog();

    fireEvent.change(screen.getByLabelText("회의 이름"), {
      target: { value: "  주간 제품 회의  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    // 앞뒤 공백은 서버에 보내기 전에 턴다.
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("주간 제품 회의", "P1")
    );
  });

  it("생성이 끝날 때까지 입력을 비우지 않는다", async () => {
    // 함수형 action은 완료되면 비제어 입력을 비운다. 안 기다리면 실패했을 때 이름이 사라진다.
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () => new Promise<boolean>((resolve) => (release = () => resolve(true)))
    );
    renderDialog(onSubmit);
    const input = screen.getByLabelText("회의 이름") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "주간 제품 회의" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(input.value).toBe("주간 제품 회의");
    release();
  });

  it("빈 이름으로는 만들지 않는다", () => {
    const onSubmit = renderDialog();

    fireEvent.change(screen.getByLabelText("회의 이름"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("성공하면 다음 열림을 위해 입력을 비운다", async () => {
    const onSubmit = renderDialog();
    const input = screen.getByLabelText("회의 이름") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "주간 제품 회의" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    // 부모는 닫기만 하므로 여기서 안 비우면 지난 이름이 남는다.
    await waitFor(() => expect(input.value).toBe(""));
    expect(onSubmit).toHaveBeenCalledWith("주간 제품 회의", "P1");
  });

  it("만들어지지 않았으면 입력을 지우지 않는다", async () => {
    // 대상 프로젝트가 사라졌거나 응답 guard에 걸리면 노트가 없다. 그때 비우면 다시 써야 한다.
    const onSubmit = vi.fn().mockResolvedValue(false);
    renderDialog(onSubmit);
    const input = screen.getByLabelText("회의 이름") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "주간 제품 회의" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(input.value).toBe("주간 제품 회의");
  });

  it("실패해도 입력한 이름을 지우지 않고 오류 경계로 던지지 않는다", async () => {
    // React 19는 거절된 form action을 오류 경계로 올린다 — 삼키지 않으면 워크스페이스
    // 전체가 오류 화면이 된다. 토스트는 전역 MutationCache가 띄운다.
    const onSubmit = vi.fn().mockRejectedValue(new Error("BAD_REQUEST"));
    renderDialog(onSubmit);
    const input = screen.getByLabelText("회의 이름") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "주간 제품 회의" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(input.value).toBe("주간 제품 회의");
  });

  it("기록이 아니라 생성 단계임을 말한다", () => {
    renderDialog();

    // 이 문구가 "만들자마자 기록"이라는 옛 흐름과 갈리는 지점이다.
    expect(
      screen.getByText(/기록은 만든 뒤에\s*시작합니다/)
    ).toBeInTheDocument();
  });

  /** 회의의 프로젝트는 만든 뒤 못 바꾼다 — 그래서 만들 때 보여 주고, 못 바꾼다고 말한다(APP-1033). */
  it("프로젝트를 보여 주고 만든 뒤에는 바꿀 수 없다고 말한다", () => {
    renderDialog();

    expect(
      screen.getByRole("combobox", { name: "프로젝트" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/만든 뒤에는 프로젝트를 바꿀 수 없습니다/)
    ).toBeInTheDocument();
  });

  const submitTitle = async () => {
    fireEvent.change(screen.getByLabelText("회의 이름"), {
      target: { value: "주간 회의" },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
  };

  it("보고 있던 프로젝트가 있으면 그 프로젝트로 만든다", async () => {
    const onSubmit = renderDialog(undefined, false, { defaultProjectId: "P2" });

    await submitTitle();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("주간 회의", "P2")
    );
  });

  it("「모든 노트」에서 열면 마지막으로 쓴 프로젝트가 기본이다", async () => {
    window.localStorage.setItem("heymoa:last-meeting-project:W1", "P2");
    const onSubmit = renderDialog();

    await submitTitle();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("주간 회의", "P2")
    );
  });

  it("마지막으로 쓴 프로젝트가 지워졌으면 첫 프로젝트로 돌아간다", async () => {
    window.localStorage.setItem("heymoa:last-meeting-project:W1", "GONE");
    const onSubmit = renderDialog();

    await submitTitle();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("주간 회의", "P1")
    );
  });

  it("만들어지면 그 프로젝트를 다음 기본으로 기억한다", async () => {
    renderDialog(undefined, false, { defaultProjectId: "P2" });

    await submitTitle();

    await waitFor(() =>
      expect(
        window.localStorage.getItem("heymoa:last-meeting-project:W1")
      ).toBe("P2")
    );
  });

  it("프로젝트가 하나면 고르는 칸 없이 이름만 보여 준다", () => {
    renderDialog(undefined, false, { projects: [PROJECTS[0]] });

    expect(screen.queryByRole("combobox", { name: "프로젝트" })).toBeNull();
    expect(screen.getByText("제품")).toBeInTheDocument();
  });
});
