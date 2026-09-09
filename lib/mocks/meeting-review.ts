import { http, HttpResponse } from "msw";

import type {
  AddMeetingReviewItemRequest,
  MeetingReviewResponseData,
  MeetingReviewResponseDataItemsItem as ReviewItem,
  UpdateMeetingReviewItemRequest,
} from "@/lib/api/generated/models";
import { mockDb } from "@/lib/mocks/db";
import { MOCK_USER } from "@/lib/mocks/mock-user";

/**
 * 회의 검토본 목. 계약(`openapi3.yml`)의 세 경로 — 조회 · 생성 · 항목 추가 · 항목 수정 — 를
 * CAS(`expectedReviewVersion` · `expectedItemRevision`) 그대로 재현한다.
 *
 * 시드는 둘이다. 하나는 **내가 시작했고 전사가 있는** 종료 회의라 편집과 근거 점프를 다
 * 밟을 수 있고, 다른 하나는 **남이 시작한** 회의라 읽기만 된다. 나머지 종료 노트는 404로
 * 시작해 「검토본 만들기」 경로를 지난다. 무작위값은 없다.
 */
export const REVIEW_NOTE_ID = "01K0000000020";
export const REVIEW_OTHER_STARTER_NOTE_ID = "01K0000000021";

const MESSAGES: Record<string, string> = {
  MEETING_REVIEW_NOT_FOUND: "검토본 또는 항목을 찾을 수 없습니다.",
  MEETING_REVIEW_CONFLICT: "검토본이 변경되었습니다. 다시 읽은 뒤 저장해 주세요.",
  NOT_MEETING_STARTER: "회의 시작자만 조작할 수 있습니다.",
  NOTE_NOT_FOUND: "노트를 찾을 수 없습니다.",
};
const STATUS: Record<string, number> = {
  MEETING_REVIEW_NOT_FOUND: 404,
  NOT_FOUND: 404,
  NOT_MEETING_STARTER: 403,
};

const reviews = new Map<string, MeetingReviewResponseData>();
let counter = 0;
const nextId = () => `01KR${String((counter += 1)).padStart(9, "0")}`;

function item(
  over: Partial<ReviewItem> & Pick<ReviewItem, "kind" | "content">,
  ...segmentIds: string[]
): ReviewItem {
  return {
    itemId: nextId(),
    revision: 1,
    included: true,
    edited: false,
    originalProposalRef: { proposalId: nextId(), revision: 1 },
    authoredByUserId: null,
    assigneeText: null,
    dueText: null,
    citations: segmentIds.map((segmentId) => ({ role: "SUPPORTS", segmentId })),
    ...over,
  };
}

/** 전사 줄 ID는 `db.ts`의 노트 `01K0000000020` 세그먼트(`…61`~`…66`)다. */
function seed(noteId: string): MeetingReviewResponseData | undefined {
  if (noteId === REVIEW_NOTE_ID) {
    return {
      reviewId: nextId(),
      noteId,
      reviewVersion: 1,
      items: [
        item({ kind: "AGENDA", content: "온보딩 이탈 구간 점검" }, "01K0000000061"),
        item(
          { kind: "DECISION", content: "첫 화면에서 회의 만들기를 가장 눈에 띄는 자리로 올린다" },
          "01K0000000063",
          "01K0000000066"
        ),
        item(
          {
            kind: "ACTION_ITEM",
            content: "회의를 아직 안 만든 사람에게 예시 회의를 하나 깔아 둔다",
            assigneeText: "한지원",
            dueText: "이번 스프린트",
          },
          "01K0000000066"
        ),
        item(
          { kind: "ACTION_ITEM", content: "온보딩 문구 개편안을 준비한다", included: false, edited: true },
          "01K0000000066"
        ),
        item(
          { kind: "ISSUE", content: "가입 후 첫 회의를 만들기까지의 이탈이 가장 크다" },
          "01K0000000061",
          "01K0000000065"
        ),
        item({
          kind: "QUESTION",
          content: "재방문 사용자도 같은 구간에서 막히는가",
          originalProposalRef: null,
          authoredByUserId: MOCK_USER.userId,
        }),
        item(
          { kind: "INSIGHT", content: "문구가 아니라 다음에 할 일이 보이지 않는 것이 원인이다" },
          "01K0000000062"
        ),
      ],
    };
  }
  if (noteId === REVIEW_OTHER_STARTER_NOTE_ID) {
    return {
      reviewId: nextId(),
      noteId,
      reviewVersion: 1,
      items: [
        item({ kind: "AGENDA", content: "알림 정책 2차 논의" }),
        item({ kind: "DECISION", content: "알림은 기본값을 끄고 설정에서 켜는 쪽으로 좁힌다" }),
      ],
    };
  }
  return undefined;
}

function reviewOf(noteId: string) {
  let review = reviews.get(noteId);
  if (!review) {
    review = seed(noteId);
    if (review) reviews.set(noteId, review);
  }
  return review;
}

function ok(review: MeetingReviewResponseData, status = 200) {
  return HttpResponse.json(
    { success: true, data: structuredClone(review), error: null },
    { status }
  );
}

function reject(code: string) {
  return HttpResponse.json(
    { success: false, data: null, error: { code, message: MESSAGES[code] ?? code, details: null } },
    { status: STATUS[code] ?? 409 }
  );
}

/** 생성·추가·편집은 회의 시작자만. 목 유저가 시작자가 아니면 계약대로 403이다. */
function starterGate(noteId: string) {
  const note = mockDb.getNote(noteId);
  return note.meetingStartedBy?.userId === MOCK_USER.userId ? null : reject("NOT_MEETING_STARTER");
}

const id = (value: string | readonly string[] | undefined) =>
  Array.isArray(value) ? value[0] : ((value as string | undefined) ?? "");

export const meetingReviewHandlers = [
  http.get("*/v1/notes/:noteId/meeting-review", ({ params }) => {
    const review = reviewOf(id(params.noteId));
    return review ? ok(review) : reject("MEETING_REVIEW_NOT_FOUND");
  }),

  http.post("*/v1/notes/:noteId/meeting-review", ({ params }) => {
    const noteId = id(params.noteId);
    const gate = starterGate(noteId);
    if (gate) return gate;
    if (reviewOf(noteId)) return reject("MEETING_REVIEW_CONFLICT");
    // 원본 명제가 없는 노트다. 검토본은 비어 있고 사람이 항목을 더한다.
    const review: MeetingReviewResponseData = { reviewId: nextId(), noteId, reviewVersion: 1, items: [] };
    reviews.set(noteId, review);
    return ok(review);
  }),

  http.post("*/v1/notes/:noteId/meeting-review/items", async ({ params, request }) => {
    const noteId = id(params.noteId);
    const gate = starterGate(noteId);
    if (gate) return gate;
    const review = reviewOf(noteId);
    if (!review) return reject("MEETING_REVIEW_NOT_FOUND");
    const body = (await request.json()) as AddMeetingReviewItemRequest;
    if (body.expectedReviewVersion !== review.reviewVersion) return reject("MEETING_REVIEW_CONFLICT");
    review.items.push(
      item({
        kind: body.kind,
        content: body.content,
        originalProposalRef: null,
        authoredByUserId: MOCK_USER.userId,
        assigneeText: body.assigneeText ?? null,
        dueText: body.dueText ?? null,
        citations: body.citations ?? [],
      })
    );
    review.reviewVersion += 1;
    return ok(review, 201);
  }),

  http.patch("*/v1/notes/:noteId/meeting-review/items/:itemId", async ({ params, request }) => {
    const noteId = id(params.noteId);
    const gate = starterGate(noteId);
    if (gate) return gate;
    const review = reviewOf(noteId);
    const target = review?.items.find((row) => row.itemId === id(params.itemId));
    if (!review || !target) return reject("MEETING_REVIEW_NOT_FOUND");
    const body = (await request.json()) as UpdateMeetingReviewItemRequest;
    if (
      body.expectedReviewVersion !== review.reviewVersion ||
      body.expectedItemRevision !== target.revision
    ) {
      return reject("MEETING_REVIEW_CONFLICT");
    }
    if (body.content !== undefined) {
      target.content = body.content;
      target.edited = true;
    }
    if (body.included !== undefined) target.included = body.included;
    if (body.assigneeText !== undefined) target.assigneeText = body.assigneeText;
    if (body.dueText !== undefined) target.dueText = body.dueText;
    target.revision += 1;
    review.reviewVersion += 1;
    return ok(review);
  }),
];
