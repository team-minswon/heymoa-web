import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  NoteParticipantAvatars,
  type Participant,
} from "@/components/notes/note-participants";

function participant(index: number): Participant {
  return {
    participantId: `01K000000010${index}`,
    userId: `01K000000000${index}`,
    guestId: null,
    name: `참여자${index}`,
    email: `member${index}@heymoa.com`,
    image: null,
  };
}

/** 계정 없는 참여자. userId·email이 비고 guestId가 채워진다. */
function guest(index: number): Participant {
  return {
    participantId: `01K000000020${index}`,
    userId: null,
    guestId: `01K000000030${index}`,
    name: `외부인${index}`,
    email: null,
    image: null,
  };
}

function renderAvatars(count: number, max: number) {
  return render(
    <NoteParticipantAvatars
      participants={Array.from({ length: count }, (_, index) =>
        participant(index)
      )}
      max={max}
    />
  );
}

describe("NoteParticipantAvatars", () => {
  afterEach(cleanup);

  it("참여자가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<NoteParticipantAvatars participants={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("max 이하면 전원을 보여주고 넘침 표시가 없다", () => {
    renderAvatars(3, 3);

    expect(screen.getAllByLabelText(/@heymoa\.com/)).toHaveLength(3);
    expect(screen.queryByLabelText(/외 \d+명/)).toBeNull();
  });

  it("max를 넘으면 앞의 max명만 보이고 나머지는 +N으로 접는다", () => {
    renderAvatars(7, 3);

    expect(screen.getAllByLabelText(/@heymoa\.com/)).toHaveLength(3);
    expect(screen.getByLabelText("외 4명")).toHaveTextContent("+4");
  });

  it("아바타 라벨에 이름과 이메일이 함께 들어간다", () => {
    renderAvatars(1, 5);

    expect(
      screen.getByLabelText("참여자0 (member0@heymoa.com)")
    ).toBeInTheDocument();
  });

  /**
   * 얼굴에 글자를 안 얹는다 — 이름은 늘 툴팁에 있다. **이름이 비어도 빈 원으로 남으면 안
   * 된다**: 얼굴은 그 사람의 변하지 않는 식별자에서 나오므로 이름이 없어도 그려진다.
   */
  it("이름이 비어도 얼굴은 그려진다", () => {
    const { container } = render(
      <NoteParticipantAvatars
        participants={[
          {
            participantId: "01K0000000101",
            userId: "01K0000000001",
            guestId: null,
            name: "  ",
            email: "zed@heymoa.com",
          },
        ]}
      />
    );

    expect(container.querySelector("svg")).toBeTruthy();
    // 얼굴에 글자를 안 얹는다.
    expect(container.textContent).toBe("");
  });

  // 같은 열쇠면 같은 얼굴이다 — 저장하지 않아도 흔들리지 않는다.
  it("같은 사람은 늘 같은 얼굴이다", () => {
    const person = {
      participantId: "01K0000000101",
      userId: "01K0000000001",
      guestId: null,
      name: "한지원",
      email: "jiwon@heymoa.com",
    };
    // React 가 매 렌더 새로 뽑는 `useId` 마스크 id 는 얼굴이 아니다 — 빼고 본다.
    const orb = () =>
      render(<NoteParticipantAvatars participants={[person]} />)
        .container.querySelector("svg")
        ?.innerHTML.replace(/_r_[a-z0-9]+_/g, "");

    const first = orb();
    cleanup();
    expect(orb()).toBe(first);
  });

  it("계정 없는 참여자는 이메일 자리에 「외부」가 선다", () => {
    render(<NoteParticipantAvatars participants={[guest(0)]} />);

    expect(screen.getByLabelText("외부인0 (외부)")).toBeInTheDocument();
  });

  /**
   * 계정 없는 사람은 `userId`가 전부 `null`이라 그걸 키로 쓰면 둘 이상일 때 React가
   * 같은 항목으로 보고 하나만 그린다. 키는 참여 기록 식별자여야 한다.
   */
  it("계정 없는 참여자가 여럿이어도 전부 그려진다", () => {
    render(
      <NoteParticipantAvatars participants={[guest(0), guest(1), guest(2)]} />
    );

    expect(screen.getByLabelText("참여자 3명")).toBeInTheDocument();
    expect(screen.getByLabelText("외부인0 (외부)")).toBeInTheDocument();
    expect(screen.getByLabelText("외부인2 (외부)")).toBeInTheDocument();
  });


});
