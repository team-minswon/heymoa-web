import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpeakerAssignMenu } from "@/components/notes/speaker-assign-menu";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";

const identity: SpeakerIdentity = {
  displayName: "화자 A",
  tint: "var(--el-gradient-sky)",
  initial: "화",
  imageUrl: null,
  unassigned: true,
};

const candidates = [
  { userId: "01K0000000001", name: "김철수", email: "kim@example.com" },
  { userId: "01K0000000002", name: "박서준", email: "park@example.com" },
];

function open() {
  fireEvent.click(screen.getByTestId("speaker-assign-trigger"));
}

describe("SpeakerAssignMenu", () => {
  afterEach(cleanup);

  it("참석자와 「참석자 아님」만 낸다 — 새 참여자 생성은 없다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();

    // 앞 글자는 이니셜 아바타다(`aria-hidden`). 접근성 이름에는 안 들어가고,
    // 그것은 아래 「고른 참석자의 userId 를 올린다」가 role name 으로 지킨다.
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent)
    ).toEqual([
      "김김철수kim@example.com",
      "박박서준park@example.com",
      "참석자 아님",
    ]);
  });

  it("고른 참석자의 userId 를 올린다", () => {
    const onAssign = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={onAssign}
      />
    );

    open();
    fireEvent.click(screen.getByRole("menuitem", { name: /박서준/ }));

    expect(onAssign).toHaveBeenCalledWith("01K0000000002");
  });

  it("「참석자 아님」은 null 을 올린다 — 미결정과 다른 값이다", () => {
    const onAssign = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={onAssign}
      />
    );

    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "참석자 아님" }));

    expect(onAssign).toHaveBeenCalledWith(null);
  });

  it("참석자가 아니면 읽기 전용이다 — 숨기지는 않는다", () => {
    // 왜 담당자가 비었는지는 알아야 하므로 화자는 그대로 보인다
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        disabled
        onAssign={vi.fn()}
      />
    );

    expect(screen.queryByTestId("speaker-assign-trigger")).toBeNull();
    expect(screen.getByTestId("speaker-chip")).toHaveTextContent("화자 A");
  });

  it("후보가 없어도 「참석자 아님」은 남는다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent)
    ).toEqual(["참석자 아님"]);
  });

  it("이메일을 같이 낸다 — 동명이인이 갈리는 유일한 단서다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[
          { userId: "01K0000000001", name: "김철수", email: "kim@example.com" },
          {
            userId: "01K0000000003",
            name: "김철수",
            email: "cs.kim@example.com",
          },
        ]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(screen.getByText("kim@example.com")).toBeInTheDocument();
    expect(screen.getByText("cs.kim@example.com")).toBeInTheDocument();
  });

  it("이미 다른 화자에 붙은 사람은 그 라벨을 달고 나온다", () => {
    // 한 사람이 두 화자일 수 없다 — 고르면 저쪽에서 떨어진다.
    // **누르기 전에** 보여야 실수를 안 한다.
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[{ ...candidates[0], assignedLabel: "B" }, candidates[1]]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(screen.getByRole("menuitem", { name: /김철수/ })).toHaveTextContent(
      "화자 B"
    );
    expect(
      screen.getByRole("menuitem", { name: /박서준/ })
    ).not.toHaveTextContent("화자");
  });

  it("프로필 사진이 있으면 그린다 — 칩과 같은 모양이어야 한다", () => {
    const { container } = render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[{ ...candidates[0], image: "https://cdn/x.png" }]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(
      container.ownerDocument.querySelector('img[src="https://cdn/x.png"]')
    ).toBeTruthy();
  });
});
