import { describe, expect, it } from "vitest";

import { timelineToMarkdown } from "@/lib/notes/minutes/markdown";
import {
  buildMinutes,
  hangulMarker,
  minutesFileName,
  minutesTimeline,
  stillOpen,
  type MinutesInclude,
  type MinutesTopic,
} from "@/lib/notes/minutes/model";
import type { ProposalHead } from "@/lib/notes/proposals/contract";
import type { TimelineGroup, TimelineTone } from "@/lib/notes/proposals/timeline";
import type { ReviewItem, ReviewSection } from "@/lib/notes/review/sections";
import type { TranscriptRow } from "@/lib/transcription/presentation";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";

const NOTE = {
  title: "공유 기능 범위 정리",
  whenIso: "2026-10-15T05:00:00Z",
  participantCount: 4,
  participantNames: ["김민수", "강성재", "이서연", "박준호"],
  durationMs: 65 * 60_000,
};

const item = (itemId: string, content: string, extra: Partial<ReviewItem> = {}) =>
  ({ itemId, content, kind: "DECISION", included: true, assignee: null, due: null, ...extra }) as ReviewItem;

const section = (key: ReviewSection["key"], items: ReviewItem[]): ReviewSection => ({
  key,
  label: key,
  items,
  includedCount: items.filter((row) => row.included).length,
});

// 항목이 나온 때. 테스트는 항목 ID 에 분을 적어 둔다(`d@12` → 12분)
const citedAt = (row: ReviewItem) => {
  const minute = /@(\d+)$/.exec(row.itemId)?.[1];
  return minute === undefined ? null : Number(minute) * 60_000;
};

const topic = (title: string, extra: Partial<MinutesTopic> = {}): MinutesTopic => ({
  title,
  gist: null,
  text: "",
  decisions: [],
  tasks: [],
  open: [],
  ...extra,
});

const minutes = (include: MinutesInclude, extra: Partial<Parameters<typeof buildMinutes>[0]> = {}) =>
  buildMinutes({
    note: NOTE,
    topics: [],
    sections: [],
    citedAt,
    include,
    ...extra,
  });

const proposal = (content: string, closeReason: ProposalHead["closeReason"] = null) =>
  ({ proposalId: content, content, closeReason }) as ProposalHead;

const group = (
  title: string | null,
  startMs: number | null,
  endMs: number | null,
  items: [TimelineTone, string, number | null, ProposalHead["closeReason"]?][]
) =>
  ({
    key: `${title}:${startMs}`,
    agenda: title === null ? null : { title, completed: true, retracted: false, citation: null },
    startMs,
    endMs,
    last: false,
    total: items.length,
    items: items.map(([tone, content, atMs, closeReason]) => ({
      proposal: proposal(content, closeReason ?? null),
      tone,
      atMs,
      answers: [],
      answersTo: null,
    })),
  }) as TimelineGroup;

const say = (atMs: number, text: string, speakerLabel: string | null = "A"): TranscriptRow => ({
  type: "segment",
  startedAtMs: atMs,
  segment: { segmentId: `s${atMs}`, sequence: atMs, text, startedAtMs: atMs, endedAtMs: atMs + 1000, speakerLabel },
});

const speakerOf = (label: string | null | undefined): SpeakerIdentity | null =>
  label
    ? { displayName: label === "A" ? "김민수" : `화자 ${label}`, avatarName: "", imageUrl: null, unassigned: label !== "A" }
    : null;

describe("buildMinutes", () => {
  it("머리말은 일시 구간 · 길이 · 참석자 · 이름 미확인 화자 · 공유한 사람을 싣고, 꼬리말과 파일 이름에 회의명과 날짜를 쓴다", () => {
    const doc = minutes({ transcript: false }, { sharedBy: " 김민수 ", unnamedSpeakers: 2 });
    // 끝난 시각을 모르면 시작 시각만 — 기록 길이(65분)를 더해 끝 시각을 지어내지 않는다
    expect(doc.dateLabel).toBe("2026. 10. 15. (목) 14:00");
    // 20분 중지했던 회의는 기록 길이보다 늦게 끝난다. 실제 끝난 시각을 쓴다
    expect(minutes({ transcript: false }, { note: { ...NOTE, endedIso: "2026-10-15T06:25:00Z" } }).dateLabel).toBe(
      "2026. 10. 15. (목) 14:00 – 15:25"
    );
    // 자정을 넘기면 끝난 날도 적는다
    expect(
      minutes({ transcript: false }, { note: { ...NOTE, whenIso: "2026-10-15T14:30:00Z", endedIso: "2026-10-15T15:30:00Z" } }).dateLabel
    ).toBe("2026. 10. 15. (목) 23:30 – 2026. 10. 16. (금) 00:30");
    expect(doc.durationLabel).toBe("1시간 5분");
    expect(doc.attendees).toEqual(NOTE.participantNames);
    expect(doc.attendeeCount).toBe(4);
    expect(doc.unnamedSpeakers).toBe(2);
    expect(doc.sharedBy).toBe("김민수");
    expect(doc.confirmed).toBe(false);
    expect(minutes({ transcript: false }, { confirmed: true }).confirmed).toBe(true);
    expect(doc.footer).toBe("공유 기능 범위 정리 · 2026. 10. 15. 회의록");
    expect(doc.fileName).toBe("회의록_공유 기능 범위 정리_20261015.pdf");
  });

  it("1쪽 핵심은 결론 · 안건 표(요지 · 시작 · 개수) · 담당별 할 일 수다 — 담당 모르는 할 일은 끝에 센다", () => {
    const task = (id: string, name: string | null) =>
      item(id, `할 일 ${id}`, { kind: "ACTION_ITEM", assignee: name ? { type: "USER", id: name, name } : null });
    const doc = minutes(
      { transcript: false },
      {
        headline: " 범위를 메일과 PDF로 나눈다 ",
        lead: ["PDF는 web이 만든다.", " "],
        topics: [
          topic("외부 공유", {
            gist: "메일과 PDF로 나누기로 했다",
            startMs: 3 * 60_000,
            decisions: [item("d@12", "PDF로 보낸다")],
            tasks: [task("t1", "김민수"), task("t2", null), task("t3", "김민수")],
          }),
          topic("발송 상한", { text: "시간당 상한을 둔다", open: [item("q1", "몇 건이 맞나?", { kind: "QUESTION" })] }),
        ],
      }
    );
    expect(doc.headline).toBe("범위를 메일과 PDF로 나눈다");
    expect(doc.lead).toEqual(["PDF는 web이 만든다."]);
    expect(doc.agendas).toEqual([
      { no: 1, title: "외부 공유", gist: "메일과 PDF로 나누기로 했다", start: "03:00", decisions: 1, actions: 3, open: 0 },
      { no: 2, title: "발송 상한", gist: "시간당 상한을 둔다", start: null, decisions: 0, actions: 0, open: 1 },
    ]);
    expect(doc.owners).toEqual([
      { name: "김민수", count: 2 },
      { name: null, count: 1 },
    ]);
  });

  it("안건 요지는 한 줄 요약, 없으면 서술의 첫 문장이고, 그래도 길면 줄여 「…」를 단다 — 1쪽 표 행은 쪽을 넘기지 못한다", () => {
    const long = "설명 문장이 길게 이어집니다 ".repeat(30).trim();
    const doc = minutes(
      { transcript: false },
      {
        topics: [
          topic("첫 문장", { text: "메일로 보낸다. 상한은 30건이다.", decisions: [item("d1", "a")] }),
          topic("긴 서술", { text: long, decisions: [item("d2", "b")] }),
        ],
      }
    );
    expect(doc.agendas[0].gist).toBe("메일로 보낸다.");
    expect(doc.agendas[1].gist!.length).toBeLessThanOrEqual(61);
    expect(doc.agendas[1].gist!.endsWith("…")).toBe(true);
  });

  it("상세는 결정 · 할 일 · 미결을 한 번씩 번호 매겨 안건 번호 · 녹취록 시각과 싣고, 두 안건에 걸린 항목은 한 번, 뺀 항목은 안 싣는다", () => {
    const shared = item("t@31", "도메인 인증을 신청한다", { kind: "ACTION_ITEM" });
    const doc = minutes(
      { transcript: false },
      {
        topics: [
          topic("외부 공유", {
            decisions: [item("d@12", "PDF로 보낸다"), item("dx", "뺀 결정", { included: false })],
            tasks: [shared],
            open: [
              item("q@5", "기한을 넣을 수 있나?", { kind: "QUESTION", assignee: { type: "USER", id: "u1", name: "강성재" } }),
            ],
          }),
          topic("발송 상한", { tasks: [shared] }),
        ],
        sections: [section("DECISION", [item("d9", "목요일에 다시 본다")]), section("ACTION_ITEM", [shared])],
      }
    );
    expect(doc.decisions).toEqual([
      { no: 1, text: "PDF로 보낸다", agendaNo: 1, at: "12:00" },
      { no: 2, text: "목요일에 다시 본다", agendaNo: null, at: null },
    ]);
    expect(doc.actions).toEqual([
      { no: 1, content: "도메인 인증을 신청한다", assignee: null, due: null, agendaNo: 1, at: "31:00" },
    ]);
    expect(doc.open).toEqual([{ no: 1, content: "기한을 넣을 수 있나?", assignee: "강성재", agendaNo: 1, at: "05:00" }]);
    // 항목이 다 앞 안건으로 간 「발송 상한」은 요지도 없어 싣지 않는다. 안건에 안 든 결정은 번호 없는 「기타」다
    expect(doc.agendas.map((agenda) => [agenda.no, agenda.title])).toEqual([
      [1, "외부 공유"],
      [null, "기타"],
    ]);
  });

  it("담당 · 기한을 지어내지 않는다 — 모르면 비워 두고(렌더러가 「확인 필요」로 적는다), 아는 것만 사람 말로 옮긴다", () => {
    const doc = minutes(
      { transcript: false },
      {
        topics: [
          topic("외부 공유", {
            tasks: [
              item("a1", "계약을 docs에 올린다", { kind: "ACTION_ITEM" }),
              item("a2", "도메인 인증을 신청한다", {
                kind: "ACTION_ITEM",
                assignee: { type: "USER", id: "u1", name: "김민수" },
                due: "2026-10-20",
              }),
              item("a3", "화자에게 맡긴 일", { kind: "ACTION_ITEM", assignee: { type: "SPEAKER_LABEL", noteId: "n", label: "B" } }),
            ],
          }),
        ],
      }
    );
    expect(doc.actions.map(({ assignee, due }) => [assignee, due])).toEqual([
      [null, null],
      ["김민수", "10월 20일 (화)"],
      ["화자 B", null],
    ]);
  });

  it("녹취록은 고를 때만 싣는다", () => {
    const transcript = { rows: [say(0, "시작합니다")], speakerOf, truncated: true };
    expect(minutes({ transcript: false }, { transcript }).transcript).toBeNull();
    const doc = minutes({ transcript: true }, { transcript });
    expect(doc.transcript).toHaveLength(1);
    expect(doc.transcriptTruncated).toBe(true);
  });

  it("부록 녹취록은 같은 화자의 이어진 말을 잇고, 안건이 처음 나온 자리에 안건 줄을 넣고, 본문 항목이 근거로 든 발언에 번호를 단다", () => {
    const cited = (segmentId: string) => [{ role: "EVIDENCE", segmentId }] as unknown as ReviewItem["citations"];
    const doc = minutes(
      { transcript: true },
      {
        topics: [
          topic("외부 공유", {
            startMs: 4_000,
            decisions: [item("d1", "PDF로 보낸다", { citations: cited("s4000") })],
            tasks: [item("t1", "양식을 공유한다", { kind: "ACTION_ITEM", citations: cited("s6000") })],
          }),
        ],
        transcript: {
          rows: [
            say(0, "시작합니다."),
            say(2000, "안건은 하나입니다."),
            say(4000, "PDF로 가죠.", "B"),
            say(6000, "양식은 제가 돌릴게요.", "B"),
            say(8000, "누군가", null),
          ],
          speakerOf,
          truncated: false,
        },
      }
    );
    expect(doc.transcript).toEqual([
      { type: "utterance", at: "00:00", speaker: "김민수", unnamed: false, text: "시작합니다. 안건은 하나입니다.", refs: [] },
      { type: "agenda", at: "00:04", no: 1, title: "외부 공유" },
      {
        type: "utterance",
        at: "00:04",
        speaker: "화자 B",
        unnamed: true,
        text: "PDF로 가죠. 양식은 제가 돌릴게요.",
        refs: ["결정 1", "할 일 1"],
      },
      { type: "utterance", at: "00:08", speaker: null, unnamed: false, text: "누군가", refs: [] },
    ]);
  });

  it("이름이 같아도 다른 사람이면 잇지 않는다 — 같은 사람인지는 배정된 참여자 · 화자 라벨로 가린다", () => {
    const sameName = () => ({ displayName: "김민수", avatarName: "", imageUrl: null, unassigned: false });
    const row = (atMs: number, text: string, participant: string) => {
      const base = say(atMs, text, "A");
      return base.type === "segment" ? { ...base, segment: { ...base.segment, assignedParticipantId: participant } } : base;
    };
    const doc = minutes(
      { transcript: true },
      { transcript: { rows: [row(0, "제가 할게요.", "p1"), row(2000, "아니요 제가요.", "p2"), row(4000, "그럼 둘이 같이.", "p2")], speakerOf: sameName, truncated: false } }
    );
    expect(doc.transcript!.map((line) => (line.type === "utterance" ? `${line.at} ${line.text}` : line.type))).toEqual([
      "00:00 제가 할게요.",
      "00:02 아니요 제가요. 그럼 둘이 같이.",
    ]);
  });

  it("어느 안건에도 들지 않은 질문 · 이슈는 「기타」의 미결로 싣는다", () => {
    const doc = minutes(
      { transcript: false },
      { topics: [topic("외부 공유", { decisions: [item("d1", "PDF로 보낸다")] })], unfiledOpen: [item("q@2", "누가 메일 문구를 쓰나?", { kind: "QUESTION" })] }
    );
    expect(doc.open).toEqual([{ no: 1, content: "누가 메일 문구를 쓰나?", assignee: null, agendaNo: null, at: "02:00" }]);
    expect(doc.agendas.at(-1)).toMatchObject({ no: null, title: "기타", open: 1 });
  });

  it("구간 하나가 이미 길면 낱말 사이에서 여러 줄로 나누고, 이은 줄에는 시각 · 번호를 다시 적지 않는다", () => {
    const words = Array.from({ length: 200 }, (_, index) => `말${index}`).join(" ");
    const doc = minutes({ transcript: true }, { transcript: { rows: [say(0, words)], speakerOf, truncated: false } });
    const lines = doc.transcript!.filter((line) => line.type === "utterance");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.text.length <= 400)).toBe(true);
    expect(lines.map((line) => line.text).join(" ")).toBe(words);
    expect(lines.slice(1).every((line) => line.at === "")).toBe(true);
  });

  it("줄바꿈이 많은 말은 글자가 적어도 여덟 줄마다 끊고, 같은 화자를 이을 때도 그 줄 수를 넘기지 않는다", () => {
    const many = Array.from({ length: 80 }, () => "발언").join("\n");
    const doc = minutes({ transcript: true }, { transcript: { rows: [say(0, many)], speakerOf, truncated: false } });
    const lines = doc.transcript!.filter((line) => line.type === "utterance");
    expect(lines).toHaveLength(10);
    expect(lines.every((line) => line.text.split("\n").length <= 8)).toBe(true);

    const five = Array.from({ length: 5 }, () => "말").join("\n");
    const joined = minutes({ transcript: true }, { transcript: { rows: [say(0, five), say(1000, five)], speakerOf, truncated: false } });
    expect(joined.transcript).toHaveLength(2);
  });

  it("너무 길어지면 같은 화자라도 새 줄로 끊는다 — 한 줄은 쪽을 넘기지 못한다", () => {
    const long = "가".repeat(250);
    const doc = minutes({ transcript: true }, { transcript: { rows: [say(0, long), say(1000, long)], speakerOf, truncated: false } });
    expect(doc.transcript).toHaveLength(2);
  });
});

describe("stillOpen", () => {
  const fromProposal = (itemId: string, proposalId: string) =>
    item(itemId, itemId, { kind: "QUESTION", originalProposalRef: { proposalId, revision: 1 } });

  it("원장에서 아직 열린 질문과 사람이 더한 질문만 남기고, 답한 질문은 뺀다", () => {
    const ledger = [group(null, 0, null, [["open", "p-open", 1_000], ["answered", "p-done", 2_000]])];
    const items = [fromProposal("q1", "p-open"), fromProposal("q2", "p-done"), item("q3", "사람이 더한 질문", { kind: "QUESTION", originalProposalRef: null })];
    expect(stillOpen(items, ledger).map((row) => row.itemId)).toEqual(["q1", "q3"]);
  });
});

describe("minutesTimeline", () => {
  it("결정 · 후속 조치 · 미결만 글자 구분과 함께 싣고, 답한 질문 · 참고 · 철회된 줄과 빈 안건은 뺀다", () => {
    const rows = minutesTimeline(
      [
        group("외부 공유", 0, 750_000, [
          ["decision", "메일과 PDF로 보낸다", 65_000],
          ["answered", "답한 질문", 70_000],
          ["reference", "참고", 80_000],
          ["decision", "철회된 결정", 90_000, "RETRACTED"],
        ]),
        group("빈 안건", 750_000, 800_000, [["reference", "참고만", 760_000]]),
        group(null, 800_000, null, [
          ["task", "계약을 올린다", 3_725_000],
          ["open", "기한을 넣을 수 있나?", null],
        ]),
      ],
      3_900_000
    );
    expect(rows).toEqual([
      {
        title: "외부 공유",
        range: "00:00 – 12:30",
        rows: [{ at: "01:05", tone: "decision", label: "결정", text: "메일과 PDF로 보낸다" }],
      },
      {
        title: "기타",
        range: "13:20 – 1:05:00",
        rows: [
          { at: "1:02:05", tone: "task", label: "후속 조치", text: "계약을 올린다" },
          { at: null, tone: "open", label: "미결", text: "기한을 넣을 수 있나?" },
        ],
      },
    ]);
  });

  it("안건 정본이 없는 회의는 머리 없이 한 묶음이다", () => {
    expect(minutesTimeline([group(null, 0, null, [["decision", "정했다", 1000]])])[0]).toMatchObject({
      title: null,
      range: null,
    });
  });
});

describe("markdown", () => {
  it("타임라인 복사는 요약 · 스크립트 복사와 같은 머리말 아래 안건마다 시각 · 구분 · 내용 한 줄씩이다", () => {
    expect(
      timelineToMarkdown(NOTE, [
        { title: "외부 공유", range: "00:00 – 12:30", rows: [{ at: "01:05", tone: "decision", label: "결정", text: "PDF로 보낸다" }] },
      ])
    ).toBe(
      "# 공유 기능 범위 정리 — 타임라인\n\n2026년 10월 15일 오후 2:00 · 참석자 김민수, 강성재, 이서연, 박준호 · 기록 65분\n\n## 외부 공유 (00:00 – 12:30)\n\n- [01:05] **결정** PDF로 보낸다\n"
    );
    expect(timelineToMarkdown(NOTE, [])).toContain("_정해진 것 · 남은 것이 아직 없습니다_");
  });
});


describe("hangulMarker · minutesFileName", () => {
  it("공문서 항목 기호는 가 … 하 다음 거로 잇는다", () => {
    expect([0, 1, 13, 14, 15].map(hangulMarker)).toEqual(["가", "나", "하", "거", "너"]);
    expect(hangulMarker(84)).toBe("85");
  });

  it("파일 이름에서 못 쓰는 글자를 걷는다", () => {
    expect(minutesFileName('A/B: "결정"?', "2026-10-15T15:30:00Z")).toBe("회의록_A B 결정_20261016.pdf");
    expect(minutesFileName("  ...  ", "2026-10-15T05:00:00Z")).toBe("회의록_회의_20261015.pdf");
  });
});
