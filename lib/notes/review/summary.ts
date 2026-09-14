import type {
  MeetingReviewSummaryResponseData,
  MeetingReviewSummaryResponseDataTopicsItem,
  MeetingReviewSummaryResponseDataTopicsItemRelationsItem,
} from "@/lib/api/generated/models";

/**
 * 회의 요약 조회 응답의 화면 이름. 명제 참조는 전부 검토 항목 ID(`itemId`)로 풀려서 온다 —
 * 화면은 요약과 검토 항목을 이 ID로만 잇는다.
 */
export type MeetingReviewSummary = MeetingReviewSummaryResponseData;
export type SummaryTopic = MeetingReviewSummaryResponseDataTopicsItem;
export type SummaryRelation = MeetingReviewSummaryResponseDataTopicsItemRelationsItem;
