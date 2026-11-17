import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { formatAppDate, getAppDateKey } from "@/lib/format/date";

export type MapAgenda = {
  agendaId: string;
  noteId: string;
  title: string;
  completed: boolean;
  order: number;
};

export type MapMeeting = {
  noteId: string;
  title: string;
  startedAt: string;
  index: number;
  agendas: MapAgenda[];
};

type MapLink = { from: string; to: string; sameMeeting: boolean };

type AgendaFlow = { id: string; agendas: MapAgenda[] };

export type AgendaMap = {
  meetings: MapMeeting[];
  links: MapLink[];
  flows: AgendaFlow[];
  agendaById: Map<string, MapAgenda>;
  flowOf: Map<string, AgendaFlow>;
};

export function buildAgendaMap(data: ProjectMeetingLinksResponseData): AgendaMap {
  const meetings = [...data.notes]
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .map((note, index): MapMeeting => ({
      noteId: note.noteId,
      title: note.title,
      startedAt: note.startedAt,
      index,
      agendas: note.agendas.map((agenda, order) => ({
        agendaId: agenda.agendaId,
        noteId: note.noteId,
        title: agenda.title,
        completed: agenda.completed,
        order,
      })),
    }));
  const agendaById = new Map(meetings.flatMap((meeting) => meeting.agendas.map((agenda) => [agenda.agendaId, agenda] as const)));

  const seen = new Set<string>();
  const links = data.agendaLinks.flatMap((link): MapLink[] => {
    const later = link.source && agendaById.get(link.source.agendaId);
    const earlier = link.target && agendaById.get(link.target.agendaId);
    if (!later || !earlier || later === earlier) return [];
    const key = `${earlier.agendaId}>${later.agendaId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ from: earlier.agendaId, to: later.agendaId, sameMeeting: earlier.noteId === later.noteId }];
  });

  const parent = new Map<string, string>();
  const root = (id: string): string => {
    const up = parent.get(id) ?? id;
    if (up === id) return id;
    const top = root(up);
    parent.set(id, top);
    return top;
  };
  for (const link of links) parent.set(root(link.to), root(link.from));

  const meetingIndex = new Map(meetings.map((meeting) => [meeting.noteId, meeting.index]));
  const byTime = (a: MapAgenda, b: MapAgenda) =>
    meetingIndex.get(a.noteId)! - meetingIndex.get(b.noteId)! || a.order - b.order;
  const groups = new Map<string, MapAgenda[]>();
  for (const id of new Set(links.flatMap((link) => [link.from, link.to]))) {
    const key = root(id);
    groups.set(key, [...(groups.get(key) ?? []), agendaById.get(id)!]);
  }
  const flows = [...groups.values()]
    .map((agendas) => {
      const sorted = agendas.sort(byTime);
      return { id: `flow:${sorted[0].agendaId}`, agendas: sorted };
    })
    .sort((a, b) => byTime(b.agendas.at(-1)!, a.agendas.at(-1)!));
  const flowOf = new Map(flows.flatMap((flow) => flow.agendas.map((agenda) => [agenda.agendaId, flow] as const)));

  return { meetings, links, flows, agendaById, flowOf };
}


export function meetingHeading(title: string) {
  const rest = title
    .replace(/^\s*(\d{4}\s*[-./년]\s*)?\d{1,2}\s*[-./월]\s*\d{1,2}\s*[.일]?\s*(\([^)]*\))?\s*[-–—·:|]?\s*/, "")
    .trim();
  return rest || title;
}

export const meetingYear = (startedAt: string) => getAppDateKey(startedAt).slice(0, 4);

export const shortMeetingDate = (startedAt: string) =>
  formatAppDate(startedAt, { month: "2-digit", day: "2-digit" }).replace(/\s/g, "").replace(/\.$/, "");

export type TopicRow = {
  id: string;
  cells: Map<string, MapAgenda[]>;
  branchOf: MapAgenda | null;
};

type TopicTimeline = {
  rows: TopicRow[];
  loose: Map<string, MapAgenda[]>;
};

export function topicRows(map: AgendaMap): TopicTimeline {
  const meetingIndex = new Map(map.meetings.map((meeting) => [meeting.noteId, meeting.index]));
  const time = (agenda: MapAgenda) => meetingIndex.get(agenda.noteId)! * 10_000 + agenda.order;
  const parent = new Map<string, MapAgenda>();
  for (const link of map.links) {
    const from = map.agendaById.get(link.from)!;
    const current = parent.get(link.to);
    if (!current || time(from) > time(current)) parent.set(link.to, from);
  }
  const children = new Map<string, MapAgenda[]>();
  for (const [childId, from] of parent) {
    children.set(from.agendaId, [...(children.get(from.agendaId) ?? []), map.agendaById.get(childId)!]);
  }
  const depth = (agenda: MapAgenda): number =>
    1 + Math.max(0, ...(children.get(agenda.agendaId) ?? []).map(depth));

  const rows: TopicRow[] = [];
  const place = (row: TopicRow, agenda: MapAgenda) => {
    row.cells.set(agenda.noteId, [...(row.cells.get(agenda.noteId) ?? []), agenda]);
    const kids = [...(children.get(agenda.agendaId) ?? [])].sort((a, b) => depth(b) - depth(a) || time(a) - time(b));
    const [main, ...branches] = kids;
    if (main) place(row, main);
    for (const branch of branches.sort((a, b) => time(a) - time(b))) {
      const next: TopicRow = { id: `row:${branch.agendaId}`, cells: new Map(), branchOf: agenda };
      rows.push(next);
      place(next, branch);
    }
  };
  const linked = new Set(map.links.flatMap((link) => [link.from, link.to]));
  const roots = [...linked]
    .map((id) => map.agendaById.get(id)!)
    .filter((agenda) => !parent.has(agenda.agendaId))
    .sort((a, b) => time(a) - time(b));
  for (const root of roots) {
    const row: TopicRow = { id: `row:${root.agendaId}`, cells: new Map(), branchOf: null };
    rows.push(row);
    place(row, root);
  }

  const loose = new Map<string, MapAgenda[]>();
  for (const meeting of map.meetings) {
    const rest = meeting.agendas.filter((agenda) => !linked.has(agenda.agendaId));
    if (rest.length > 0) loose.set(meeting.noteId, rest);
  }
  return { rows, loose };
}

type LaneSeat = { meeting: number; lane: number; slot: number; slots: number };

type LaneLayout = {
  seats: Map<string, LaneSeat>;
  laneCount: number;
  loose: Map<number, MapAgenda[]>;
  folded: Map<string, number>;
};

export function topicOfRows(rows: TopicRow[]): Map<string, string> {
  const rowOfAgenda = new Map(rows.flatMap((row) => [...row.cells.values()].flat().map((agenda) => [agenda.agendaId, row] as const)));
  const top = (row: TopicRow): TopicRow => {
    const up = row.branchOf ? rowOfAgenda.get(row.branchOf.agendaId) : undefined;
    return up && up !== row ? top(up) : row;
  };
  return new Map(rows.map((row) => [row.id, top(row).id]));
}

export function laneLayout(map: AgendaMap, rows: TopicRow[], expanded: ReadonlySet<string>): LaneLayout {
  const indexOf = new Map(map.meetings.map((meeting) => [meeting.noteId, meeting.index]));
  const topicOf = topicOfRows(rows);
  const span = (row: TopicRow): [number, number] => {
    const columns = [...row.cells.keys()].map((noteId) => indexOf.get(noteId)!);
    if (row.branchOf) columns.push(indexOf.get(row.branchOf.noteId)!);
    return [Math.min(...columns), Math.max(...columns)];
  };
  const first = (row: TopicRow) => [...row.cells.values()].flat()[0];
  const byStart = (a: TopicRow, b: TopicRow) => span(a)[0] - span(b)[0] || first(a).order - first(b).order;
  const pack = (group: TopicRow[]) => {
    const lanes: [number, number][][] = [];
    const laneOf = new Map<string, number>();
    for (const row of [...group].sort(byStart)) {
      const [from, to] = span(row);
      let lane = lanes.findIndex((taken) => taken.every(([a, b]) => to < a || from > b));
      if (lane < 0) lane = lanes.push([]) - 1;
      lanes[lane].push([from, to]);
      laneOf.set(row.id, lane);
    }
    return { count: lanes.length, laneOf };
  };

  const mains = rows.filter((row) => !row.branchOf);
  const base = pack(mains);
  const branchesUnder = new Map<number, TopicRow[]>();
  for (const row of rows) {
    if (!row.branchOf || !expanded.has(topicOf.get(row.id)!)) continue;
    const lane = base.laneOf.get(topicOf.get(row.id)!)!;
    branchesUnder.set(lane, [...(branchesUnder.get(lane) ?? []), row]);
  }
  const laneOfRow = new Map<string, number>();
  let next = 0;
  for (let lane = 0; lane < base.count; lane += 1) {
    const at = next;
    for (const row of mains) if (base.laneOf.get(row.id) === lane) laneOfRow.set(row.id, at);
    const sub = pack(branchesUnder.get(lane) ?? []);
    for (const [rowId, offset] of sub.laneOf) laneOfRow.set(rowId, at + 1 + offset);
    next = at + 1 + sub.count;
  }

  const seats = new Map<string, LaneSeat>();
  for (const row of rows) {
    const lane = laneOfRow.get(row.id);
    if (lane === undefined) continue;
    for (const [noteId, agendas] of row.cells) {
      agendas.forEach((agenda, slot) =>
        seats.set(agenda.agendaId, { meeting: indexOf.get(noteId)!, lane, slot, slots: agendas.length })
      );
    }
  }

  const rowOfAgenda = new Map(rows.flatMap((row) => [...row.cells.values()].flat().map((agenda) => [agenda.agendaId, row] as const)));
  const folded = new Map<string, number>();
  for (const row of rows) {
    if (laneOfRow.has(row.id) || !row.branchOf) continue;
    let anchor: MapAgenda = row.branchOf;
    while (!seats.has(anchor.agendaId)) {
      const up = rowOfAgenda.get(anchor.agendaId)?.branchOf;
      if (!up) break;
      anchor = up;
    }
    const count = [...row.cells.values()].flat().length;
    folded.set(anchor.agendaId, (folded.get(anchor.agendaId) ?? 0) + count);
  }

  const loose = new Map<number, MapAgenda[]>();
  for (const meeting of map.meetings) {
    const rest = meeting.agendas.filter((agenda) => !rowOfAgenda.has(agenda.agendaId));
    if (rest.length > 0) loose.set(meeting.index, rest);
  }
  return { seats, laneCount: next, loose, folded };
}
