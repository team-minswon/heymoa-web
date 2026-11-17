import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SpeakerAssignMenu,
  type SpeakerCandidate,
} from "@/components/notes/speaker-assign-menu";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";
import {
  PersonAvatar,
  personAvatarKey,
} from "@/components/heymoa/person-avatar";

const identity: SpeakerIdentity = {
  displayName: "화자 A",
  avatarName: "label:A",
  imageUrl: null,
  unassigned: true,
};

const candidates: SpeakerCandidate[] = [
  {
    participantId: "01K0000000101",
    userId: "01K0000000001",
    name: "김철수",
    email: "kim@example.com",
  },
  {
    participantId: "01K0000000102",
    userId: "01K0000000002",
    name: "박서준",
    email: "park@example.com",
  },
];

const guestCandidate: SpeakerCandidate = {
  participantId: "01K0000000201",
  userId: null,
  name: "이도현",
  email: null,
};

const elsewhereGuest = {
  participantId: null,
  userId: null,
  guestId: "01K0000000301",
  name: "최유진",
  email: null,
  searchOnly: true,
};

function open() {
  fireEvent.click(screen.getByTestId("speaker-assign-trigger"));
}

function chooseScope(label: string) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
}

function search(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: /참석자 검색/ }), {
    target: { value },
  });
}

/** base-ui 는 IME 조합 중에는 controlled 값을 올리지 않아, 그 값만 보면 마지막 글자가 빠집니다. */
function compose(committed: string, composing: string) {
  const input = screen.getByRole("combobox", { name: /참석자 검색/ });
  // `fireEvent.change` 는 React `onChange` 만 태우고 `onInput` 은 안 태웁니다. 브라우저에서는 둘 다 native `input` 입니다.
  fireEvent.input(input, { target: { value: committed } });
  fireEvent.compositionStart(input);
  fireEvent.input(input, { target: { value: committed + composing } });
}

describe("SpeakerAssignMenu", () => {
  afterEach(cleanup);

  it("이 회의의 참석자와 「이름 안 붙임」을 낸다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(
      screen.getAllByRole("option").map((item) => item.textContent)
    ).toEqual(["김철수kim@example.com", "박서준park@example.com"]);
    expect(
      screen.getByRole("button", { name: "이름 없이 두기" })
    ).toBeInTheDocument();
  });

  it("고른 참석자의 참여 기록 식별자를 올린다", () => {
    const onAssign = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={onAssign}
      />
    );

    open();
    fireEvent.click(screen.getByRole("option", { name: /박서준/ }));

    expect(onAssign).toHaveBeenCalledWith(
      { participantId: "01K0000000102" },
      "label"
    );
  });

  it("계정 없는 참여자도 붙일 수 있다", () => {
    const onAssign = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[...candidates, guestCandidate]}
        onAssign={onAssign}
      />
    );

    open();
    fireEvent.click(screen.getByRole("option", { name: /이도현/ }));

    expect(onAssign).toHaveBeenCalledWith(
      { participantId: "01K0000000201" },
      "label"
    );
  });

  it("아직 참여자가 아닌 멤버는 계정으로 가리킨다", () => {
    const onAssign = vi.fn();
    const notYet = {
      participantId: null,
      userId: "01K0000000777",
      name: "정하윤",
      email: "hayoon@example.com",
    };
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[...candidates, notYet]}
        onAssign={onAssign}
      />
    );

    open();
    fireEvent.click(screen.getByRole("option", { name: /정하윤/ }));

    expect(onAssign).toHaveBeenCalledWith({ userId: "01K0000000777" }, "label");
  });

  it("참여자가 아닌 멤버는 검색 전에는 숨고 검색하면 후보로 뜬다", () => {
    const notYet = {
      participantId: null,
      userId: "01K0000000777",
      name: "정하윤",
      email: "hayoon@example.com",
      searchOnly: true,
    };
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[...candidates, notYet]}
        onAssign={vi.fn()}
      />
    );

    open();
    expect(screen.queryByRole("option", { name: /정하윤/ })).toBeNull();

    search("정하윤");
    expect(screen.getByRole("option", { name: /정하윤/ })).toBeTruthy();
  });

  it("검색 전에는 이 회의 밖 임시 참여자를 안 보여준다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[...candidates, elsewhereGuest]}
        onAssign={vi.fn()}
        onCreateGuest={vi.fn()}
      />
    );

    open();

    expect(screen.queryByRole("option", { name: /최유진/ })).toBeNull();
  });

  it("이름을 치면 이 회의 밖 임시 참여자가 후보로 뜨고 ＋ 추가는 안 뜬다", () => {
    const onAssign = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[...candidates, elsewhereGuest]}
        onAssign={onAssign}
        onCreateGuest={vi.fn()}
      />
    );

    open();
    fireEvent.input(screen.getByRole("combobox", { name: /참석자 검색/ }), {
      target: { value: "최유진" },
    });

    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();

    fireEvent.click(screen.getByRole("option", { name: /최유진/ }));
    expect(onAssign).toHaveBeenCalledWith(
      { guestId: "01K0000000301" },
      "label"
    );
  });

  it("개별 지정 해제로 닫아도 범위가 기본으로 돌아간다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        overridden
        onAssign={vi.fn()}
        onClearOverride={vi.fn()}
      />
    );

    open();
    fireEvent.click(screen.getByLabelText("현재 발화에만 적용"));
    fireEvent.click(screen.getByRole("button", { name: "개별 지정 해제" }));

    open();
    expect(screen.getByLabelText("이 화자의 모든 발화에 적용")).toBeChecked();
  });

  it("＋ 추가로 닫아도 검색어와 범위가 남지 않는다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={vi.fn()}
      />
    );

    open();
    fireEvent.click(screen.getByLabelText("현재 발화에만 적용"));
    fireEvent.input(screen.getByRole("combobox", { name: /참석자 검색/ }), {
      target: { value: "정하윤" },
    });
    fireEvent.click(screen.getByRole("button", { name: /"정하윤" 추가/ }));

    open();
    expect(screen.getByLabelText("이 화자의 모든 발화에 적용")).toBeChecked();
    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();
  });

  it("후보를 못 불러오면 그 사실과 재시도를 보여준다", () => {
    const onRetryCandidates = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[]}
        candidatesFailed
        onAssign={vi.fn()}
        onRetryCandidates={onRetryCandidates}
      />
    );

    open();
    expect(screen.getByRole("alert")).toHaveTextContent(/불러오지 못했습니다/);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetryCandidates).toHaveBeenCalled();
  });

  it("조합 중인 한 글자로도 후보가 좁혀진다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();
    const input = screen.getByRole("combobox", { name: /참석자 검색/ });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "박" } });

    expect(screen.getByRole("option", { name: /박서준/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /김철수/ })).toBeNull();
  });

  it("계정 없는 후보의 이메일 자리에는 「외부」가 선다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[guestCandidate]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(screen.getByText("외부")).toBeInTheDocument();
  });

  it("「이름 안 붙임」은 null 을 올린다 — 미결정과 다른 값이다", () => {
    const onAssign = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={onAssign}
      />
    );

    open();
    fireEvent.click(screen.getByRole("button", { name: "이름 없이 두기" }));

    expect(onAssign).toHaveBeenCalledWith(null, "label");
  });

  it("만드는 중에는 읽기 전용이다 — 숨기지는 않는다", () => {
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

  it("후보가 없어도 「이름 안 붙임」은 남는다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "이름 없이 두기" })
    ).toBeInTheDocument();
  });

  it("이메일을 같이 낸다 — 동명이인이 갈리는 유일한 단서다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[
          candidates[0],
          {
            participantId: "01K0000000103",
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
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[
          { ...candidates[0], assignedLabels: ["B"] },
          candidates[1],
        ]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(screen.getByRole("option", { name: /김철수/ })).toHaveTextContent(
      "화자 B"
    );
    expect(
      screen.getByRole("option", { name: /박서준/ })
    ).not.toHaveTextContent("화자");
  });

  it("검색으로 후보를 좁힌다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();
    search("박서준");

    expect(
      screen.getAllByRole("option").map((item) => item.textContent)
    ).toEqual(["박서준park@example.com"]);
  });

  it("정확히 같은 이름을 치면 추가가 안 뜬다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={vi.fn()}
      />
    );

    open();
    search("박서준");

    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();
  });

  it("없는 이름을 치면 그 자리에서 만들어 붙인다", () => {
    const onCreateGuest = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={onCreateGuest}
      />
    );

    open();
    search("  이도현  ");
    fireEvent.click(screen.getByRole("button", { name: /이도현/ }));

    expect(onCreateGuest).toHaveBeenCalledWith("이도현", "label");
  });

  it("일치하는 사람이 없을 때 Enter 는 「＋ 추가」를 확인한다", () => {
    const onCreateGuest = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={onCreateGuest}
      />
    );

    open();
    search("이도현");
    fireEvent.keyDown(screen.getByPlaceholderText("이름으로 검색"), {
      key: "Enter",
    });

    expect(onCreateGuest).toHaveBeenCalledWith("이도현", "label");
  });

  it("조합 중인 마지막 글자까지 이름에 넣는다", () => {
    const onCreateGuest = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={onCreateGuest}
      />
    );

    open();
    compose("이민", "형");
    fireEvent.click(screen.getByRole("button", { name: /추가/ }));

    expect(onCreateGuest).toHaveBeenCalledWith("이민형", "label");
  });

  it("조합 중이어도 버튼에 친 이름 그대로 보인다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={vi.fn()}
      />
    );

    open();
    compose("이민", "형");

    expect(screen.getByRole("button", { name: /추가/ })).toHaveTextContent(
      '＋ "이민형" 추가'
    );
  });

  it("조합 중인 글자까지 합쳐 이미 있는 이름이면 추가가 안 뜬다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={vi.fn()}
      />
    );

    open();
    compose("박서", "준");

    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();
  });

  it("만들기를 못 하는 자리에서는 추가가 아예 없다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();
    search("이도현");

    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();
  });

  it("후보마다 다른 얼굴이다 — 이 화자의 얼굴을 전원에게 미리 칠하지 않는다", () => {
    const { container } = render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();

    const faces = [
      ...container.ownerDocument.querySelectorAll<SVGElement>(
        '[role="option"] svg'
      ),
    ].map((svg) => svg.innerHTML.replace(/_r_[a-z0-9]+_/g, ""));

    expect(faces.length).toBeGreaterThan(1);
    expect(new Set(faces).size).toBe(faces.length);
  });

  it("이미 화자로 붙은 게스트는 패널과 같은 열쇠로 얼굴을 그린다", () => {
    const attachedGuest: SpeakerCandidate = {
      participantId: "01K0000000201",
      userId: null,
      guestId: "01K0000000401",
      name: "이도현",
      email: null,
      assignedLabels: ["C"],
    };
    const { container } = render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[attachedGuest]}
        onAssign={vi.fn()}
      />
    );
    const expected = render(
      <PersonAvatar name={personAvatarKey(attachedGuest)} />
    );

    open();

    const face = (svg: SVGElement | null) =>
      svg?.innerHTML.replace(/_r_[a-z0-9]+_/g, "");
    expect(
      face(
        container.ownerDocument.querySelector<SVGElement>('[role="option"] svg')
      )
    ).toBe(face(expected.container.querySelector("svg")));
  });

  it("기본 범위는 이 화자의 모든 발화다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(
      screen.getByRole("radio", { name: "이 화자의 모든 발화에 적용" })
    ).toBeChecked();
  });

  it("현재 발화에만 적용을 고르면 그 범위로 올린다", () => {
    const onAssign = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={onAssign}
      />
    );

    open();
    chooseScope("현재 발화에만 적용");
    fireEvent.click(screen.getByRole("option", { name: /박서준/ }));

    expect(onAssign).toHaveBeenCalledWith(
      { participantId: "01K0000000102" },
      "segment"
    );
  });

  it("그 자리에서 만든 사람도 고른 범위로 붙는다", () => {
    const onCreateGuest = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onCreateGuest={onCreateGuest}
      />
    );

    open();
    chooseScope("현재 발화에만 적용");
    search("이도현");
    fireEvent.click(screen.getByRole("button", { name: /이도현/ }));

    expect(onCreateGuest).toHaveBeenCalledWith("이도현", "segment");
  });

  it("닫으면 범위가 모든 발화로 되돌아간다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
      />
    );

    open();
    chooseScope("현재 발화에만 적용");
    fireEvent.click(screen.getByRole("option", { name: /박서준/ }));
    open();

    expect(
      screen.getByRole("radio", { name: "이 화자의 모든 발화에 적용" })
    ).toBeChecked();
  });

  it("범위를 바꾸면 아래 버튼이 개별 지정 해제로 바뀐다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        overridden
        onAssign={vi.fn()}
        onClearOverride={vi.fn()}
      />
    );

    open();
    expect(
      screen.getByRole("button", { name: "이름 없이 두기" })
    ).toBeInTheDocument();

    chooseScope("현재 발화에만 적용");

    expect(screen.queryByRole("button", { name: "이름 없이 두기" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "개별 지정 해제" })
    ).toBeInTheDocument();
  });

  it("개별 지정 해제를 누르면 그 발화만 라벨로 되돌린다", () => {
    const onClearOverride = vi.fn();
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        overridden
        onAssign={vi.fn()}
        onClearOverride={onClearOverride}
      />
    );

    open();
    chooseScope("현재 발화에만 적용");
    fireEvent.click(screen.getByRole("button", { name: "개별 지정 해제" }));

    expect(onClearOverride).toHaveBeenCalled();
  });

  it("개별 지정이 없으면 해제를 못 누른다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={candidates}
        onAssign={vi.fn()}
        onClearOverride={vi.fn()}
      />
    );

    open();
    chooseScope("현재 발화에만 적용");

    expect(
      screen.getByRole("button", { name: "개별 지정 해제" })
    ).toBeDisabled();
  });

  it("여러 화자를 맡은 사람은 라벨을 함께 낸다", () => {
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[
          { ...candidates[0], assignedLabels: ["B", "C"] },
          candidates[1],
        ]}
        onAssign={vi.fn()}
      />
    );

    open();

    expect(screen.getByRole("option", { name: /김철수/ })).toHaveTextContent(
      "화자 B·C"
    );
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
