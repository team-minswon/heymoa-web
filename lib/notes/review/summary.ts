import type {
  MeetingReviewSummaryResponseData,
  MeetingReviewSummaryResponseDataAgendasItem,
  MeetingReviewSummaryResponseDataAgendasItemConclusionsItem,
  MeetingReviewSummaryResponseDataAgendasItemRelationsItem,
} from "@/lib/api/generated/models";

export type MeetingReviewSummary = MeetingReviewSummaryResponseData;
export type SummaryTopic = MeetingReviewSummaryResponseDataAgendasItem;
export type SummaryRelation =
  MeetingReviewSummaryResponseDataAgendasItemRelationsItem;
export type SummarySentence =
  MeetingReviewSummaryResponseDataAgendasItemConclusionsItem;

export const overviewText = (summary: MeetingReviewSummary) =>
  summary.lead
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join(" ") ||
  summary.headline?.text?.trim() ||
  "";

export const summaryTopics = (
  summary: MeetingReviewSummary | null | undefined
): SummaryTopic[] => summary?.agendas ?? [];

export const topicKey = (topic: Pick<SummaryTopic, "agendaId" | "ordinal">) =>
  topic.agendaId ?? `ordinal:${topic.ordinal}`;
