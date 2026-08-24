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

/**
 * 전사를 회의록으로 옮긴다. `rows`는 화면이 그리는 것과 **같은 배열**이다 — 실시간으로
 * 들어온 줄까지 이미 섞여 있고, 복사본이 화면과 어긋날 자리가 없다.
 *
 * **서버가 가른 대로 둔다.** 발화 하나가 줄 하나이고 저마다 자기 시각을 단다. 인접 발화를
 * 문단으로 묶어 봤지만 어느 말이 몇 분에 나왔는지가 묶음의 첫 시각으로 뭉개졌다 —
 * 회의록에서 시각은 되짚을 좌표라 그것을 잃으면서 얻을 것이 없었다.
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

  for (const row of rows) {
    if (row.type === "gap") {
      lines.push("", `> ${gapHeadline(row.gap)}`);
      continue;
    }

    const text = row.segment.text.trim();
    if (!text) continue;
    const speaker = speakerNameOf(row.segment.speakerLabel);
    const at = `[${formatOffset(row.segment.startedAtMs)}]`;

    // **줄 사이를 비운다.** 마크다운에서 줄바꿈만으로는 문단이 안 갈려서, 붙여 두면
    // 렌더러가 발화 전부를 한 문단으로 이어 붙인다.
    lines.push("", speaker ? `**${speaker}** ${at} ${text}` : `${at} ${text}`);
  }

  // **완전한 회의록처럼 붙여넣어지면 안 된다.** 화면은 이 줄을 이미 말하고 있다.
  if (truncated) lines.push("", "> 기록이 끝까지 저장되지 못했습니다");

  return `${lines.join("\n")}\n`;
}

/**
 * 요약을 옮긴다. **근거는 싣지 않는다** — 항목마다 전사 원문이 최대 셋씩 붙어 요약이
 * 서너 배로 불어난다. 근거를 되짚을 사람은 전사를 복사한다.
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
    }
  }

  return `${lines.join("\n")}\n`;
}
