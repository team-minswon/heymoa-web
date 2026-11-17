import { describe, expect, it } from "vitest";

import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { buildAgendaMap, topicRows } from "@/lib/projects/agenda-map";
import { ribbonLayout } from "@/lib/projects/agenda-ribbon";

const agenda = (agendaId: string, title: string) => ({
  agendaId,
  title,
  completed: false,
  proposalIds: [],
});
const link = (from: [string, string], to: [string, string]) => ({
  source: { noteId: to[0], agendaId: to[1] },
  target: { noteId: from[0], agendaId: from[1] },
});

const fixture = (): ProjectMeetingLinksResponseData => ({
  notes: [
    {
      noteId: "N3",
      title: "셋째",
      startedAt: "2026-08-19T01:00:00Z",
      agendas: [agenda("C1", "C1")],
    },
    {
      noteId: "N2",
      title: "둘째",
      startedAt: "2026-08-12T01:00:00Z",
      agendas: [
        agenda("B1", "B1"),
        agenda("B2", "B2"),
        agenda("B3", "B3"),
        agenda("B4", "B4"),
      ],
    },
    {
      noteId: "N1",
      title: "첫째",
      startedAt: "2026-08-05T01:00:00Z",
      agendas: [agenda("A1", "A1")],
    },
  ],
  agendaLinks: [
    link(["N1", "A1"], ["N2", "B1"]),
    link(["N2", "B1"], ["N3", "C1"]),
    link(["N1", "A1"], ["N2", "B2"]),
    link(["N2", "B1"], ["N2", "B3"]),
    link(["N2", "B1"], ["N2", "B4"]),
  ],
  meetingLinks: [],
  conflicts: [],
});

describe("ribbonLayout", () => {
  it("does not seat two branches whose dots would land on the same meeting column", () => {
    const map = buildAgendaMap(fixture());
    const layout = ribbonLayout(map, topicRows(map).rows);
    const tracks = layout.topics.flatMap((topic) =>
      topic.routes.filter((route) => route.kind === "track")
    );
    const seen = new Set<number>();
    for (const route of tracks) {
      for (const stop of route.stops) {
        expect(seen.has(stop.meeting)).toBe(false);
        seen.add(stop.meeting);
      }
    }
  });

  it("puts branches that share a meeting on different rows when the topic is picked and every branch is unfolded", () => {
    const map = buildAgendaMap(fixture());
    const layout = ribbonLayout(map, topicRows(map).rows);
    const [topic] = layout.topics;
    const rowsAt = new Map<number, number[]>();
    for (const route of topic.routes.filter((entry) => entry !== topic.main)) {
      for (const stop of route.stops)
        rowsAt.set(stop.meeting, [
          ...(rowsAt.get(stop.meeting) ?? []),
          topic.sub.get(route.id)!,
        ]);
    }
    for (const rows of rowsAt.values())
      expect(new Set(rows).size).toBe(rows.length);
  });
});
