import { describe, expect, it } from "vitest";

import {
  summaryToMarkdown,
  transcriptToMarkdown,
} from "@/lib/notes/copy-markdown";
import type { TranscriptRow } from "@/lib/transcription/presentation";

const NOTE = {
  title: "2월 스프린트 회의",
  whenIso: "2026-08-25T05:02:00Z",
  participantCount: 3,
  durationMs: 1_820_000,
};

let sequence = 0;

function segment(
  startedAtMs: number,
  text: string,
  speakerLabel: string | null = null,
  durationMs = 3_000
): TranscriptRow {
  sequence += 1;
  return {
    type: "segment",
    startedAtMs,
    segment: {
      segmentId: `s${sequence}`,
      sequence,
      text,
      startedAtMs,
      endedAtMs: startedAtMs + durationMs,
      speakerLabel,
    },
  };
}

function gap(startedAtMs: number, kind: "PAUSE" | "LOST"): TranscriptRow {
  return {
    type: "gap",
    startedAtMs,
    gap: {
      gapId: `g${startedAtMs}`,
      kind,
      startedAtMs,
      endedAtMs: startedAtMs + 720_000,
      startedAt: "2026-08-25T05:14:00Z",
      endedAt: "2026-08-25T05:26:00Z",
      durationMs: 720_000,
    },
  };
}

const named = (label: string | null | undefined) =>
  label === "A" ? "홍길동" : label === "B" ? "김민수" : null;

describe("transcriptToMarkdown", () => {
  it("머리말에 제목과 회의 사실을 적는다", () => {
    const markdown = transcriptToMarkdown({
      note: NOTE,
      rows: [segment(0, "안녕하세요.")],
      speakerNameOf: () => null,
    });

    expect(markdown.split("\n")[0]).toBe("# 2월 스프린트 회의");
    expect(markdown).toContain("참석자 3명 · 기록 30분");
  });

  it("같은 화자의 이어지는 발화를 한 문단으로 잇는다", () => {
    const markdown = transcriptToMarkdown({
      note: NOTE,
      rows: [
        segment(750_000, "결제 실패율이 3%로 올랐습니다.", "A"),
        segment(754_000, "로그를 보니 카드사 응답이 늦습니다.", "A"),
        segment(761_000, "그럼 결제 쪽부터 보죠.", "B"),
      ],
      speakerNameOf: named,
    });

    expect(markdown).toContain(
      "**홍길동** [12:30]\n결제 실패율이 3%로 올랐습니다. 로그를 보니 카드사 응답이 늦습니다."
    );
    expect(markdown).toContain("**김민수** [12:41]\n그럼 결제 쪽부터 보죠.");
  });

  it("같은 화자라도 오래 비면 문단을 끊는다", () => {
    const markdown = transcriptToMarkdown({
      note: NOTE,
      rows: [
        segment(0, "먼저 이것부터 보죠.", "A"),
        segment(60_000, "다시 왔습니다.", "A"),
      ],
      speakerNameOf: named,
    });

    expect(markdown).toContain("**홍길동** [00:00]\n먼저 이것부터 보죠.");
    expect(markdown).toContain("**홍길동** [01:00]\n다시 왔습니다.");
  });

  it("화자 분리 전에는 화자 줄 없이 시각만 남는다", () => {
    const markdown = transcriptToMarkdown({
      note: NOTE,
      // 실시간 final은 라벨이 늘 null이고, 분리 전에는 호출부가 항상 null을 준다.
      rows: [
        segment(0, "안녕하세요.", "A"),
        segment(4_000, "시작하겠습니다.", "A"),
      ],
      speakerNameOf: () => null,
    });

    expect(markdown).toContain("[00:00] 안녕하세요. 시작하겠습니다.");
    expect(markdown).not.toContain("**");
  });

  it("이름이 같은 두 화자를 한 문단으로 뭉치지 않는다", () => {
    // 동명이인이 붙으면 표시 이름이 같아진다. 라벨이 다르면 다른 사람이다.
    const markdown = transcriptToMarkdown({
      note: NOTE,
      rows: [
        segment(0, "저는 이렇게 봅니다.", "A"),
        segment(4_000, "저는 다르게 봅니다.", "B"),
      ],
      speakerNameOf: () => "김민수",
    });

    expect(markdown).toContain("**김민수** [00:00]\n저는 이렇게 봅니다.");
    expect(markdown).toContain("**김민수** [00:04]\n저는 다르게 봅니다.");
  });

  it("끝까지 저장되지 못한 기록은 그 사실을 달고 나간다", () => {
    const markdown = transcriptToMarkdown({
      note: NOTE,
      rows: [segment(0, "여기서 끊깁니다.", "A")],
      speakerNameOf: named,
      truncated: true,
    });

    expect(
      markdown.trimEnd().endsWith("> 기록이 끝까지 저장되지 못했습니다")
    ).toBe(true);
  });

  it("빈 구간을 인용 줄로 남기고 문단을 끊는다", () => {
    const markdown = transcriptToMarkdown({
      note: NOTE,
      rows: [
        segment(0, "잠깐 쉬죠.", "A"),
        gap(840_000, "PAUSE"),
        segment(1_560_000, "다시 시작합니다.", "A"),
      ],
      speakerNameOf: named,
    });

    expect(markdown).toContain("> 약 12분 중지했습니다");
    expect(markdown).toContain("**홍길동** [26:00]\n다시 시작합니다.");
  });
});

describe("summaryToMarkdown", () => {
  const markdown = summaryToMarkdown({
    note: { ...NOTE, durationMs: undefined },
    sections: [
      {
        kind: "OVERVIEW",
        items: [
          {
            itemId: "i1",
            content: "결제 실패율이 3%로 올랐다",
            evidence: [
              {
                segmentId: "s1",
                text: "로그를 보니 카드사 응답이 늦습니다",
                startedAtMs: 750_000,
              },
            ],
          },
        ],
      },
      {
        kind: "ACTION_ITEM",
        items: [
          { itemId: "i2", content: "카드사 응답 지연 로그 확인", evidence: [] },
        ],
      },
    ],
  });

  it("섹션 헤딩 아래 항목과 근거를 중첩 불릿으로 적는다", () => {
    expect(markdown).toContain(
      "## 개요\n\n- 결제 실패율이 3%로 올랐다\n  - [12:30] 로그를 보니 카드사 응답이 늦습니다"
    );
  });

  it("근거가 없는 항목은 한 줄로 끝난다", () => {
    expect(markdown).toContain(
      "## 액션 아이템\n\n- 카드사 응답 지연 로그 확인\n"
    );
  });

  it("응답에서 빠진 섹션도 헤딩을 남긴다", () => {
    expect(markdown).toContain("## 결정\n\n_없음_");
  });
});
