import { topicOfRows, type AgendaMap, type MapAgenda, type TopicRow } from "@/lib/projects/agenda-map";

type RibbonStop = { meeting: number; agendas: MapAgenda[] };

export type RibbonRoute = {
  id: string;
  topicId: string;
  kind: "main" | "track" | "folded";
  fork: MapAgenda | null;
  forkMeeting: number | null;
  stops: RibbonStop[];
};

export type RibbonTopic = {
  id: string;
  name: string;
  lane: number;
  from: number;
  to: number;
  main: RibbonRoute;
  routes: RibbonRoute[];
  agendaCount: number;
  sub: Map<string, number>;
  subCount: number;
};

export type RibbonLayout = {
  lanes: RibbonTopic[][];
  topics: RibbonTopic[];
  topicById: Map<string, RibbonTopic>;
  topicOfAgenda: Map<string, RibbonTopic>;
  routeOfAgenda: Map<string, RibbonRoute>;
  stopOfAgenda: Map<string, RibbonStop>;
  folded: Map<string, number>;
  foldedRoutes: Map<string, RibbonRoute[]>;
  joins: { from: string; to: string }[];
  loose: Map<number, MapAgenda[]>;
  extra: Map<number, MapAgenda[]>;
};

const NEAR_FORK = 4;

export function ribbonLayout(map: AgendaMap, rows: TopicRow[]): RibbonLayout {
  const indexOf = new Map(map.meetings.map((meeting) => [meeting.noteId, meeting.index]));
  const topOf = topicOfRows(rows);

  const routeOf = new Map<string, RibbonRoute>();
  const routeOfAgenda = new Map<string, RibbonRoute>();
  const stopOfAgenda = new Map<string, RibbonStop>();
  for (const row of rows) {
    const stops = [...row.cells.entries()]
      .map(
        ([noteId, agendas]): RibbonStop => ({
          meeting: indexOf.get(noteId)!,
          agendas,
        })
      )
      .sort((a, b) => a.meeting - b.meeting);
    const route: RibbonRoute = {
      id: row.id,
      topicId: topOf.get(row.id)!,
      kind: row.branchOf ? "folded" : "main",
      fork: row.branchOf,
      forkMeeting: row.branchOf ? indexOf.get(row.branchOf.noteId)! : null,
      stops,
    };
    routeOf.set(row.id, route);
    for (const stop of stops) {
      for (const agenda of stop.agendas) {
        routeOfAgenda.set(agenda.agendaId, route);
        stopOfAgenda.set(agenda.agendaId, stop);
      }
    }
  }

  const topics: RibbonTopic[] = [];
  const folded = new Map<string, number>();
  const foldedRoutes = new Map<string, RibbonRoute[]>();
  for (const row of rows) {
    if (row.branchOf) continue;
    const main = routeOf.get(row.id)!;
    const routes = rows
      .filter((candidate) => topOf.get(candidate.id) === row.id)
      .map((candidate) => routeOf.get(candidate.id)!);
    const branches = routes
      .filter((route) => route !== main)
      .sort((a, b) => a.stops[0].meeting - b.stops[0].meeting || a.forkMeeting! - b.forkMeeting!);
    const taken: { from: number; to: number; at: Set<number> }[] = [];
    for (const branch of branches) {
      const [start, end] = [branch.forkMeeting!, branch.stops.at(-1)!.meeting];
      const at = new Set(branch.stops.map((stop) => stop.meeting));
      const onMain = routeOfAgenda.get(branch.fork!.agendaId) === main;
      const near = branch.stops[0].meeting - start <= NEAR_FORK;
      if (onMain && near && taken.every((used) => (start >= used.to || end <= used.from) && ![...at].some((meeting) => used.at.has(meeting)))) {
        branch.kind = "track";
        taken.push({ from: start, to: end, at });
      }
    }
    for (const branch of branches) {
      if (branch.kind !== "folded") continue;
      let anchor: MapAgenda = branch.fork!;
      while (routeOfAgenda.get(anchor.agendaId)?.kind === "folded") {
        const up = routeOfAgenda.get(anchor.agendaId)!.fork;
        if (!up) break;
        anchor = up;
      }
      const count = branch.stops.reduce((sum, stop) => sum + stop.agendas.length, 0);
      folded.set(anchor.agendaId, (folded.get(anchor.agendaId) ?? 0) + count);
      foldedRoutes.set(anchor.agendaId, [...(foldedRoutes.get(anchor.agendaId) ?? []), branch]);
    }
    const sub = new Map<string, number>();
    const subTaken: { from: number; to: number; at: Set<number> }[][] = [];
    for (const branch of [...branches.filter((route) => route.kind === "track"), ...branches.filter((route) => route.kind === "folded")]) {
      const [start, end] = [branch.forkMeeting!, branch.stops.at(-1)!.meeting];
      const stopAt = new Set(branch.stops.map((stop) => stop.meeting));
      let at = subTaken.findIndex((used) =>
        used.every((other) => (start >= other.to || end <= other.from) && ![...stopAt].some((meeting) => other.at.has(meeting)))
      );
      if (at < 0) at = subTaken.push([]) - 1;
      subTaken[at].push({ from: start, to: end, at: stopAt });
      sub.set(branch.id, at);
    }
    const meetings = routes.flatMap((route) => route.stops.map((stop) => stop.meeting));
    const last = main.stops.at(-1)!.agendas.at(-1)!;
    topics.push({
      id: row.id,
      name: last.title,
      lane: 0,
      from: Math.min(...meetings),
      to: Math.max(...meetings),
      main,
      routes,
      sub,
      subCount: subTaken.length,
      agendaCount: routes.reduce((sum, route) => sum + route.stops.reduce((n, stop) => n + stop.agendas.length, 0), 0),
    });
  }
  topics.sort((a, b) => a.from - b.from || a.main.stops[0].agendas[0].order - b.main.stops[0].agendas[0].order);

  const packed: RibbonTopic[][] = [];
  for (const topic of topics) {
    let lane = packed.findIndex((used) =>
      used.every((other) => other.to + 1 < topic.from || other.from > topic.to + 1)
    );
    if (lane < 0) lane = packed.push([]) - 1;
    packed[lane].push(topic);
  }
  const lanes = packed
    .map((used, order) => ({
      used,
      order,
      last: Math.max(...used.map((topic) => topic.to)),
    }))
    .sort((a, b) => b.last - a.last || a.order - b.order)
    .map(({ used }) => used);
  lanes.forEach((used, lane) => used.forEach((topic) => (topic.lane = lane)));

  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const topicOfAgenda = new Map<string, RibbonTopic>();
  for (const route of routeOf.values()) {
    for (const stop of route.stops)
      for (const agenda of stop.agendas) topicOfAgenda.set(agenda.agendaId, topicById.get(route.topicId)!);
  }

  const joins = map.links.filter((link) => {
    const [from, to] = [routeOfAgenda.get(link.from), routeOfAgenda.get(link.to)];
    if (!from || !to || from === to) return false;
    return !(to.fork?.agendaId === link.from && to.stops[0].agendas[0].agendaId === link.to);
  });

  const loose = new Map<number, MapAgenda[]>();
  const extra = new Map<number, MapAgenda[]>();
  for (const meeting of map.meetings) {
    const rest = meeting.agendas.filter((agenda) => !routeOfAgenda.has(agenda.agendaId));
    if (rest.length > 0) loose.set(meeting.index, rest);
    const hidden = meeting.agendas.filter((agenda) => {
      const route = routeOfAgenda.get(agenda.agendaId);
      return !route || route.kind === "folded";
    });
    if (hidden.length > 0) extra.set(meeting.index, hidden);
  }

  return {
    lanes,
    topics,
    topicById,
    topicOfAgenda,
    routeOfAgenda,
    stopOfAgenda,
    folded,
    foldedRoutes,
    joins: joins.map((link) => ({ from: link.from, to: link.to })),
    loose,
    extra,
  };
}

type RibbonCell = {
  key: string;
  topic: RibbonTopic;
  route: RibbonRoute;
  stop: RibbonStop;
  prev: number | null;
  next: number | null;
};
type RibbonPass = { key: string; topic: RibbonTopic; route: RibbonRoute };
type RibbonFork = {
  key: string;
  topic: RibbonTopic;
  route: RibbonRoute;
  first: number;
  parent: RibbonRoute | null;
};
export type RibbonColumn = {
  cells: RibbonCell[];
  passes: RibbonPass[];
  forks: RibbonFork[];
  topicIds: ReadonlySet<string>;
};

export function ribbonColumns(map: AgendaMap, layout: RibbonLayout): RibbonColumn[] {
  const columns = map.meetings.map(() => ({
    cells: [] as RibbonCell[],
    passes: [] as RibbonPass[],
    forks: [] as RibbonFork[],
    topicIds: new Set<string>(),
  }));
  for (const topic of layout.topics) {
    for (const route of topic.routes) {
      const branch = route !== topic.main;
      const { stops } = route;
      const lead = branch && route.forkMeeting! < stops[0].meeting ? route.forkMeeting! : null;
      const gap = (from: number, to: number) => {
        for (let meeting = from + 1; meeting < to; meeting += 1) {
          columns[meeting].passes.push({ key: `${route.id}:~${meeting}`, topic, route });
          columns[meeting].topicIds.add(topic.id);
        }
      };
      stops.forEach((stop, at) => {
        columns[stop.meeting].cells.push({
          key: `${route.id}:${stop.meeting}`,
          topic,
          route,
          stop,
          prev: at > 0 ? stops[at - 1].meeting : lead,
          next: at < stops.length - 1 ? stops[at + 1].meeting : null,
        });
        columns[stop.meeting].topicIds.add(topic.id);
        if (at > 0) gap(stops[at - 1].meeting, stop.meeting);
      });
      if (lead !== null) gap(lead, stops[0].meeting);
      if (branch) {
        columns[route.forkMeeting!].forks.push({
          key: route.id,
          topic,
          route,
          first: stops[0].meeting,
          parent: layout.routeOfAgenda.get(route.fork!.agendaId) ?? null,
        });
        columns[route.forkMeeting!].topicIds.add(topic.id);
      }
    }
  }
  return columns;
}
