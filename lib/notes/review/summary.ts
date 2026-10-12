import type {
  MeetingReviewSummaryResponseData,
  MeetingReviewSummaryResponseDataAgendasItem,
  MeetingReviewSummaryResponseDataAgendasItemConclusionsItem,
  MeetingReviewSummaryResponseDataAgendasItemRelationsItem,
} from "@/lib/api/generated/models";

/**
 * 회의 요약 조회 응답의 화면 이름. 명제 참조는 전부 검토 항목 ID(`itemId`)로 풀려서 온다 —
 * 화면은 요약과 검토 항목을 이 ID로만 잇는다.
 *
 * **주제는 `agendas` 로 읽는다.** `topics` 는 같은 목록의 옛 이름이라 server ② 에서 사라진다.
 */
export type MeetingReviewSummary = MeetingReviewSummaryResponseData;
export type SummaryTopic = MeetingReviewSummaryResponseDataAgendasItem;
export type SummaryRelation = MeetingReviewSummaryResponseDataAgendasItemRelationsItem;
/** 설명 · 결론 · 남은 일의 한 문장. `itemIds` 는 그 문장이 근거로 삼은 검토 항목이다 */
export type SummarySentence = MeetingReviewSummaryResponseDataAgendasItemConclusionsItem;

/** 회의를 말하는 첫 문장. 한 문장(headline)이 있으면 그것, 없는 옛 요약은 lead 문단이다 */
export const overviewText = (summary: MeetingReviewSummary) =>
  summary.headline?.text ?? summary.lead.map((line) => line.text).join(" ");

export const summaryTopics = (summary: MeetingReviewSummary | null | undefined): SummaryTopic[] =>
  summary?.agendas ?? [];

/** 화면 key. 옛 노트는 안건 행이 없어 agendaId 가 null 이다 — 그때는 순서 번호로 가른다 */
export const topicKey = (topic: Pick<SummaryTopic, "agendaId" | "ordinal">) => topic.agendaId ?? `ordinal:${topic.ordinal}`;
