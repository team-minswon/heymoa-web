import { describe, expect, it } from "vitest";

import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import {
  buildAgendaMap,
  daysAfterPrevious,
  laneLayout,
  meetingHeading,
  shortMeetingDate,
  topicRows,
} from "@/lib/projects/agenda-map";

const agenda = (agendaId: string, title: string, completed = false) => ({ agendaId, title, completed, proposalIds: [] });
const link = (from: [string, string], to: [string, string]) => ({
  // 계약은 source 가 뒤 안건, target 이 앞 안건이다
  source: { noteId: to[0], agendaId: to[1] },
  target: { noteId: from[0], agendaId: from[1] },
});

// 응답은 최근 순이다
const data: ProjectMeetingLinksResponseData = {
  notes: [
    { noteId: "N3", title: "베타 회고", startedAt: "2026-08-19T01:00:00Z", agendas: [agenda("C1", "베타 회고"), agenda("C2", "로드맵")] },
    { noteId: "N2", title: "결제 재검토", startedAt: "2026-08-12T01:00:00Z", agendas: [agenda("B1", "결제 재논의", true), agenda("B2", "PG 선정"), agenda("B3", "환불")] },
    { noteId: "N1", title: "킥오프", startedAt: "2026-08-05T01:00:00Z", agendas: [agenda("A1", "결제 수단", true), agenda("A2", "팀 역할", true)] },
  ],
  agendaLinks: [
    link(["N1", "A1"], ["N2", "B1"]),
    link(["N2", "B1"], ["N2", "B2"]),
    link(["N2", "B2"], ["N3", "C1"]),
    // 창 밖(응답에 없는 노트)을 가리키는 연결은 버린다
    link(["N0", "Z9"], ["N3", "C2"]),
    // 같은 연결이 두 번 와도 하나다
    link(["N1", "A1"], ["N2", "B1"]),
  ],
  meetingLinks: [],
  conflicts: [],
};

describe("buildAgendaMap", () => {
  it("orders meetings by start time and keeps each meeting's agenda order", () => {
    const map = buildAgendaMap(data);
    expect(map.meetings.map((meeting) => meeting.noteId)).toEqual(["N1", "N2", "N3"]);
    expect(map.meetings[1].agendas.map((item) => [item.agendaId, item.order])).toEqual([
      ["B1", 0],
      ["B2", 1],
      ["B3", 2],
    ]);
  });

  it("turns links into earlier → later, drops ones outside the window and duplicates", () => {
    const map = buildAgendaMap(data);
    expect(map.links).toEqual([
      { from: "A1", to: "B1", sameMeeting: false },
      { from: "B1", to: "B2", sameMeeting: true },
      { from: "B2", to: "C1", sameMeeting: false },
    ]);
  });

  it("groups linked agendas into one flow in time order", () => {
    const map = buildAgendaMap(data);
    expect(map.flows).toHaveLength(1);
    expect(map.flows[0].agendas.map((item) => item.agendaId)).toEqual(["A1", "B1", "B2", "C1"]);
  });

  it("merges two predecessors into the same flow", () => {
    const map = buildAgendaMap({ ...data, agendaLinks: [...data.agendaLinks, link(["N1", "A2"], ["N3", "C1"])] });
    expect(map.flows[0].agendas.map((item) => item.agendaId)).toEqual(["A1", "A2", "B1", "B2", "C1"]);
  });

});

describe("meetingHeading", () => {
  it("drops a leading date the header already shows", () => {
    expect(meetingHeading("10/13 결제팀 - 정기 점검")).toBe("결제팀 - 정기 점검");
    expect(meetingHeading("2026.10.13 - 주간 회의")).toBe("주간 회의");
    expect(meetingHeading("10월 21일 팀 회의")).toBe("팀 회의");
    expect(meetingHeading("10/21 (화) 팀 회의")).toBe("팀 회의");
    expect(meetingHeading("베타 회고")).toBe("베타 회고");
    expect(meetingHeading("10/13")).toBe("10/13");
  });
});

describe("topicRows", () => {
  const ids = (agendas: { agendaId: string }[] | undefined) => (agendas ?? []).map((agenda) => agenda.agendaId);

  it("lays a chain out as one row, stacking same-meeting continuations in one cell", () => {
    const { rows, loose } = topicRows(buildAgendaMap(data));
    expect(rows).toHaveLength(1);
    expect(ids(rows[0].cells.get("N1"))).toEqual(["A1"]);
    expect(ids(rows[0].cells.get("N2"))).toEqual(["B1", "B2"]);
    expect(ids(rows[0].cells.get("N3"))).toEqual(["C1"]);
    expect(rows[0].branchOf).toBeNull();
    // 이어짐 없는 안건은 회의별로 따로 모은다
    expect(ids(loose.get("N1"))).toEqual(["A2"]);
    expect(ids(loose.get("N2"))).toEqual(["B3"]);
    expect(ids(loose.get("N3"))).toEqual(["C2"]);
  });

  it("splits a branch into its own row under the row it left, keeping the longest branch on the row", () => {
    // A1 을 B1(→B2→C1 로 길게)과 B3(여기서 끝) 이 이어받는다
    const map = buildAgendaMap({ ...data, agendaLinks: [...data.agendaLinks, link(["N1", "A1"], ["N2", "B3"])] });
    const { rows } = topicRows(map);
    expect(rows).toHaveLength(2);
    expect(ids(rows[0].cells.get("N2"))).toEqual(["B1", "B2"]);
    expect(ids(rows[1].cells.get("N2"))).toEqual(["B3"]);
    expect(rows[1].branchOf?.agendaId).toBe("A1");
  });

  it("takes the latest predecessor as parent when an agenda continues two", () => {
    const map = buildAgendaMap({ ...data, agendaLinks: [...data.agendaLinks, link(["N1", "A2"], ["N3", "C1"])] });
    const { rows } = topicRows(map);
    // C1 의 앞 안건은 B2(08.12)와 A2(08.05) — 최근인 B2 줄기에 남고 A2 는 홀로 한 줄
    expect(ids(rows.find((row) => row.cells.has("N3"))!.cells.get("N2"))).toEqual(["B1", "B2"]);
    expect(rows.some((row) => ids(row.cells.get("N1")).includes("A2") && !row.cells.has("N3"))).toBe(true);
  });
});

describe("shortMeetingDate", () => {
  it("prints month.day in the app time zone", () => {
    expect(shortMeetingDate("2026-08-05T16:00:00Z")).toBe("08.06");
  });
});

describe("laneLayout", () => {
  // N1 A1 → N2 B1 → B2(같은 회의) → N3 C1, 그리고 B1 에서 B3 로 갈라진다. 따로 N2 B4 → N3 C2 가 이어진다
  const forked = buildAgendaMap({
    ...data,
    notes: data.notes.map((note) =>
      note.noteId === "N2" ? { ...note, agendas: [...note.agendas, agenda("B4", "일정")] } : note
    ),
    agendaLinks: [...data.agendaLinks.slice(0, 3), link(["N2", "B1"], ["N2", "B3"]), link(["N2", "B4"], ["N3", "C2"])],
  });
  const rows = topicRows(forked).rows;
  const mainOf = (agendaId: string) => rows.find((row) => [...row.cells.values()].flat().some((item) => item.agendaId === agendaId))!.id;

  it("gives each topic one lane and puts same-meeting continuations side by side", () => {
    const layout = laneLayout(forked, rows, new Set());
    expect(layout.laneCount).toBe(2);
    expect(layout.seats.get("A1")).toEqual({ meeting: 0, lane: 0, slot: 0, slots: 1 });
    expect(layout.seats.get("B1")).toEqual({ meeting: 1, lane: 0, slot: 0, slots: 2 });
    expect(layout.seats.get("B2")).toEqual({ meeting: 1, lane: 0, slot: 1, slots: 2 });
    expect(layout.seats.get("C1")?.lane).toBe(0);
    expect(layout.seats.get("B4")?.lane).toBe(1);
  });

  it("folds branches by default and counts them on the agenda they left", () => {
    const layout = laneLayout(forked, rows, new Set());
    expect(layout.seats.has("B3")).toBe(false);
    expect(layout.folded.get("B1")).toBe(1);
  });

  it("opens an expanded topic's branches right under it and pushes the lanes below down", () => {
    const layout = laneLayout(forked, rows, new Set([mainOf("A1")]));
    expect(layout.seats.get("B3")?.lane).toBe(1);
    expect(layout.seats.get("B4")?.lane).toBe(2);
    expect(layout.folded.size).toBe(0);
    expect(layout.laneCount).toBe(3);
  });

  it("shares a lane between topics that do not overlap in time", () => {
    const apart = buildAgendaMap({ ...data, agendaLinks: [link(["N1", "A1"], ["N2", "B1"]), link(["N3", "C1"], ["N3", "C2"])] });
    expect(laneLayout(apart, topicRows(apart).rows, new Set()).laneCount).toBe(1);
  });

  it("keeps agendas without continuations apart, per meeting", () => {
    const layout = laneLayout(forked, rows, new Set());
    expect(layout.loose.get(0)?.map((item) => item.agendaId)).toEqual(["A2"]);
  });
});

describe("daysAfterPrevious", () => {
  it("counts calendar days in the app time zone from the meeting before", () => {
    const map = buildAgendaMap(data);
    expect(daysAfterPrevious(map, 0)).toBeNull();
    expect(daysAfterPrevious(map, 1)).toBe(7);
  });
});
