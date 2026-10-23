import { describeAssignee } from "@/lib/assignees/describe";
import { formatAppDate, formatDueDate, getAppDateKey } from "@/lib/format/date";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import type { TimelineGroup } from "@/lib/notes/proposals/timeline";
import type { ReviewItem, ReviewSection } from "@/lib/notes/review/sections";
import { gapHeadline } from "@/lib/transcription/gaps";
import {
  formatOffset,
  type TranscriptRow,
} from "@/lib/transcription/presentation";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";

/**
 * 회의록 문서 한 벌. PDF 렌더러와 메일 첨부가 같은 모델에서 출발한다 — 무엇을 싣고 무엇을 「미지정」으로 둘지는
 * 여기서 다 정하고, 렌더러는 그리기만 한다. 문자열은 전부 이미 사람이 읽을 형태다.
 *
 * **두 층이다.** 1쪽 「핵심」은 그 쪽만 읽어도 회의를 아는 자리다 — 결론 · 안건 한눈에 · 할 일 담당. 2쪽부터
 * 「상세」는 결정 · 할 일 · 미결을 **한 번씩만** 번호를 달아 싣는다. 안건은 그 번호로 가리키고 내용을 다시 쓰지
 * 않는다(같은 항목이 두 자리에 서면 문서만 길어진다). 녹취록은 본문이 아니라 부록이다 — 회의록은 「한 일」의
 * 기록이고, 한 말은 본문의 시각 · 번호로 찾아가는 자리다. 회의록 도구 · 서식 조사(2026-10-16)를 따랐다.
 *
 * **모르는 값을 지어내지 않는다.** 담당 · 기한이 없으면 「미지정」으로 남긴다 — 비우면 「안 적었다」로,
 * 그럴듯한 값을 넣으면 사실로 읽힌다. 중요도도 매기지 않는다 — 고를 근거가 없어, 1쪽은 개수와 요지만 싣는다.
 */
export type MinutesDocument = {
  title: string;
  /** 「2026. 10. 15. (목) 14:00 – 14:52」. 끝난 시각을 모르면 시작 시각만 */
  dateLabel: string;
  /** 「52분」 · 「1시간 5분」. 1분 미만이거나 모르면 null */
  durationLabel: string | null;
  attendees: string[];
  attendeeCount: number;
  /** 이름이 정해지지 않은 화자 수. 녹취록의 「화자 N」이 참석자 칸에 없는 사람처럼 읽히지 않게 머리에 함께 적는다 */
  unnamedSpeakers: number;
  /** 문서를 꺼낸 사람. 받는 쪽이 누구에게 물어야 할지 안다 */
  sharedBy: string | null;
  /** 검토를 마쳐 확정한 회의록인가. 검토 중인 내용이 확정본처럼 남에게 가면 안 된다 */
  confirmed: boolean;
  /** 앱에서 제안하는 회의 제목. 보고서 본문에는 싣지 않는다 */
  headline: string | null;
  /** 결론을 받치는 요약 문장. 회의 전체에 걸친 문장이라 1쪽에 그대로 싣는다 */
  lead: string[];
  agendas: MinutesAgenda[];
  /** 할 일 담당별 수. 담당을 모르는 할 일(`name` null)은 끝에 선다 */
  owners: { name: string | null; count: number }[];
  decisions: MinutesDecision[];
  actions: MinutesAction[];
  /** 결론 없이 남은 질문 · 이슈. 비면 절을 싣지 않는다 */
  open: MinutesOpen[];
  /** 부록 녹취록. 고르지 않았으면 null */
  transcript: MinutesLine[] | null;
  /** 녹음이 끝까지 저장되지 못했다. 녹취록이 온전한 기록처럼 읽히면 안 된다 */
  transcriptTruncated: boolean;
  /** 쪽마다 아래에 서는 줄 */
  footer: string;
  fileName: string;
};

/**
 * 실제 안건의 목차 한 줄. 개수는 상세의 결정 · 할 일 · 미결 중 이 안건에서 나온 것이다.
 * 안건 미지정 항목은 상세에만 싣고 빈 안건을 만들지 않는다.
 */
export type MinutesAgenda = {
  no: number;
  title: string;
  gist: string | null;
  /** 목차의 축약본과 별개로 본문에 보존할 안건 요약 전문 */
  text: string;
  /** 이 안건이 처음 나온 녹취록 시각 */
  start: string | null;
  decisions: number;
  actions: number;
  open: number;
};

/** [agendaNo] 는 나온 안건(미지정이면 null), [at] 은 녹취록에서 찾아갈 시각이다 */
export type MinutesDecision = {
  no: number;
  text: string;
  agendaNo: number | null;
  at: string | null;
};

export type MinutesAction = {
  no: number;
  content: string;
  assignee: string | null;
  due: string | null;
  agendaNo: number | null;
  at: string | null;
};

export type MinutesOpen = {
  no: number;
  content: string;
  assignee: string | null;
  agendaNo: number | null;
  at: string | null;
};

/**
 * 부록 녹취록의 한 줄. `agenda` 는 그 안건이 **처음 나온 자리**를 표시한다 — 안건은 회의 중에 되돌아오기도 해서
 * 녹취록을 안건 구간으로 자르면 뒤에 다시 나온 말이 엉뚱한 안건 밑에 선다. [refs] 는 이 발언을 근거로 든 본문
 * 항목(「결정 2」)이다 — 본문에서 녹취록으로, 녹취록에서 본문으로 양쪽으로 찾아간다.
 */
export type MinutesLine =
  | { type: "agenda"; at: string; no: number; title: string }
  | {
      type: "utterance";
      at: string;
      speaker: string | null;
      unnamed: boolean;
      text: string;
      refs: string[];
    }
  | { type: "gap"; at: string; text: string };

export type MinutesTone = "decision" | "task" | "open";

export type MinutesTimelineRow = {
  at: string | null;
  tone: MinutesTone;
  label: string;
  text: string;
};

/** 안건 머리 한 줄과 그 아래 줄들. 안건 정본이 없는 회의는 머리 없이(`title` null) 한 묶음이다 */
export type MinutesGroup<Row> = {
  title: string | null;
  range: string | null;
  rows: Row[];
};

/** 붙임 선택. 본문은 늘 들어간다 */
export type MinutesInclude = { transcript: boolean };

export const TONE_LABEL: Record<MinutesTone, string> = {
  decision: "결정",
  task: "후속 조치",
  open: "미결",
};

/** 안건에 들지 않은 줄의 머리. 회의록 양식이 끝 안건을 부르는 이름이다 */
const OTHER_AGENDA = "기타";

export function durationLabel(ms: number | null | undefined) {
  if (!ms || ms < 60_000) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}분`;
  const rest = minutes % 60;
  return rest
    ? `${Math.floor(minutes / 60)}시간 ${rest}분`
    : `${Math.floor(minutes / 60)}시간`;
}

const clock = (value: Date | string) =>
  formatAppDate(value, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

/**
 * 일시 칸. 끝 시각은 회의가 실제로 끝난 시각([endedIso])으로만 적는다 — 시작에 기록 길이를 더하면 일시정지했던 시간이
 * 빠져 실제보다 이르게 찍혔다(09:00 시작 · 20분 일시정지 · 60분 기록이면 10:20 에 끝났는데 10:00). 모르면 시작 시각만.
 */
function dateLabelOf(whenIso: string, endedIso: string | undefined) {
  const day = formatAppDate(whenIso, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const start = clock(whenIso);
  if (!endedIso) return `${day} ${start}`;
  // 자정을 넘긴 회의는 끝난 날도 적는다 — 시각만 두면 같은 날 23:30 – 00:30 으로 읽힌다
  if (getAppDateKey(endedIso) !== getAppDateKey(whenIso)) {
    const endDay = formatAppDate(endedIso, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    return `${day} ${start} – ${endDay} ${clock(endedIso)}`;
  }
  return `${day} ${start} – ${clock(endedIso)}`;
}

/** 파일 이름에 못 쓰는 글자를 걷어 낸다. 운영체제마다 막는 글자가 달라 가장 좁은 쪽(Windows)에 맞춘다 */
export function minutesFileName(title: string, whenIso: string) {
  const safe = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, "");
  return `회의록_${safe || "회의"}_${getAppDateKey(whenIso).replaceAll("-", "")}.pdf`;
}

const rangeOf = (startMs: number | null, endMs: number | null) =>
  startMs === null
    ? null
    : endMs === null
      ? formatOffset(startMs)
      : `${formatOffset(startMs)} – ${formatOffset(endMs)}`;

/** 묶음 머리. 안건이 하나라도 있으면 안건 밖 묶음은 「기타」, 하나도 없으면 머리를 세우지 않는다 */
function headsOf(groups: readonly TimelineGroup[], lengthMs: number | null) {
  const anyAgenda = groups.some((group) => group.agenda !== null);
  return groups.map((group) => ({
    title: anyAgenda ? (group.agenda?.title ?? OTHER_AGENDA) : null,
    range: anyAgenda ? rangeOf(group.startMs, group.endMs ?? lengthMs) : null,
  }));
}

/**
 * 타임라인을 회의록의 「안건별 경과」로 옮긴다. **결정 · 후속 조치 · 미결만 싣는다** — 답한 질문과 참고는 회의록
 * 본문이 이미 말하거나 기록할 거리가 아니다. 질문 ↔ 답 같은 관계도 싣지 않는다: 종이 위에서는 줄 사이 화살표를
 * 따라갈 수 없어, 시간순 한 줄씩이 가장 잘 읽힌다. 철회된 줄은 회의에서 거둔 말이라 뺀다.
 */
export function minutesTimeline(
  groups: readonly TimelineGroup[],
  lengthMs: number | null = null
) {
  const heads = headsOf(groups, lengthMs);
  return groups
    .map(
      (group, index): MinutesGroup<MinutesTimelineRow> => ({
        ...heads[index],
        rows: group.items.flatMap((item) => {
          if (item.proposal.closeReason === "RETRACTED") return [];
          if (
            item.tone !== "decision" &&
            item.tone !== "task" &&
            item.tone !== "open"
          )
            return [];
          return [
            {
              at: item.atMs === null ? null : formatOffset(item.atMs),
              tone: item.tone,
              label: TONE_LABEL[item.tone],
              text: item.proposal.content.trim(),
            },
          ];
        }),
      })
    )
    .filter((group) => group.rows.length > 0);
}

/**
 * 어느 안건에도 들지 않은 질문 · 이슈 중 **아직 열린 것**. 검토본은 답한 질문도 포함한 채 남기므로, 원본 제안이
 * 원장(타임라인)에서 아직 열렸는지 본다 — 요약 분석이 없는 회의는 질문이 전부 안건 밖이라, 보지 않으면 답한 질문까지
 * 미결로 적혔다. 사람이 더한 항목(원본 제안이 없다)은 열린 것이다. 원장을 못 읽으면 부르는 쪽이 회의록을 만들지 않는다.
 */
export function stillOpen(
  items: readonly ReviewItem[],
  groups: readonly TimelineGroup[]
): ReviewItem[] {
  const open = new Set(
    groups.flatMap((group) =>
      group.items
        .filter((row) => row.tone === "open")
        .map((row) => row.proposal.proposalId)
    )
  );
  return items.filter(
    (item) =>
      !item.originalProposalRef || open.has(item.originalProposalRef.proposalId)
  );
}

export type SpeakerOf = (
  label: string | null | undefined,
  assignedParticipantId?: string | null
) => SpeakerIdentity | null;

/**
 * 같은 사람이 이어서 한 말을 한 줄로 잇는 길이 상한(글자). 전사는 숨 쉬는 자리마다 끊어, 줄마다 시각 · 이름이
 * 서면 녹취록이 두세 배로 길어진다. 너무 긴 줄은 쪽을 넘기지 못해(한 줄은 한 쪽 안에 선다) 이 길이에서 끊는다
 */
const RUN_CHARS = 400;
/** 녹취록 한 줄이 품는 줄바꿈 상한. 글자 수가 적어도 줄이 많으면 쪽보다 높아진다 */
const RUN_LINES = 8;

/** 회의록 본문의 재료가 되는 안건. 검토 화면의 주제 요약(`TopicDigest`)이 그대로 맞는다 */
export type MinutesTopic = {
  title: string;
  /** 안건 한 줄. 없으면 서술(`text`)의 첫 문장 */
  gist: string | null;
  text: string;
  decisions: readonly ReviewItem[];
  tasks: readonly ReviewItem[];
  /** 결론 없이 남은 이슈 · 질문 */
  open: readonly ReviewItem[];
  /** 이 안건이 처음 나온 때(ms). 검토 화면이 안건 차례를 정한 그 값이다 */
  startMs?: number | null;
};

export type MinutesTranscriptSource = {
  rows: readonly TranscriptRow[];
  /** 화자 분리 전이면 null — 「화자 A」는 아직 아무도 아니라 이름 칸을 비운다 */
  speakerOf: SpeakerOf | null;
  truncated: boolean;
};

/**
 * 1쪽 안건 표의 요지가 넘지 않을 길이(글자). 표 행은 쪽을 넘기지 못해 긴 서술을 그대로 두면 뒤가 잘렸고, 200자로
 * 두면 안건 여덟 개가 1쪽을 넘겼다(100 · 80자도 행이 세 줄이라 넘쳤다 — 표 글 칸에 한 줄 40자 남짓이 든다). 제목과 이어 두 줄 안에 드는 길이다
 */
const GIST_CHARS = 60;

/**
 * 안건 요지. 서버의 한 줄 요약(`gist`)이 있으면 그것, 없으면 서술의 첫 문장이다 — 1쪽은 요지만 싣는 자리라 서술 전체를
 * 옮기지 않는다. 그래도 [GIST_CHARS] 를 넘으면 낱말 사이에서 줄이고 「…」를 단다.
 */
function gistOf(topic: Pick<MinutesTopic, "gist" | "text">): string | null {
  const text =
    topic.gist?.trim() ||
    topic.text.trim().match(/^.+?[.!?。](?=\s|$)/)?.[0] ||
    topic.text.trim();
  if (!text) return null;
  if (text.length <= GIST_CHARS) return text;
  const cut = text.lastIndexOf(" ", GIST_CHARS);
  return `${text.slice(0, cut > GIST_CHARS / 2 ? cut : GIST_CHARS).trimEnd()}…`;
}

const pointAt = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? null : formatOffset(ms);

export function buildMinutes({
  note,
  sharedBy = null,
  confirmed = false,
  headline = null,
  lead = [],
  topics,
  sections,
  citedAt,
  unfiledOpen = [],
  unnamedSpeakers = 0,
  transcript = null,
  include,
}: {
  note: NoteMeta;
  sharedBy?: string | null;
  confirmed?: boolean;
  headline?: string | null;
  lead?: readonly string[];
  /** 회의에서 나온 차례로 선 안건 */
  topics: readonly MinutesTopic[];
  /** 검토 섹션. 안건 미지정 결정 · 할 일을 상세에 보존한다 */
  sections: readonly ReviewSection[];
  /** 항목이 회의에서 나온 때(ms). 인용으로 계산한다 */
  citedAt: (item: ReviewItem) => number | null;
  /** 안건 미지정 질문 · 이슈도 미결 사항에 보존한다 */
  unfiledOpen?: readonly ReviewItem[];
  unnamedSpeakers?: number;
  transcript?: MinutesTranscriptSource | null;
  include: MinutesInclude;
}): MinutesDocument {
  const attendees = (note.participantNames ?? [])
    .map((name) => name.trim())
    .filter(Boolean);
  const date = formatAppDate(note.whenIso, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  // 같은 항목이 두 안건에 걸려도 처음 안건에만 싣는다 — 두 번 세면 할 일이 늘어난다
  const seen = new Set<string>();
  const fresh = (items: readonly ReviewItem[]) =>
    items.filter((item) => {
      if (!item.included || seen.has(item.itemId)) return false;
      seen.add(item.itemId);
      return true;
    });

  const decisions: MinutesDecision[] = [];
  const actions: MinutesAction[] = [];
  const open: MinutesOpen[] = [];
  const agendas: MinutesAgenda[] = [];
  const agendaStarts: { ms: number; no: number; title: string }[] = [];
  // 녹취록 구간 → 그것을 근거로 든 본문 항목
  const refsOf = new Map<string, string[]>();
  const cite = (item: ReviewItem, label: string) => {
    for (const { segmentId } of item.citations ?? [])
      refsOf.set(segmentId, [...(refsOf.get(segmentId) ?? []), label]);
  };

  const place = (
    no: number | null,
    title: string,
    gist: string | null,
    startMs: number | null,
    source: Pick<MinutesTopic, "decisions" | "tasks" | "open">,
    text = ""
  ) => {
    const picked = {
      decisions: fresh(source.decisions),
      tasks: fresh(source.tasks),
      open: fresh(source.open),
    };
    for (const item of picked.decisions) {
      decisions.push({
        no: decisions.length + 1,
        text: item.content.trim(),
        agendaNo: no,
        at: pointAt(citedAt(item)),
      });
      cite(item, `결정 ${decisions.length}`);
    }
    for (const item of picked.tasks) {
      actions.push({
        no: actions.length + 1,
        content: item.content.trim(),
        assignee: describeAssignee(item.assignee)?.name ?? null,
        due: item.due ? formatDueDate(item.due) : null,
        agendaNo: no,
        at: pointAt(citedAt(item)),
      });
      cite(item, `할 일 ${actions.length}`);
    }
    for (const item of picked.open) {
      open.push({
        no: open.length + 1,
        content: item.content.trim(),
        assignee: describeAssignee(item.assignee)?.name ?? null,
        agendaNo: no,
        at: pointAt(citedAt(item)),
      });
      cite(item, `미결 ${open.length}`);
    }
    const counts = {
      decisions: picked.decisions.length,
      actions: picked.tasks.length,
      open: picked.open.length,
    };
    if (
      no === null ||
      (!gist && counts.decisions + counts.actions + counts.open === 0)
    )
      return;
    agendas.push({ no, title, gist, text, start: pointAt(startMs), ...counts });
    if (startMs !== null) agendaStarts.push({ ms: startMs, no, title });
  };

  topics.forEach((topic, index) =>
    place(
      index + 1,
      topic.title.trim(),
      gistOf(topic),
      topic.startMs ?? null,
      topic,
      topic.text.trim() || topic.gist?.trim() || ""
    )
  );
  const rest = (key: ReviewSection["key"]) =>
    sections.find((section) => section.key === key)?.items ?? [];
  place(null, "", null, null, {
    decisions: rest("DECISION"),
    tasks: rest("ACTION_ITEM"),
    open: unfiledOpen,
  });

  const owners = new Map<string | null, number>();
  for (const action of actions)
    owners.set(action.assignee, (owners.get(action.assignee) ?? 0) + 1);

  return {
    title: note.title,
    dateLabel: dateLabelOf(note.whenIso, note.endedIso),
    durationLabel: durationLabel(note.durationMs),
    attendees,
    attendeeCount: attendees.length || note.participantCount,
    unnamedSpeakers,
    sharedBy: sharedBy?.trim() || null,
    confirmed,
    headline: headline?.trim() || null,
    lead: lead.map((line) => line.trim()).filter(Boolean),
    agendas,
    owners: [...owners]
      .map(([name, count]) => ({ name, count }))
      .sort(
        (a, b) =>
          Number(a.name === null) - Number(b.name === null) || b.count - a.count
      ),
    decisions,
    actions,
    open,
    transcript:
      include.transcript && transcript
        ? transcriptLines(transcript, refsOf, agendaStarts)
        : null,
    transcriptTruncated:
      include.transcript && transcript ? transcript.truncated : false,
    footer: `${date} · ${note.title} 회의록`,
    fileName: minutesFileName(note.title, note.whenIso),
  };
}

/** [RUN_CHARS] 를 넘는 말을 낱말 사이에서 나눈다. 빈칸 없이 긴 글은 그 길이에서 자른다 */
function splitRun(text: string): string[] {
  const lines = text.split("\n").flatMap((line) => {
    const parts: string[] = [];
    let rest = line;
    while (rest.length > RUN_CHARS) {
      const space = rest.lastIndexOf(" ", RUN_CHARS);
      const cut = space > RUN_CHARS / 2 ? space : RUN_CHARS;
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    parts.push(rest);
    return parts;
  });
  // 줄 수로도 끊는다 — 줄바꿈이 많은 말은 400자가 안 돼도 한 쪽보다 높았다(「발언」 80줄 · 239자)
  const out: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (
      current.length > 0 &&
      (current.length >= RUN_LINES ||
        [...current, line].join("\n").length > RUN_CHARS)
    ) {
      out.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.some(Boolean)) out.push(current.join("\n"));
  return out.filter((part) => part.trim());
}

/**
 * 부록 녹취록. 같은 사람이 이어서 한 말은 첫 시각의 한 줄로 잇고([RUN_CHARS] 에서 끊는다), 안건이 처음 나온 자리에
 * 표시 줄을 넣고, 본문 항목이 근거로 든 발언에 그 번호를 단다. 화자를 모르는 줄(분리 전 · 미배정)은 누가 말했는지
 * 몰라 잇지 않는다.
 */
function transcriptLines(
  { rows, speakerOf }: MinutesTranscriptSource,
  refsOf: ReadonlyMap<string, string[]>,
  agendaStarts: readonly { ms: number; no: number; title: string }[]
): MinutesLine[] {
  const starts = [...agendaStarts].sort((a, b) => a.ms - b.ms);
  const lines: MinutesLine[] = [];
  let next = 0;
  let lastKey: string | null = null;
  for (const row of rows) {
    while (next < starts.length && starts[next].ms <= row.startedAtMs) {
      const { ms, no, title } = starts[next++];
      lines.push({ type: "agenda", at: formatOffset(ms), no, title });
    }
    if (row.type === "gap") {
      lines.push({
        type: "gap",
        at: formatOffset(row.gap.startedAtMs),
        text: gapHeadline(row.gap),
      });
      lastKey = null;
      continue;
    }
    const text = row.segment.text.trim();
    if (!text) continue;
    const who =
      speakerOf?.(
        row.segment.speakerLabel,
        row.segment.assignedParticipantId
      ) ?? null;
    const speaker = who?.displayName ?? null;
    // 같은 사람인지는 이름이 아니라 배정된 참여자(없으면 화자 라벨)로 가린다 — 이름이 같은 두 사람의 말이 한 줄로 붙었다
    const key =
      who === null
        ? null
        : row.segment.assignedParticipantId
          ? `p:${row.segment.assignedParticipantId}`
          : `l:${row.segment.speakerLabel}`;
    const refs = [...new Set(refsOf.get(row.segment.segmentId) ?? [])];
    const previous = lines.at(-1);
    const sameSpeaker = key !== null && key === lastKey;
    lastKey = key;
    const joinedLines =
      previous?.type === "utterance"
        ? previous.text.split("\n").length + text.split("\n").length
        : 0;
    if (
      previous?.type === "utterance" &&
      sameSpeaker &&
      previous.text.length + text.length < RUN_CHARS &&
      joinedLines <= RUN_LINES
    ) {
      // 이은 구간들이 같은 항목을 함께 인용하면 번호가 겹친다
      lines[lines.length - 1] = {
        ...previous,
        text: `${previous.text} ${text}`,
        refs: [...new Set([...previous.refs, ...refs])],
      };
      continue;
    }
    // 구간 하나가 이미 길면(한 사람이 쉬지 않고 오래 말했다) 여러 줄로 나눈다 — 한 줄은 쪽을 넘기지 못해 뒤가 잘린다.
    // 이은 줄에는 시각을 다시 적지 않는다
    splitRun(text).forEach((part, index) =>
      lines.push({
        type: "utterance",
        at: index === 0 ? formatOffset(row.segment.startedAtMs) : "",
        speaker,
        // 사람이 안 붙은 화자는 라벨 이름(「화자 A」)으로 선다. 확인 여부(`unassigned`)와는 다르다 — 이름이 붙었으면 사람이다
        unnamed:
          who !== null &&
          who.displayName === `화자 ${row.segment.speakerLabel}`,
        text: part,
        refs: index === 0 ? refs : [],
      })
    );
  }
  for (; next < starts.length; next++) {
    const { ms, no, title } = starts[next];
    lines.push({ type: "agenda", at: formatOffset(ms), no, title });
  }
  return lines;
}

const MARK_CONSONANTS = [0, 2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18]; // ㄱ ㄴ ㄷ … ㅎ
const MARK_VOWELS = [0, 4, 8, 13, 18, 20]; // ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ

/** 공문서 항목 기호. 가 · 나 · … · 하 다음은 거 · 너 · … 로 잇는다 */
export function hangulMarker(index: number) {
  const consonant = MARK_CONSONANTS[index % 14];
  const vowel = MARK_VOWELS[Math.floor(index / 14)];
  if (vowel === undefined) return `${index + 1}`;
  return String.fromCharCode(0xac00 + (consonant * 21 + vowel) * 28);
}
