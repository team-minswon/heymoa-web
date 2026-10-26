import type { ProjectMeetingLinksResponseData } from "@/lib/api/generated/models";
import { formatAppDate, getAppDateKey } from "@/lib/format/date";

/** 회의 하나의 안건. `order` 는 그 회의 안에서 다룬 순서다 */
export type MapAgenda = {
  agendaId: string;
  noteId: string;
  title: string;
  completed: boolean;
  order: number;
};

/** 시간 순서(`index`)로 선 회의. 응답은 최근 순이라 여기서 뒤집는다 */
export type MapMeeting = {
  noteId: string;
  title: string;
  startedAt: string;
  index: number;
  agendas: MapAgenda[];
};

/** 앞 안건 → 뒤 안건. 계약의 `agendaLinks` 는 source 가 뒤 안건이라 방향을 바로 세운다 */
export type MapLink = { from: string; to: string; sameMeeting: boolean };

/** `agendaLinks` 로 이어진 안건 묶음. 안건은 시간 순서, 이름은 가장 최근 안건의 제목이다 */
export type AgendaFlow = { id: string; agendas: MapAgenda[] };

export type AgendaMap = {
  meetings: MapMeeting[];
  links: MapLink[];
  flows: AgendaFlow[];
  agendaById: Map<string, MapAgenda>;
  flowOf: Map<string, AgendaFlow>;
};

/**
 * 프로젝트 회의 간 연결 응답을 화면 모델로 바꾼다.
 * 양 끝 안건이 응답의 노트 안에 없는 연결은 버린다 — 서버가 최근 N개 노트로 자른 창 밖이다.
 */
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

  // 연결 요소로 묶는다. 안건은 대개 앞 안건 하나만 가리켜 나무가 되지만, 노트 삭제 뒤 재연결이면 둘을 가리킬 수 있다
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


/**
 * 머리에 적을 회의 제목. 날짜는 바로 위에 따로 적으니 제목 앞의 날짜(「10/13 」 「2026.10.13 - 」 「10월 13일 」)를 뗀다.
 * 떼고 남는 것이 없으면 원래 제목을 쓴다.
 */
export function meetingHeading(title: string) {
  const rest = title
    .replace(/^\s*(\d{4}\s*[-./년]\s*)?\d{1,2}\s*[-./월]\s*\d{1,2}\s*[.일]?\s*(\([^)]*\))?\s*[-–—·:|]?\s*/, "")
    .trim();
  return rest || title;
}

/** 회의가 열린 해(앱 시간대) */
export const meetingYear = (startedAt: string) => getAppDateKey(startedAt).slice(0, 4);

/** 표 머리에 적는 짧은 회의 날짜 — 「10.13」 */
export const shortMeetingDate = (startedAt: string) =>
  formatAppDate(startedAt, { month: "2-digit", day: "2-digit" }).replace(/\s/g, "").replace(/\.$/, "");

// ── 주제 타임라인 ────────────────────────────────────────────────────────────

/** 표의 한 행: 이어진 안건 한 줄기. 칸은 회의별 안건(같은 회의 안 이어짐은 한 칸에 쌓인다) */
export type TopicRow = {
  id: string;
  /** noteId → 그 회의에서 이 줄기에 든 안건(다룬 순서) */
  cells: Map<string, MapAgenda[]>;
  /** 다른 줄기에서 갈라져 나왔으면 그 갈래가 시작된 앞 안건 */
  branchOf: MapAgenda | null;
};

export type TopicTimeline = {
  rows: TopicRow[];
  /** 이어짐이 없는 안건. noteId → 안건(다룬 순서) */
  loose: Map<string, MapAgenda[]>;
};

/**
 * 이어진 안건을 행으로 편다. 이어짐은 대개 「뒤 안건 → 바로 앞 안건 하나」라 나무 모양이고, 한 안건을 뒤 안건 여럿이
 * 이어받으면 거기서 갈라진다. 갈라지면 가장 길게 이어지는 갈래가 같은 행을 잇고, 나머지 갈래는 바로 아래 새 행이 되어
 * 어디서 갈라졌는지(`branchOf`)를 단다 — 서로 다른 주제가 한 줄기로 뭉치지 않는다.
 * 앞 안건이 둘 이상이면(노트 삭제 뒤 재연결) 가장 최근의 앞 안건 하나만 부모로 삼는다.
 */
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

// ── 레인 배치 ────────────────────────────────────────────────────────────────

/** 보이는 안건 하나의 자리. 열은 회의 번호, 줄은 위에서부터의 레인 번호, 같은 회의·같은 줄에 안건이 여럿이면 몇 번째인가 */
export type LaneSeat = { meeting: number; lane: number; slot: number; slots: number };

export type LaneLayout = {
  seats: Map<string, LaneSeat>;
  laneCount: number;
  /** 이어진 안건이 없는 안건. 회의 번호 → 안건(다룬 순서) */
  loose: Map<number, MapAgenda[]>;
  /** 갈래를 접어 둔 안건 → 접힌 안건 수 */
  folded: Map<string, number>;
};

/** 줄(행) → 그 줄이 속한 주제의 맨 위 줄기. 갈래의 갈래도 맨 위 줄기로 올라간다 */
export function topicOfRows(rows: TopicRow[]): Map<string, string> {
  const rowOfAgenda = new Map(rows.flatMap((row) => [...row.cells.values()].flat().map((agenda) => [agenda.agendaId, row] as const)));
  const top = (row: TopicRow): TopicRow => {
    const up = row.branchOf ? rowOfAgenda.get(row.branchOf.agendaId) : undefined;
    return up && up !== row ? top(up) : row;
  };
  return new Map(rows.map((row) => [row.id, top(row).id]));
}

/**
 * 주제마다 가로줄(레인) 하나를 주는 배치. git 커밋 그래프나 노선도처럼 한 주제는 한 줄 위를 곧게 지나가서, 서로 다른
 * 주제의 선이 엇갈리지 않는다.
 *
 * - 줄기(`branchOf` 없는 행)는 회의 구간이 겹치지 않으면 같은 줄을 나눠 쓴다. 필요한 줄 수는 동시에 진행 중인 주제 수다
 * - 갈래는 평소 접어 두고 갈라진 안건에 접힌 안건 수(`folded`)만 단다. `expanded` 에 든 주제는 갈래를 그 줄기 바로 아래
 *   줄에 펴고, 그 아래 줄은 그만큼 내려간다 — 갈래 선이 다른 주제를 건너지 않는다
 * - 같은 회의 안 이어짐은 같은 줄·같은 칸 안에서 옆 자리(`slot`)로 선다
 */
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
  // 펼친 주제의 갈래는 그 줄기가 선 줄 바로 아래에 저희끼리 겹치지 않게 쌓는다
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

  // 접힌 갈래의 안건 수는 보이는 가장 가까운 앞 안건에 단다(갈래의 갈래면 줄기까지 올라간다)
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

/** 앞 회의에서 며칠 뒤인가. 첫 회의는 null */
export function daysAfterPrevious(map: AgendaMap, index: number): number | null {
  if (index === 0) return null;
  // 앱 시간대(서울)의 날짜끼리 센다. 자정 넘긴 회의가 하루를 더 먹지 않게
  const day = (startedAt: string) => Date.parse(`${getAppDateKey(startedAt)}T00:00:00Z`) / 86_400_000;
  return day(map.meetings[index].startedAt) - day(map.meetings[index - 1].startedAt);
}
