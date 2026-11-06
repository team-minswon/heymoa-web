import { describe, expect, it } from "vitest";

import { createHelpDemoState, helpDemoPack } from "@/lib/mocks/help-demo";

/**
 * 영어 프리셋 (APP-1511). 영어 가이드의 캡처는 한국어 캡처와 같은 장면을 같은 자리에서 찍는다 —
 * 그래서 ID·개수·발화 시각·화자가 한국어와 같아야 하고, 화면에 나가는 글자에 한글이 없어야 한다.
 */
const NOW = Date.parse("2026-04-30T05:00:00Z");
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

const ko = createHelpDemoState(NOW, "ko");
const en = createHelpDemoState(NOW, "en");

/** 값 안의 문자열 중 한글이 든 것. 경로를 붙여 어디인지 보인다 */
function hangulStrings(value: unknown, at = "$"): string[] {
  if (typeof value === "string") return HANGUL.test(value) ? [`${at}: ${value}`] : [];
  if (value instanceof Map) return [...value].flatMap(([key, v]) => hangulStrings(v, `${at}[${String(key)}]`));
  if (Array.isArray(value)) return value.flatMap((v, index) => hangulStrings(v, `${at}[${index}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, v]) => hangulStrings(v, `${at}.${key}`));
  return [];
}

describe("가이드 캡처 프리셋 — 영어", () => {
  it("화면에 나가는 상태에 한글이 없다", () => {
    expect(hangulStrings(en)).toEqual([]);
  });

  it("한국어 프리셋과 ID 와 개수가 같다", () => {
    const ids = (state: typeof ko) => ({
      workspaces: state.workspaces.map((w) => w.workspaceId),
      projects: state.projects.map((p) => p.projectId),
      notes: state.notes.map((n) => [n.noteId, n.meetingStatus, n.participants.length]),
      members: state.members.map((m) => m.userId),
      segments: state.segments.length,
      chats: state.agentChats.map((c) => c.chatId),
      messages: state.agentChatMessages.length,
      feedbacks: state.feedbacks.map((f) => f.feedbackId),
      delegations: state.agentDelegations.map((d) => d.delegationId),
    });
    expect(ids(en)).toEqual(ids(ko));
  });

  it("발화의 시각과 화자 라벨이 한국어와 같다 — 근거가 가리키는 시각이 두 언어에서 같다", () => {
    const timing = (state: typeof ko) =>
      state.segments.map((s) => [s.segmentId, s.startedAtMs, s.endedAtMs, s.speakerLabel]);
    expect(timing(en)).toEqual(timing(ko));
  });

  it("화자 지정 상태가 같다", () => {
    const shape = (state: typeof ko) =>
      [...state.diarizations].map(([noteId, d]) => [
        noteId,
        d.status,
        d.speakers?.map((s) => [s.label, s.segmentCount, s.confirmed]),
      ]);
    expect(shape(en)).toEqual(shape(ko));
  });

  it("검토본·할 일·용어·실시간 대본도 영어이고 모양이 같다", () => {
    const [koPack, enPack] = [helpDemoPack("ko"), helpDemoPack("en")];
    const reviewShape = (pack: typeof koPack) =>
      pack.reviewSets().map((set) => [
        set.noteId,
        set.flow,
        set.topics.map((topic) => topic.items.map((item) => [item.kind, item.at, item.who ?? null])),
        set.loose.length,
      ]);
    expect(reviewShape(enPack)).toEqual(reviewShape(koPack));
    expect(enPack.taskRows().length).toBe(koPack.taskRows().length);
    expect(enPack.terms.length).toBe(koPack.terms.length);
    expect(enPack.liveScript.length).toBe(koPack.liveScript.length);
    expect(enPack.endedItems.map((item) => item.kind)).toEqual(koPack.endedItems.map((item) => item.kind));
    expect(
      hangulStrings([
        enPack.reviewSets(),
        enPack.taskRows(),
        enPack.terms,
        enPack.chatAnswers,
        enPack.liveScript,
        enPack.endedItems,
        enPack.agendaMap.links(),
      ])
    ).toEqual([]);
  });

  it("쉼표 일괄 등록 시연 용어는 영어 용어 사전에도 없다", () => {
    const terms = helpDemoPack("en").terms.map((term) => term.toLowerCase());
    for (const term of ["cohort", "retention", "churn rate"]) expect(terms).not.toContain(term);
  });
});
