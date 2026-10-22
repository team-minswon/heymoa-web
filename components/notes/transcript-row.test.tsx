import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sameTranscriptRow,
  TranscriptRow,
} from "@/components/notes/transcript-row";

const chipRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/components/notes/speaker-chip", () => ({
  SpeakerChip: () => {
    chipRenders.count += 1;
    return <span data-testid="speaker-chip" />;
  },
}));

const segment = {
  segmentId: "01K0000000071",
  sequence: 1,
  text: "다음 주까지 정리하겠습니다.",
  startedAtMs: 61_000,
  endedAtMs: 63_000,
  speakerLabel: "A",
};
const speaker = {
  displayName: "화자 A",
  avatarName: "A",
  imageUrl: null,
  unassigned: true,
};

describe("TranscriptRow", () => {
  afterEach(cleanup);

  it("내용이 같은 줄은 새 객체로 와도 다시 그리지 않는다", () => {
    chipRenders.count = 0;
    const view = render(
      <TranscriptRow segment={segment} speaker={speaker} focus={null} />
    );
    expect(chipRenders.count).toBe(1);

    // 실시간 줄이 재조회로 서버의 같은 줄로 바뀌는 경우
    view.rerender(
      <TranscriptRow
        segment={{ ...segment, sequence: 9 }}
        speaker={speaker}
        focus={null}
      />
    );
    expect(chipRenders.count).toBe(1);
  });

  it("글자·화자·집힌 상태가 바뀌면 다시 그린다", () => {
    const base = { segment, speaker, focus: null };
    expect(sameTranscriptRow(base, { ...base })).toBe(true);
    expect(
      sameTranscriptRow(base, {
        ...base,
        segment: { ...segment, text: "고친 문장입니다." },
      })
    ).toBe(false);
    expect(
      sameTranscriptRow(base, {
        ...base,
        segment: { ...segment, speakerLabel: "B" },
      })
    ).toBe(false);
    expect(sameTranscriptRow(base, { ...base, speaker: { ...speaker } })).toBe(
      false
    );
    expect(
      sameTranscriptRow(base, {
        ...base,
        focus: { ref: undefined, markProps: {} },
      })
    ).toBe(false);
  });

  it("짚힌 줄은 형광 표시와 포커스 속성을 단다", () => {
    const { getByTestId } = render(
      <TranscriptRow
        segment={segment}
        speaker={null}
        focus={{ ref: undefined, markProps: { className: "evidence-mark" } }}
      />
    );
    const row = getByTestId("transcript-block");
    expect(row).toHaveAttribute("data-focused", "true");
    expect(row.querySelector(".evidence-mark")).toHaveTextContent(
      "다음 주까지"
    );
  });
});
