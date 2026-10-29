import {
  topicOfRows,
  type AgendaMap,
  type MapAgenda,
  type TopicRow,
} from "@/lib/projects/agenda-map";

/** 포커스 화면의 순수 로직. 주제(줄기) 색인, 같은 회의에서 만난 줄기, 포커스 타임라인 배치 */

/** 이어진 안건 한 줄기. 갈래까지 포함한다 */
export type Topic = {
  id: string;
  /** 줄기 행이 먼저, 갈래 행이 그 뒤(부모 행이 자식 행보다 앞) */
  rows: TopicRow[];
  /** 시간 순서 */
  agendas: MapAgenda[];
  noteIds: ReadonlySet<string>;
  /** 이름은 줄기에서 가장 최근 안건의 제목이다 */
  title: string;
  branches: number;
};

export type TopicIndex = {
  topics: Map<string, Topic>;
  topicOfAgenda: Map<string, string>;
  topicsByNote: Map<string, string[]>;
};

export function buildTopicIndex(map: AgendaMap, rows: TopicRow[]): TopicIndex {
  const meetingIndex = new Map(
    map.meetings.map((meeting) => [meeting.noteId, meeting.index])
  );
  const time = (agenda: MapAgenda) =>
    meetingIndex.get(agenda.noteId)! * 10_000 + agenda.order;
  const topOf = topicOfRows(rows);
  const topics = new Map<string, Topic>();
  const topicOfAgenda = new Map<string, string>();
  for (const row of rows) {
    const id = topOf.get(row.id)!;
    const topic = topics.get(id) ?? {
      id,
      rows: [],
      agendas: [],
      noteIds: new Set<string>(),
      title: "",
      branches: 0,
    };
    topic.rows.push(row);
    for (const agenda of [...row.cells.values()].flat()) {
      topic.agendas.push(agenda);
      (topic.noteIds as Set<string>).add(agenda.noteId);
      topicOfAgenda.set(agenda.agendaId, id);
    }
    if (row.branchOf) topic.branches += 1;
    topics.set(id, topic);
  }
  const topicsByNote = new Map<string, string[]>();
  for (const topic of topics.values()) {
    topic.agendas.sort((a, b) => time(a) - time(b));
    const main = topic.rows.find((row) => !row.branchOf)!;
    const latest = [...main.cells.values()]
      .flat()
      .sort((a, b) => time(a) - time(b))
      .at(-1)!;
    topic.title = latest.title;
    for (const noteId of topic.noteIds)
      topicsByNote.set(noteId, [...(topicsByNote.get(noteId) ?? []), topic.id]);
  }
  return { topics, topicOfAgenda, topicsByNote };
}

/** 같은 회의에서 만난 다른 줄기. 함께한 회의가 많은 순, 같으면 최근 순 */
export function neighborsOf(
  index: TopicIndex,
  map: AgendaMap,
  topicId: string
) {
  const self = index.topics.get(topicId);
  if (!self) return [];
  const meetingIndex = new Map(
    map.meetings.map((meeting) => [meeting.noteId, meeting.index])
  );
  const shared = new Map<string, string[]>();
  for (const noteId of self.noteIds) {
    for (const other of index.topicsByNote.get(noteId) ?? []) {
      if (other !== topicId)
        shared.set(other, [...(shared.get(other) ?? []), noteId]);
    }
  }
  const latest = (topic: Topic) =>
    Math.max(...[...topic.noteIds].map((noteId) => meetingIndex.get(noteId)!));
  return [...shared]
    .map(([id, noteIds]) => ({
      topic: index.topics.get(id)!,
      noteIds: noteIds.sort(
        (a, b) => meetingIndex.get(a)! - meetingIndex.get(b)!
      ),
    }))
    .sort(
      (a, b) =>
        b.noteIds.length - a.noteIds.length || latest(b.topic) - latest(a.topic)
    );
}

// ── 포커스 타임라인 배치 ─────────────────────────────────────────────────────

export const CARD_W = 224;
export const CARD_GAP = 16;
export const SLOT_W = CARD_W + CARD_GAP;
export const FOCUS_PAD = 16;
/** 카드 왼쪽 끝에서 점 가운데까지 */
export const DOT_INSET = 18;

export type FocusCard = { agenda: MapAgenda; row: number; left: number };
export type FocusLink = { from: string; to: string; fork: boolean };

/** 갈래 한 줄: 어느 안건에서 갈라져 어느 줄에 서는가 */
export type FocusBranch = { rowId: string; row: number; fork: MapAgenda; first: MapAgenda };

export type FocusLayout = {
  width: number;
  rowCount: number;
  cards: FocusCard[];
  links: FocusLink[];
  rowOf: Map<string, number>;
  leftOf: Map<string, number>;
  branches: FocusBranch[];
};

/**
 * 줄기 하나를 가로 타임라인으로 편다. 칸은 줄기가 지나간 회의(시간순)이고, 줄기는 맨 위 줄, 갈래는 그 아래 줄이다.
 * 같은 회의에서 이어진 안건은 한 칸 안에서 옆 자리(slot)로 서고, 같은 회의 안에서 갈라진 갈래는 부모 옆 자리부터 선다 —
 * 갈래 선이 부모 카드 오른쪽 틈새로 내려와서 카드를 가로지르지 않는다. 겹치지 않는 갈래는 같은 줄을 나눠 쓴다.
 */
export function focusLayout(map: AgendaMap, topic: Topic): FocusLayout {
  const meetingIndex = new Map(
    map.meetings.map((meeting) => [meeting.noteId, meeting.index])
  );
  const notes = [...topic.noteIds].sort(
    (a, b) => meetingIndex.get(a)! - meetingIndex.get(b)!
  );
  const col = new Map(notes.map((noteId, at) => [noteId, at]));
  const cellsOf = (row: TopicRow) =>
    [...row.cells.entries()].sort(
      ([a], [b]) => meetingIndex.get(a)! - meetingIndex.get(b)!
    );

  // 칸 안의 자리. 부모 행이 자식 행보다 앞이라 한 번 훑으면 된다
  const slotOf = new Map<string, number>();
  const slots = new Map<string, number>(notes.map((noteId) => [noteId, 1]));
  for (const row of topic.rows) {
    cellsOf(row).forEach(([noteId, agendas], at) => {
      const start =
        at === 0 && row.branchOf?.noteId === noteId
          ? slotOf.get(row.branchOf.agendaId)! + 1
          : 0;
      agendas.forEach((agenda, k) => slotOf.set(agenda.agendaId, start + k));
      slots.set(noteId, Math.max(slots.get(noteId)!, start + agendas.length));
    });
  }
  const left = new Map<string, number>();
  let x = FOCUS_PAD;
  for (const noteId of notes) {
    left.set(noteId, x);
    x += slots.get(noteId)! * SLOT_W;
  }
  const width = x - CARD_GAP + FOCUS_PAD;

  // 줄 배정. 갈래는 부모 행 바로 아래부터, 겹치지 않는 첫 줄
  const rowIndex = new Map<string, number>();
  const rowOfAgenda = new Map<string, TopicRow>();
  for (const row of topic.rows)
    for (const agenda of [...row.cells.values()].flat())
      rowOfAgenda.set(agenda.agendaId, row);
  const taken: [number, number][][] = [];
  for (const row of topic.rows) {
    const cols = cellsOf(row).map(([noteId]) => col.get(noteId)!);
    const parent = row.branchOf
      ? rowIndex.get(rowOfAgenda.get(row.branchOf.agendaId)!.id)!
      : -1;
    const from = row.branchOf
      ? Math.min(col.get(row.branchOf.noteId)!, cols[0])
      : cols[0];
    const to = Math.max(...cols);
    let at = parent + 1;
    while (taken[at]?.some(([a, b]) => from <= b && a <= to)) at += 1;
    (taken[at] ??= []).push([from, to]);
    rowIndex.set(row.id, at);
  }

  const cards: FocusCard[] = [];
  const rowOf = new Map<string, number>();
  const leftOf = new Map<string, number>();
  for (const row of topic.rows) {
    for (const [noteId, agendas] of cellsOf(row)) {
      for (const agenda of agendas) {
        const cardLeft =
          left.get(noteId)! + slotOf.get(agenda.agendaId)! * SLOT_W;
        cards.push({ agenda, row: rowIndex.get(row.id)!, left: cardLeft });
        rowOf.set(agenda.agendaId, rowIndex.get(row.id)!);
        leftOf.set(agenda.agendaId, cardLeft);
      }
    }
  }
  const links = map.links
    .filter((link) => rowOf.has(link.from) && rowOf.has(link.to))
    .map((link) => ({
      from: link.from,
      to: link.to,
      fork: rowOf.get(link.from) !== rowOf.get(link.to),
    }));
  const branches = topic.rows
    .filter((row) => row.branchOf)
    .map((row) => ({
      rowId: row.id,
      row: rowIndex.get(row.id)!,
      fork: row.branchOf!,
      first: cards.find((card) => rowOfAgenda.get(card.agenda.agendaId) === row)!.agenda,
    }))
    .sort((a, b) => leftOf.get(a.first.agendaId)! - leftOf.get(b.first.agendaId)!);
  return { width, rowCount: taken.length, cards, links, rowOf, leftOf, branches };
}
