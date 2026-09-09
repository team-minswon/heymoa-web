import { apiFetch } from "@/lib/api/fetcher";
import {
  conceptSummarySchema,
  meetingApprovalSchema,
  meetingReviewSchema,
  reviewMutationSchema,
  type ConceptSummary,
  type MeetingApproval,
  type MeetingReview,
  type RelationJudgement,
  type ReviewMutation,
} from "@/lib/notes/meeting-review/contract";

/**
 * **임시 호출부다.** `openapi3.yml` 에 이 경로들이 아직 없어 orval 이 훅을 못 만든다.
 * 계약이 들어오면 이 파일은 사라지고 호출부가 생성 훅으로 바뀐다(`ADAPTER.md`).
 *
 * 그때까지도 **`fetch()` 를 직접 쓰지 않고 공용 mutator 를 지난다** — 401 → refresh →
 * 재시도가 거기 있고, 우회하면 이 화면만 토큰 만료에서 조용히 실패한다. `api-data.md`
 * 의 예외 셋에 없는 자리이므로 이 근거를 남긴다. 선례는 APP-454 의
 * `lib/notes/context-candidates/api.ts`(계약 도착 뒤 삭제).
 *
 * **봉투가 두 겹이다.** `apiFetch` 가 `{ data, status, headers }` 로 한 번 감싸고, 그 `data`
 * 가 서버의 `{ success, data, error }` 봉투다. non-ok 는 `apiFetch` 가 던지므로(그 봉투를
 * 그대로) 409·403 은 호출부의 `catch` 에서 `errorCodeOf()` 로 읽는다.
 */
type Envelope<T> = {
  status: number;
  data: { success: boolean; data: T; error: unknown };
};

async function readEnvelope<T>(
  promise: Promise<Envelope<unknown>>,
  parse: (data: unknown) => T,
  what: string
): Promise<T> {
  const response = await promise;
  if (!response.data?.success) {
    throw new Error(`${what} request failed`);
  }
  return parse(response.data.data);
}

const json = (data: Record<string, unknown>) => ({
  method: "POST" as const,
  headers: { "Content-Type": "application/json" },
  data,
});

const patch = (data: Record<string, unknown>) => ({
  ...json(data),
  method: "PATCH" as const,
});

export function fetchMeetingReview(noteId: string): Promise<MeetingReview> {
  return readEnvelope(
    apiFetch<Envelope<unknown>>(`/v1/notes/${noteId}/meeting-review`),
    (data) => meetingReviewSchema.parse(data),
    "meeting review"
  );
}

export type CreateReviewItemInput = {
  expectedReviewVersion: number;
  regionId?: string;
  kind: string;
  content: string;
};

export function createReviewItem(
  noteId: string,
  input: CreateReviewItemInput
): Promise<ReviewMutation> {
  return readEnvelope(
    apiFetch<Envelope<unknown>>(
      `/v1/notes/${noteId}/meeting-review/items`,
      json(input)
    ),
    (data) => reviewMutationSchema.parse(data),
    "create review item"
  );
}

export type UpdateReviewItemInput = {
  expectedReviewVersion: number;
  expectedItemRevision: number;
  content?: string;
  included?: boolean;
  assigneeText?: string | null;
  dueText?: string | null;
};

export function updateReviewItem(
  noteId: string,
  itemId: string,
  input: UpdateReviewItemInput
): Promise<ReviewMutation> {
  return readEnvelope(
    apiFetch<Envelope<unknown>>(
      `/v1/notes/${noteId}/meeting-review/items/${itemId}`,
      patch(input)
    ),
    (data) => reviewMutationSchema.parse(data),
    "update review item"
  );
}

export type JudgeRelationInput = {
  expectedReviewVersion: number;
  expectedRelationRevision: number;
  judgement: Exclude<RelationJudgement["status"], "PROPOSED">;
  label?: string;
  note?: string | null;
};

export function judgeRelation(
  noteId: string,
  relationId: string,
  input: JudgeRelationInput
): Promise<ReviewMutation> {
  return readEnvelope(
    apiFetch<Envelope<unknown>>(
      `/v1/notes/${noteId}/meeting-review/relations/${relationId}`,
      patch(input)
    ),
    (data) => reviewMutationSchema.parse(data),
    "judge relation"
  );
}

export async function recheckRelations(
  noteId: string,
  expectedReviewVersion: number
): Promise<void> {
  await apiFetch<Envelope<unknown>>(
    `/v1/notes/${noteId}/meeting-review/relations/recheck`,
    json({ expectedReviewVersion })
  );
}

export type ApproveMeetingInput = {
  idempotencyKey: string;
  reviewVersion: number;
  /** 승인본이 없으면 null. 0 으로 바꾸지 않는다. */
  projectApprovalVersion: number | null;
};

export function approveMeeting(
  noteId: string,
  input: ApproveMeetingInput
): Promise<MeetingApproval> {
  return readEnvelope(
    apiFetch<Envelope<unknown>>(
      `/v1/notes/${noteId}/meeting-approval`,
      json(input)
    ),
    (data) => meetingApprovalSchema.parse(data),
    "approve meeting"
  );
}

export function fetchMeetingApproval(noteId: string): Promise<MeetingApproval> {
  return readEnvelope(
    apiFetch<Envelope<unknown>>(`/v1/notes/${noteId}/meeting-approval`),
    (data) => meetingApprovalSchema.parse(data),
    "meeting approval"
  );
}

export function fetchConceptSummary(projectId: string): Promise<ConceptSummary> {
  return readEnvelope(
    apiFetch<Envelope<unknown>>(`/v1/projects/${projectId}/concept-summary`),
    (data) => conceptSummarySchema.parse(data),
    "concept summary"
  );
}

export async function refreshConceptSummary(projectId: string): Promise<void> {
  await apiFetch<Envelope<unknown>>(
    `/v1/projects/${projectId}/concept-summary/refresh`,
    { method: "POST" }
  );
}
