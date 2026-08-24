import type {
  AnalysisResultResponseDataSectionsItem,
  NoteResponseData,
} from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { SECTION_LABELS, SECTION_ORDER } from "@/lib/notes/analysis-sections";
import { gapHeadline } from "@/lib/transcription/gaps";
import {
  formatOffset,
  type TranscriptRow,
} from "@/lib/transcription/presentation";

/**
 * 붙여넣는 곳이 무엇인지 우리는 모른다 — Notion·Slack·이슈 본문일 수도, AI에게 물어보는
 * 입력창일 수도 있다. 그래서 **마크다운으로 읽히면서 평문으로도 읽히는** 형태만 쓴다:
 * 헤딩, 굵게, 불릿, 인용. 표·코드펜스는 렌더가 없는 곳에서 기호만 남는다.
 *
 * 시각은 `[00:12:30]` 대괄호다. 백틱은 렌더러가 코드로 칠해 본문보다 튀고, 평문에서는
 * 문장 안에 낀 기호로 읽힌다.
 */

export type NoteMeta = {
  title: string;
  /** 회의 시작(없으면 생성) 시각 ISO. */
  whenIso: string;
  participantCount: number;
  /** 전사 응답의 `recording.durationMs`. 요약에는 없으므로 선택이다. */
  durationMs?: number;
};

/**
 * 머리말이 될 사실만 남긴다. **셸이 한 번 읽어 내린다** — 탭마다 `useGetNote`를 다시
 * 구독하면 같은 쿼리에 구독자가 셋이 붙는다(rule `architecture`).
 */
export function toNoteMeta(note: NoteResponseData): NoteMeta {
  return {
    title: note.title,
    // 헤더 메타와 같은 기준이다 — 시작 전 노트는 만든 시각이 그 노트의 시각이다.
    whenIso: note.meetingStartedAt ?? note.createdAt,
    participantCount: note.participants?.length ?? 0,
  };
}

/**
 * 문단이 갈리는 조용한 시간.
 *
 * **서버 형식을 그대로 뽑으면 회의록이 안 된다.** 계약이 「한 행이 발화 하나」라 두 어절짜리
 * 줄이 수백 개 온다. 화자가 같고 쉼이 짧으면 한 문단으로 잇는다.
 *
 * **화면에서 지운 `groupTranscriptSegments`를 되살린 것이 아니다.** 그 묶기가 죽은 이유는
 * 둘 다 화면의 사정이었다 — 화자가 회의 종료 후에 도착해 읽던 문단이 다시 쪼개졌고, 묶인
 * 문단에는 요약 근거가 짚을 DOM 노드가 없었다(`presentation.ts` 참조). 복사는 한 번 뜨고
 * 마는 스냅숏이라 다시 쪼개질 일도, 짚을 노드도 없다.
 *
 * ponytail: 15초는 눈으로 고른 값이다. 너무 잘게 끊기거나 한 덩어리로 뭉치면 여기를 만진다.
 */
const PARAGRAPH_GAP_MS = 15_000;

function headingLines(meta: NoteMeta, suffix = "") {
  const facts = [
    formatAppDate(meta.whenIso, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    meta.participantCount > 0 ? `참석자 ${meta.participantCount}명` : null,
    // 1분 미만은 「기록 0분」이 된다 — 수가 뜻을 안 보태면 적지 않는다.
    meta.durationMs && meta.durationMs >= 60_000
      ? `기록 ${Math.floor(meta.durationMs / 60_000)}분`
      : null,
  ].filter(Boolean);

  return [`# ${meta.title}${suffix}`, "", facts.join(" · ")];
}

type Paragraph = {
  /**
   * 묶는 기준. **이름이 아니라 라벨이다** — 동명이인이 둘 붙으면 이름이 같아져 A와 B의
   * 발화가 한 문단으로 뭉치고 화자가 바뀐 자리가 사라진다.
   *
   * 이름을 안 적는 구간(화자 분리 전)은 라벨이 달라도 화면에 경계가 안 보이므로 `null`
   * 하나로 묶는다. 안 그러면 이유가 안 보이는 자리에서 문단이 끊긴다.
   */
  speakerKey: string | null;
  speaker: string | null;
  startedAtMs: number;
  endedAtMs: number;
  texts: string[];
};

/**
 * 전사를 회의록으로 옮긴다. `rows`는 화면이 그리는 것과 **같은 배열**이다 — 실시간으로
 * 들어온 줄까지 이미 섞여 있고, 복사본이 화면과 어긋날 자리가 없다.
 */
export function transcriptToMarkdown({
  note,
  rows,
  speakerNameOf,
  truncated = false,
}: {
  note: NoteMeta;
  rows: TranscriptRow[];
  /** 화자 분리 전이면 늘 `null`을 준다 — 그때는 시각만 남는다. */
  speakerNameOf: (label: string | null | undefined) => string | null;
  /** 봉인이 `TRUNCATED`인가. 화면이 말하는 손실을 복사본도 말해야 한다. */
  truncated?: boolean;
}): string {
  const lines = headingLines(note);
  let block: Paragraph | null = null;

  const flush = () => {
    if (!block) return;
    const at = `[${formatOffset(block.startedAtMs)}]`;
    const body = block.texts.join(" ");
    // 화자가 없으면 머리글 줄을 따로 세우지 않는다 — 시각만 있는 줄이 홀로 뜬다.
    lines.push(
      "",
      ...(block.speaker
        ? [`**${block.speaker}** ${at}`, body]
        : [`${at} ${body}`])
    );
    block = null;
  };

  for (const row of rows) {
    if (row.type === "gap") {
      flush();
      lines.push("", `> ${gapHeadline(row.gap)}`);
      continue;
    }

    const text = row.segment.text.trim();
    if (!text) continue;
    const speaker = speakerNameOf(row.segment.speakerLabel);
    const speakerKey =
      speaker === null ? null : (row.segment.speakerLabel ?? null);

    if (
      block &&
      block.speakerKey === speakerKey &&
      row.segment.startedAtMs - block.endedAtMs <= PARAGRAPH_GAP_MS
    ) {
      block.texts.push(text);
      block.endedAtMs = row.segment.endedAtMs;
      continue;
    }

    flush();
    block = {
      speakerKey,
      speaker,
      startedAtMs: row.segment.startedAtMs,
      endedAtMs: row.segment.endedAtMs,
      texts: [text],
    };
  }
  flush();

  // **완전한 회의록처럼 붙여넣어지면 안 된다.** 화면은 이 줄을 이미 말하고 있다.
  if (truncated) lines.push("", "> 기록이 끝까지 저장되지 못했습니다");

  return `${lines.join("\n")}\n`;
}

/**
 * 요약을 옮긴다. 근거는 항목 아래 중첩 불릿이다 — 어느 말에서 나온 항목인지가 항목과
 * 같은 덩어리에 붙어 있어야 따로 읽히지 않는다.
 */
export function summaryToMarkdown({
  note,
  sections,
}: {
  note: NoteMeta;
  sections: AnalysisResultResponseDataSectionsItem[];
}): string {
  const lines = headingLines(note, " — 요약");
  const byKind = new Map(sections.map((section) => [section.kind, section]));

  for (const kind of SECTION_ORDER) {
    lines.push("", `## ${SECTION_LABELS[kind]}`, "");
    const items = byKind.get(kind)?.items ?? [];
    if (!items.length) {
      // 화면과 같다 — 뽑을 것이 없었다는 사실도 요약의 일부다.
      lines.push("_없음_");
      continue;
    }
    for (const item of items) {
      lines.push(`- ${item.content}`);
      // 근거를 못 찾은 항목은 한 줄로 끝난다. 빈 불릿을 만들지 않는다.
      for (const evidence of item.evidence) {
        lines.push(
          `  - [${formatOffset(evidence.startedAtMs)}] ${evidence.text}`
        );
      }
    }
  }

  return `${lines.join("\n")}\n`;
}
