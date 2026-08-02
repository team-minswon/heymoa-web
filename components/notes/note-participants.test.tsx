import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  NoteParticipantAvatars,
  type Participant,
} from "@/components/notes/note-participants";

function participant(index: number): Participant {
  return {
    userId: `01K000000000${index}`,
    name: `참여자${index}`,
    email: `member${index}@heymoa.com`,
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

  // 진행자가 이름순 뒤라 접힘(+N) 안으로 들어가면, 모바일에서는 알아볼 방법이 아예 없어진다.
  it("진행자는 이름순과 무관하게 항상 보이는 자리에 온다", () => {
    render(
      <NoteParticipantAvatars
        participants={Array.from({ length: 5 }, (_, index) =>
          participant(index)
        )}
        starter={{ userId: "01K0000000004", name: "참여자4" }}
        max={2}
      />
    );

    const shown = screen.getAllByLabelText(/@heymoa\.com|참여자4/);
    expect(shown[0]).toHaveAttribute(
      "aria-label",
      "진행자 참여자4 (member4@heymoa.com)"
    );
    expect(screen.getByLabelText("외 3명")).toBeInTheDocument();
  });

  it("이름이 비어 있으면 이메일 첫 글자로 떨어진다", () => {
    render(
      <NoteParticipantAvatars
        participants={[
          { userId: "01K0000000001", name: "  ", email: "zed@heymoa.com" },
        ]}
      />
    );

    expect(screen.getByText("z")).toBeInTheDocument();
  });
});
