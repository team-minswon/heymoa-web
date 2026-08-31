import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SpeakerAssignMenu,
  type SpeakerCandidate,
} from "@/components/notes/speaker-assign-menu";
import {
  createSpeakerIdentityResolver,
  type SpeakerIdentity,
} from "@/lib/transcription/speaker-identity";

const identity: SpeakerIdentity = {
  displayName: "화자 A",
  tint: "var(--el-gradient-sky)",
  initial: "화",
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

/** 계정 없는 참여자. `userId`·`email`이 비고 이메일 자리에 「외부」가 선다. */
const guestCandidate: SpeakerCandidate = {
  participantId: "01K0000000201",
  userId: null,
  name: "이도현",
  email: null,
};

/** 워크스페이스에는 있는데 **이 회의에는 없는** 임시 참여자. 검색해야 보인다. */
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

/**
 * 한글 IME 흉내. **마지막 글자가 아직 조합 중인 상태**로 남긴다 — 「이민형」을 치면
 * 「이민」까지 확정되고 「형」은 조합 중이다.
 *
 * base-ui 가 조합 중에는 controlled 값을 일부러 안 올려서(`ComboboxInput.js`, 옵션이
 * 조기에 걸러져 `Empty` 가 잘못 뜨는 것을 막으려는 것), 그 값만 보면 마지막 글자가 늘 빠진다.
 */
function compose(committed: string, composing: string) {
  const input = screen.getByRole("combobox", { name: /참석자 검색/ });
  // **`input` 이벤트여야 한다.** `fireEvent.change` 는 React 의 `onChange` 만 태우고
  // `onInput` 은 안 태운다 — 실제 브라우저에서는 둘 다 같은 native `input` 이벤트다.
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
    ).toEqual(["김김철수kim@example.com", "박박서준park@example.com"]);
    expect(
      screen.getByRole("button", { name: "이름 안 붙임" })
    ).toBeInTheDocument();
  });

  /**
   * **계정 식별자가 아니라 참여 기록 식별자다** (APP-491·494). 계정으로 가리키면 계정 없는
   * 참여자는 그 값이 없어 화자에 붙일 방법이 아예 없다.
   */
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

    expect(onAssign).toHaveBeenCalledWith({ participantId: "01K0000000102" }, "label");
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

    expect(onAssign).toHaveBeenCalledWith({ participantId: "01K0000000201" }, "label");
  });

  /**
   * 후보가 **이 회의의 참여자를 넘어** 워크스페이스 멤버 전원이라, 아직 참여 기록이 없는
   * 사람이 섞인다. 그 사람에게는 가리킬 참여 기록이 없어 계정으로 가리킨다 — 서버가 같은
   * 요청 안에서 참여자로 넣는다.
   */
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

  /**
   * 이 회의 밖의 임시 참여자다. **기본 목록에는 안 쌓고 이름을 쳤을 때만** 나타난다 —
   * 늘 보이면 회의와 상관없는 이름으로 불어나고, 아예 빼면 사람이 같은 이름을 하나 더 만든다.
   */
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

    // **여기가 중복이 생기던 자리다.** 후보에 없으면 「＋ "최유진" 추가」가 떠서 같은 이름이
    // 하나 더 만들어졌다.
    expect(screen.queryByRole("button", { name: /추가/ })).toBeNull();

    fireEvent.click(screen.getByRole("option", { name: /최유진/ }));
    expect(onAssign).toHaveBeenCalledWith({ guestId: "01K0000000301" }, "label");
  });

  /**
   * **닫는 길이 여럿이면 초기화가 샌다.** 「현재 발화에만 적용」을 골라 둔 채 남으면, 다음에
   * 다른 화자를 누른 사람이 「모든 발화」인 줄 알고 **한 줄만 바꾼다** — 라디오는 메뉴
   * 아래라 눈에 안 들어온다.
   */
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

  /** 실패를 빈 목록으로 두면 「없다」로 읽힌다 — 사람이 그 사람이 없다고 믿는다. */
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

  /**
   * **한글은 조합이 끝나기 전까지 걸러지지 않았다.**
   *
   * 콤보박스가 조합 중에는 controlled 값을 안 올려서, 「박」을 친 순간 목록이 하나도 안
   * 좁혀졌다. 후보가 이 회의 사람 몇에서 **워크스페이스 전원**으로 넓어지면서 그 차이가
   * 눈에 띄게 커졌다 — 이름을 쳤는데 남 이름이 그대로 서 있다.
   */
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

  /**
   * **문구만 바뀌고 저장하는 값은 그대로 `null`이다.** 「참석자 아님」은 계정 없는 사람도
   * 참석자가 될 수 있게 된 뒤로 거짓이 됐다 — 뜻은 「붙일 이름을 못 찾았다」이고,
   * 미결정(이 메뉴를 아직 안 누른 상태)과는 다른 값이다.
   */
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
    fireEvent.click(screen.getByRole("button", { name: "이름 안 붙임" }));

    expect(onAssign).toHaveBeenCalledWith(null, "label");
  });

  it("만드는 중에는 읽기 전용이다 — 숨기지는 않는다", () => {
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
      screen.getByRole("button", { name: "이름 안 붙임" })
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
    // 이제는 경고가 아니라 정보다 — 골라도 저쪽은 안 떨어진다(V31).
    // 그래도 **누르기 전에** 보여야 쪼개진 것을 합치는 중인지 알 수 있다.
    render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[{ ...candidates[0], assignedLabels: ["B"] }, candidates[1]]}
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
    ).toEqual(["박박서준park@example.com"]);
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

  /** 알아본 자리와 고치는 자리가 같아야 한다는 판단이 여기서 성립한다. */
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

  /**
   * **조합 중인 마지막 글자가 빠지면 안 된다.** 「이민형」을 치면 「형」이 아직 조합 중이라
   * base-ui 의 값은 「이민」에 머문다. 그대로 쓰면 버튼이 「"이민" 추가」로 뜨고, 눌러도
   * 「이민」이라는 사람이 만들어진다 — 이름을 한 글자 더 치고 지워야 제대로 되는 상태였다.
   */
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

  /** 조합이 끝난 이름과 정확히 같으면 추가가 안 떠야 한다 — 동명이인 방지가 안 풀려야 한다. */
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

  // 사진이 없는 사람은 이니셜 아바타로 나오는데, 여기가 중립색이면 고를 때 회색이던
  // 얼굴이 붙는 순간 파스텔로 바뀐다. 같은 사람이 두 번 다르게 보인다.
  it("사진이 없으면 붙은 뒤와 같은 색으로 그린다", () => {
    const { container } = render(
      <SpeakerAssignMenu
        identity={identity}
        candidates={[candidates[0]]}
        onAssign={vi.fn()}
      />
    );

    open();

    // 이 사람을 화자 A 에 붙이면 칩이 쓸 색
    const afterAssign = createSpeakerIdentityResolver([
      {
        label: "A",
        assignedName: "김철수",
        assignedParticipantId: "01K0000000101",
      },
    ] as never)("A");
    const avatar = container.ownerDocument.querySelector<HTMLElement>(
      '[role="option"] span[aria-hidden] span[aria-hidden]'
    );

    expect(avatar?.style.backgroundColor).toBe(afterAssign?.tint);
    expect(avatar?.style.backgroundColor).toBeTruthy();
  });

  // ── 지정 범위 ──────────────────────────────────────────────────────────────

  /** 대개 그 화자의 말 전부가 같은 사람이다. 한 줄만 고치는 것은 예외다. */
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

    expect(onAssign).toHaveBeenCalledWith({ participantId: "01K0000000102" }, "segment");
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

  /**
   * **범위가 남으면 다음 사람이 한 줄만 바꾼다.** 라디오는 화면 아래라 눈에 안 들어오는데,
   * 「모든 발화」를 고른 줄 알고 눌렀다가 한 줄만 바뀌면 고쳤다고 믿고 지나간다.
   */
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
    // 고르면 닫힌다
    fireEvent.click(screen.getByRole("option", { name: /박서준/ }));
    open();

    expect(
      screen.getByRole("radio", { name: "이 화자의 모든 발화에 적용" })
    ).toBeChecked();
  });

  /**
   * 발화 단위에는 「참석자 아님」이 없다 — 그 값은 라벨 단위에만 있다. 대신 그 칸이
   * **개별 지정을 되돌리는 자리**가 된다.
   */
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
      screen.getByRole("button", { name: "이름 안 붙임" })
    ).toBeInTheDocument();

    chooseScope("현재 발화에만 적용");

    expect(screen.queryByRole("button", { name: "이름 안 붙임" })).toBeNull();
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

  /** 없는 것을 해제하는 버튼이 서 있으면 무엇이 되돌려지는지가 거짓말이 된다. */
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

    expect(screen.getByRole("button", { name: "개별 지정 해제" })).toBeDisabled();
  });

  /** 한 사람이 여러 화자를 맡을 수 있게 된 뒤로는 라벨이 여러 개 붙는다. */
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
