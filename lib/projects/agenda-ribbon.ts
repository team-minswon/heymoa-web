import { topicOfRows, type AgendaMap, type MapAgenda, type TopicRow } from "@/lib/projects/agenda-map";

/** 한 줄기가 한 회의에서 다룬 안건. 하나면 점, 여럿이면 숫자 캡슐이 된다 */
export type RibbonStop = { meeting: number; agendas: MapAgenda[] };

/**
 * 줄기(`main`) 하나, 또는 거기서 갈라진 갈래 하나.
 * 갈래는 줄 바로 아래 가는 길(`track`)에 선다. 같은 주제에서 길이 겹치는 갈래는 한 길에 못 들어가 접힌다(`folded`).
 */
export type RibbonRoute = {
  id: string;
  topicId: string;
  kind: "main" | "track" | "folded";
  /** 갈래가 갈라진 안건. 줄기면 null */
  fork: MapAgenda | null;
  forkMeeting: number | null;
  stops: RibbonStop[];
};

export type RibbonTopic = {
  id: string;
  /** 가장 최근 안건의 제목 */
  name: string;
  lane: number;
  /** 갈래까지 합친 회의 번호 구간 */
  from: number;
  to: number;
  main: RibbonRoute;
  routes: RibbonRoute[];
  agendaCount: number;
  /**
   * 갈래의 세로 자리(0 이 줄 바로 아래 길). 줄기를 골라 갈래를 모두 펼칠 때 쓴다. 길에 선 갈래가 먼저 0 번을 차지하고,
   * 접힌 갈래는 구간이 안 겹치는 첫 자리에 앉는다
   */
  sub: Map<string, number>;
  subCount: number;
};

export type RibbonLayout = {
  /** 줄(위에서부터) → 그 줄을 쓰는 주제들(시간순) */
  lanes: RibbonTopic[][];
  topics: RibbonTopic[];
  topicById: Map<string, RibbonTopic>;
  topicOfAgenda: Map<string, RibbonTopic>;
  routeOfAgenda: Map<string, RibbonRoute>;
  stopOfAgenda: Map<string, RibbonStop>;
  /** 길에 못 들어 접힌 갈래의 안건 수. 접힌 갈래가 갈라진, 보이는 안건에 단다 */
  folded: Map<string, number>;
  /** 그 안건에 달린 접힌 갈래들(시작 회의순). 호버로 숨은 안건을 미리 보여 줄 때 쓴다 */
  foldedRoutes: Map<string, RibbonRoute[]>;
  /** 줄기 안 이어짐도 갈래의 첫 이어짐도 아닌 연결(앞 안건이 둘인 합류 등). 기본 화면에서는 표식만 그린다 */
  joins: { from: string; to: string }[];
  /** 이어진 안건이 없는 안건. 회의 번호 → 안건 */
  loose: Map<number, MapAgenda[]>;
  /** 줄 위에 점으로 서지 않는 안건 = 이어짐 없는 안건 + 접힌 갈래의 안건. 열을 펼쳤을 때 아래 구역에 나열한다 */
  extra: Map<number, MapAgenda[]>;
};

/** 갈라진 안건에서 갈래의 첫 안건까지 이 회의 수 안이어야 줄 아래 길에 짧게 붙는다. 더 멀면 접어서 표식만 둔다 */
export const NEAR_FORK = 4;

/**
 * 주제마다 가로줄을 하나 주는 배치. 한 주제는 그 줄 위를 곧게 지나가고, 회의 구간이 안 겹치는(사이에 빈 회의 하나 이상)
 * 주제끼리는 줄을 나눠 쓴다. 갈래는 그 줄의 아래 길 하나에 그린다. 위쪽 줄일수록 최근까지 이어진 줄이다.
 */
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

  // 주제별로 모으고, 갈래를 길에 앉힌다
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
      // 갈라진 안건이 줄기에 있고, 첫 안건이 가깝고, 이미 앉은 갈래와 구간이 겹치지 않으면 길에 선다(끝과 시작이 맞닿는 건 괜찮다).
      // 구간이 맞닿더라도 같은 회의에 두 갈래의 점이 서면 한 자리에 겹쳐 그려지니 앉히지 않는다
      const onMain = routeOfAgenda.get(branch.fork!.agendaId) === main;
      const near = branch.stops[0].meeting - start <= NEAR_FORK;
      if (onMain && near && taken.every((used) => (start >= used.to || end <= used.from) && ![...at].some((meeting) => used.at.has(meeting)))) {
        branch.kind = "track";
        taken.push({ from: start, to: end, at });
      }
    }
    for (const branch of branches) {
      if (branch.kind !== "folded") continue;
      // 접힌 갈래는 보이는 가장 가까운 앞 안건에 안건 수를 단다
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
    // 줄기를 골랐을 때 갈래를 모두 펴는 세로 자리
    const sub = new Map<string, number>();
    const subTaken: { from: number; to: number; at: Set<number> }[][] = [];
    for (const branch of [...branches.filter((route) => route.kind === "track"), ...branches.filter((route) => route.kind === "folded")]) {
      const [start, end] = [branch.forkMeeting!, branch.stops.at(-1)!.meeting];
      const stopAt = new Set(branch.stops.map((stop) => stop.meeting));
      // 구간이 맞닿더라도 같은 회의에 두 갈래의 점이 서면 한 자리에 겹쳐 그려지니 다른 길에 둔다
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

  // 줄 채우기: 앞 주제가 끝난 뒤 빈 회의가 하나 이상 있어야 같은 줄을 쓴다(붙어 있으면 한 줄기로 읽힌다)
  const packed: RibbonTopic[][] = [];
  for (const topic of topics) {
    let lane = packed.findIndex((used) =>
      used.every((other) => other.to + 1 < topic.from || other.from > topic.to + 1)
    );
    if (lane < 0) lane = packed.push([]) - 1;
    packed[lane].push(topic);
  }
  // 최근까지 이어진 줄을 위로
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

  // 줄기 안 이어짐도, 갈래의 첫 안건과 갈라진 안건 사이도 아닌 연결
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

// ── 열 단위로 나눈 그림 ─────────────────────────────────────────────────────────

/** 한 열에 선 점. 같은 줄기에서 앞·뒤 점이 선 회의(`prev`·`next`)를 알아야 이 열 안의 선을 정한다 */
export type RibbonCell = {
  key: string;
  topic: RibbonTopic;
  route: RibbonRoute;
  stop: RibbonStop;
  /** 이 줄기(갈래)에서 앞 점이 선 회의. 갈래의 첫 점이면 갈라진 회의(같은 회의면 null) */
  prev: number | null;
  next: number | null;
};
/** 앞 점과 뒤 점 사이의 빈 회의 — 선이 이 열을 가로지르기만 한다 */
export type RibbonPass = { key: string; topic: RibbonTopic; route: RibbonRoute };
/** 갈래 곡선이 이 열의 점에서 갈라져 나간다 */
export type RibbonFork = {
  key: string;
  topic: RibbonTopic;
  route: RibbonRoute;
  /** 갈래의 첫 점이 선 회의 */
  first: number;
  /** 갈라진 안건이 선 줄기 */
  parent: RibbonRoute | null;
};
export type RibbonColumn = {
  cells: RibbonCell[];
  passes: RibbonPass[];
  forks: RibbonFork[];
  /** 이 열에 그릴 것이 있는 주제. 고른 주제가 여기 없으면 이 열은 다시 그리지 않는다 */
  topicIds: ReadonlySet<string>;
};

/**
 * 배치를 열마다 나눈다. 열 하나가 자기 안의 점과 선만 그리게 해서, 열이 펼쳐지고 접힐 때 그 열만 다시 그리고 이웃은 밀리기만 한다.
 * 접힌 갈래(`folded`)도 담아 두고, 그리는 쪽이 줄기를 고른 때만 꺼낸다.
 */
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
