import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewMeetingDialog } from "@/components/workspace/new-meeting-dialog";

function renderDialog(onSubmit = vi.fn().mockResolvedValue(true), isPending = false) {
  render(
    <NewMeetingDialog
      open
      onOpenChange={() => {}}
      onSubmit={onSubmit}
      isPending={isPending}
    />
  );
  return onSubmit;
}

describe("NewMeetingDialog", () => {
  afterEach(cleanup);

  it("입력한 이름으로 만든다", async () => {
    const onSubmit = renderDialog();

    fireEvent.change(screen.getByLabelText("회의 이름"), {
      target: { value: "  주간 제품 회의  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    // 앞뒤 공백은 서버에 보내기 전에 턴다.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("주간 제품 회의"));
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
    expect(onSubmit).toHaveBeenCalledWith("주간 제품 회의");
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
});
