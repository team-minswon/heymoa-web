// @vitest-environment node
import path from "node:path";

import { describe, expect, it } from "vitest";

import { breakableWord, pieces, renderMinutesPdfInline } from "@/components/notes/minutes/minutes-pdf";
import { buildMinutes, type MinutesInclude } from "@/lib/notes/minutes/model";
import type { ReviewItem } from "@/lib/notes/review/sections";
import type { TranscriptRow } from "@/lib/transcription/presentation";

const FONTS = path.resolve(__dirname, "../../../public/fonts/minutes");

const doc = (include: MinutesInclude) =>
  buildMinutes({
    note: { title: "공유 기능 범위 정리", whenIso: "2026-10-15T05:00:00Z", participantCount: 2, participantNames: ["김민수", "똠방각"], durationMs: 3_120_000 },
    topics: [
      {
        title: "외부 공유",
        gist: "메일과 PDF로 나누기로 했다",
        text: "",
        startMs: 0,
        decisions: [{ itemId: "d1", content: "PDF로 보낸다", kind: "DECISION", included: true } as ReviewItem],
        tasks: [],
        open: [],
      },
    ],
    sections: [],
    citedAt: () => 65_000,
    headline: "PDF로 보낸다",
    transcript: {
      rows: [
        {
          type: "segment",
          startedAtMs: 0,
          segment: { segmentId: "s0", sequence: 0, text: "시작합니다", startedAtMs: 0, endedAtMs: 1000, speakerLabel: "A" },
        } as TranscriptRow,
      ],
      speakerOf: () => ({ displayName: "화자 A", avatarName: "", imageUrl: null, unassigned: true }),
      truncated: false,
    },
    include,
  });

async function render(include: MinutesInclude) {
  const bytes = Buffer.from(await (await renderMinutesPdfInline(doc(include), FONTS)).arrayBuffer());
  return { head: bytes.subarray(0, 5).toString("latin1"), pages: bytes.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length };
}

describe("renderMinutesPdfInline", () => {
  // 쪽 수로 「붙임은 새 쪽에서 시작한다」를 본다. 글자 모양은 사람이 PDF 를 열어 본다(jsdom 은 그리지 못한다)
  it("목차 뒤 안건 전문과 상세를 새 쪽에서 읽고 녹취록은 별도 부록으로 붙는다", async () => {
    expect(await render({ transcript: false })).toEqual({ head: "%PDF-", pages: 3 });
    expect(await render({ transcript: true })).toEqual({ head: "%PDF-", pages: 4 });
  }, 30_000);

  it("한 쪽보다 긴 항목은 여러 행으로 나뉘어 다음 쪽으로 이어진다 — 한 행에 두면 뒤가 쪽 밖으로 잘린다", async () => {
    const long = Array.from({ length: 80 }, (_, index) => `${index + 1}번째 줄`).join("\n");
    const parts = pieces(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("\n")).toBe(long);
    expect(parts.every((part) => part.split("\n").length <= 8)).toBe(true);

    const base = doc({ transcript: false });
    const longDoc = { ...base, actions: [{ no: 1, content: long, assignee: null, due: null, agendaNo: 1, at: null }] };
    const bytes = Buffer.from(await (await renderMinutesPdfInline(longDoc, FONTS)).arrayBuffer());
    expect(bytes.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length).toBeGreaterThan(2);
  }, 30_000);

  it("빈칸 없이 긴 한 줄도 글자 수로 끊고, 글을 하나도 버리지 않는다", () => {
    const line = "가".repeat(1000);
    const parts = pieces(line);
    expect(parts.every((part) => part.length <= 320)).toBe(true);
    expect(parts.join("")).toBe(line);
  });

  it("3시간 분량의 긴 녹취록도 빈 마지막 표에 몰리지 않고 여러 쪽에 나뉜다", async () => {
    const base = doc({ transcript: true });
    const longDoc = { ...base, transcript: Array.from({ length: 1800 }, (_, index) => ({
      type: "utterance" as const, at: `${Math.floor(index / 10)}:00`, speaker: "AlexandriaChristopherSmith", unnamed: false,
      text: `${index + 1}번째 발언입니다. 안건과 할 일을 확인했습니다. 근거와 일정을 함께 확인했습니다.`, refs: [],
    })) };
    const bytes = Buffer.from(await (await renderMinutesPdfInline(longDoc, FONTS)).arrayBuffer());
    expect(bytes.toString("latin1").match(/\/Type \/Page\b(?!s)/g)!.length).toBeGreaterThan(30);
  }, 90_000);

  it("빈칸 없이 긴 낱말은 글자마다 줄을 바꿀 수 있고, 짧은 낱말은 그대로다", () => {
    expect(breakableWord("회의록")).toEqual(["회의록"]);
    expect(breakableWord("abcdefgh")).toEqual(["abcdefgh"]);
    // 좁은 담당 칸의 긴 한글 이름은 음절 사이에서 끊는다
    expect(breakableWord("크리스토퍼스미스").filter(Boolean)).toHaveLength(8);
    const url = "https://example.com/" + "a".repeat(40);
    expect(breakableWord(url).filter(Boolean).join("")).toBe(url);
    expect(breakableWord(url).length).toBe(url.length * 2);
  });

  it("안건 여덟 개의 긴 전문을 보존하고 본문 링크 없이 북마크로 탐색한다", async () => {
    const gist = "요지 문장이 길게 이어집니다 ".repeat(20);
    const topics = Array.from({ length: 8 }, (_, index) => ({
      title: `안건 ${index + 1} 제목이 조금 깁니다`,
      gist,
      text: "",
      startMs: index * 60_000,
      decisions: [{ itemId: `d${index}`, content: "정했다", kind: "DECISION", included: true } as ReviewItem],
      tasks: [],
      open: [],
    }));
    const big = buildMinutes({
      note: { title: "긴 회의", whenIso: "2026-10-15T05:00:00Z", participantCount: 5, participantNames: ["가", "나", "다", "라", "마"] },
      headline: "한 줄 결론",
      lead: ["요약 문장 하나입니다.", "요약 문장 둘입니다."],
      topics,
      sections: [],
      citedAt: () => null,
      include: { transcript: false },
    });
    const bytes = Buffer.from(await (await renderMinutesPdfInline(big, FONTS)).arrayBuffer());
    expect(bytes.toString("latin1").match(/\/Type \/Page\b(?!s)/g)?.length).toBeGreaterThan(2);
    expect(bytes.toString("latin1")).toContain("/Outlines");
    expect(bytes.toString("latin1")).not.toContain("/Subtype /Link");
    expect(bytes.toString("latin1")).toContain("minutes-agenda-1");
  }, 30_000);
});
