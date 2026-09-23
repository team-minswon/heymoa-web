import { http } from "msw";

import type {
  AddMeetingReviewItemRequest,
  MeetingAnalysisFlowResponseDataStatus,
  MeetingApprovalRequest,
  MeetingApprovalResponseData,
  MeetingReviewResponseData,
  MeetingReviewResponseDataItemsItem,
  NoteAgendaRequest,
  NoteAgendaResponseData,
  ProposalRevision,
  TranscriptResponseDataSegmentsItem,
  UpdateMeetingReviewItemRequest,
} from "@/lib/api/generated/models";
import {
  assigneeFromRequest,
  resolveAssignee,
  workspaceOfProject,
  type StoredAssignee,
} from "@/lib/mocks/assignees";
import { mockDb } from "@/lib/mocks/db";
import { MENTORING_NOTE_ID } from "@/lib/mocks/fixtures/mentoring-note";
import {
  REVIEW_SEED_HEADLINE,
  REVIEW_SEED_LEAD,
  REVIEW_SEED_LOOSE,
  REVIEW_SEED_TOPICS,
  type SeedItem,
  type SeedWho,
} from "@/lib/mocks/fixtures/meeting-review-seed";
import { failWith, paramId, respond } from "@/lib/mocks/mock-envelope";
import { projectTasks } from "@/lib/mocks/project-tasks";
import type {
  MeetingReviewSummary,
  SummaryRelation,
  SummaryTopic,
} from "@/lib/notes/review/summary";

type FlowStatus = MeetingAnalysisFlowResponseDataStatus;
type ReviewItem = MeetingReviewResponseDataItemsItem;
type Kind = ReviewItem["kind"];

type StoredTaskChange = Omit<ReviewItem["taskChanges"][number], "assignee"> & {
  assignee: { value: StoredAssignee | null } | null;
};

type StoredItem = Omit<ReviewItem, "assignee" | "taskChanges"> & {
  assignee: StoredAssignee | null;
  taskChanges: StoredTaskChange[];
};

type StoredReview = {
  reviewId: string;
  noteId: string;
  reviewVersion: number;
  items: StoredItem[];
};

type State = {
  flows: Map<string, FlowStatus>;
  reviews: Map<string, StoredReview>;
  summaries: Map<string, MeetingReviewSummary>;
  revisions: Map<string, ProposalRevision[]>;
  approvals: Map<string, { body: string; response: MeetingApprovalResponseData }>;
  agendas: Map<string, NoteAgendaResponseData[]>;
  /** 목에는 콜백을 밀어 줄 주체가 없어, 도는 단계는 시간이 지나면 스스로 다음으로 넘어간다. */
  runningSince: Map<string, number>;
};

/** 화자 분리 → 분석 → 검토 가능이 목에서 각각 이만큼 걸린다. 화면의 진행 표시를 볼 만큼만 둔다. */
export const MOCK_STEP_MS = 6_000;

/** 흐름 상태 표본. 종료된 시드 노트마다 한 상태씩 둬서 요약 탭의 모든 갈래를 목에서 밟는다. */
const SEEDED_FLOWS: Record<string, FlowStatus> = {
  "01K0000000020": "NOT_APPLICABLE",
  "01K0000000021": "REVIEWABLE",
  "01K0000000022": "ANALYZING",
  "01K0000000023": "NOT_REQUESTED",
  "01K0000000024": "CONFIRMED",
  "01K0000000025": "DIARIZING",
  "01K0000000026": "ANALYSIS_FAILED",
  [MENTORING_NOTE_ID]: "REVIEWABLE",
};

const MEETING_DATE = Date.UTC(2026, 8, 11);
/** 대체 제안이 끝내자는 이전 결정을 확정한 회의 */
const PREVIOUS_NOTE_ID = "01K0000000024";
const dueAfterMeeting = (days: number) =>
  new Date(MEETING_DATE + days * 86_400_000).toISOString().slice(0, 10);

let state: State | null = null;
let counter = 0;
mockDb.onReset(() => {
  state = null;
  counter = 0;
});

const nextId = (prefix: string) =>
  `${prefix}${String((counter += 1)).padStart(13 - prefix.length, "0")}`;

const CONFLICT = [
  "MEETING_REVIEW_CONFLICT",
  409,
  "검토본이 변경되었습니다. 다시 읽은 뒤 저장해 주세요.",
] as const;
const BAD_REQUEST = ["BAD_REQUEST", 400, "잘못된 요청입니다."] as const;
const ASSIGNABLE_KINDS: ReadonlySet<Kind> = new Set<Kind>(["ACTION_ITEM", "ISSUE", "QUESTION"]);

function store(): State {
  if (state) return state;
  state = {
    flows: new Map(Object.entries(SEEDED_FLOWS)),
    reviews: new Map(),
    summaries: new Map(),
    revisions: new Map(),
    approvals: new Map(),
    runningSince: new Map(
      Object.entries(SEEDED_FLOWS)
        .filter(([, status]) => status === "DIARIZING" || status === "ANALYZING")
        .map(([noteId]) => [noteId, Date.now()])
    ),
    agendas: new Map([
      [
        "01K0000000002",
        [
          {
            agendaId: nextId("01KG"),
            noteId: "01K0000000002",
            content: "지난주 배포 뒤 남은 문제 확인",
            createdBy: mockDb.getCurrentUser().userId,
            createdAt: "2026-07-10T23:50:00Z",
            updatedAt: "2026-07-10T23:50:00Z",
          } as NoteAgendaResponseData,
        ],
      ],
    ]),
  };
  seedMentoringReview(state);
  seedSmallReview(state, "01K0000000021", false);
  seedSmallReview(state, "01K0000000024", true);
  return state;
}

function who(noteId: string, value: SeedWho | null | undefined): StoredAssignee | null {
  if (!value) return null;
  if (value === "me") return { type: "USER", id: mockDb.getCurrentUser().userId };
  return { type: "SPEAKER_LABEL", noteId, label: value };
}

function seedMentoringReview(target: State) {
  const noteId = MENTORING_NOTE_ID;
  const segments = mockDb.listSegments(noteId);
  const segment = (at: number) => segments[Math.min(at, segments.length - 1)];
  const review: StoredReview = { reviewId: nextId("01KR"), noteId, reviewVersion: 1, items: [] };

  const build = (seed: SeedItem): StoredItem => {
    const proposalId = nextId("01KP");
    const steps = [
      { operation: "CREATE" as const, at: seed.at[0], content: seed.content, role: "SUPPORTS" as const },
      ...(seed.history ?? []),
    ];
    let content = seed.content;
    const revisions = steps.map((step, index): ProposalRevision => {
      if (step.operation === "AMEND" || step.operation === "CORRECT") content = step.content;
      const cited = index === 0 ? seed.at : [step.at];
      return {
        proposalId,
        revision: index + 1,
        operation: step.operation,
        kind: seed.kind,
        status: step.operation === "RESOLVE" || step.operation === "RETRACT" ? "CLOSED" : "OPEN",
        closeReason:
          step.operation === "RESOLVE" ? "RESOLVED" : step.operation === "RETRACT" ? "RETRACTED" : null,
        revisionSource: "LIVE",
        content,
        createdSequence: segment(seed.at[0]).sequence,
        lastEvidenceSequence: segment(step.at).sequence,
        aiSemanticRevisionCount: index,
        resolvesProposalId: null,
        citations: cited.map((at) => citationOf(segment(at), step.role ?? "SUPPORTS")),
        // 상태·닫힌 이유·종류 조합은 위에서 계약 행렬대로 골랐다. 생성 타입은 그 조합을 합집합으로 나눈다.
      } as ProposalRevision;
    });
    target.revisions.set(proposalId, revisions);
    const last = revisions[revisions.length - 1];
    return {
      itemId: nextId("01KI"),
      revision: 1,
      kind: seed.kind,
      content: last.content,
      included: !seed.excluded,
      edited: false,
      authoredByUserId: null,
      originalProposalRef: { proposalId, revision: last.revision },
      citations: revisions.flatMap((row) =>
        row.citations.map(({ segmentId, role }) => ({ segmentId, role }))
      ),
      assignee: who(noteId, seed.who),
      due: seed.dueIn === undefined ? null : dueAfterMeeting(seed.dueIn),
      replacements: seed.replaces
        ? [
            {
              // 끝낼 이전 결정은 지난 회의가 확정한 노드다. 목에서는 확정된 표본 노트를 출처로 둔다.
              target: {
                itemId: nextId("01KN"),
                revision: 1,
                kind: "DECISION",
                content: seed.replaces.content,
                noteId: PREVIOUS_NOTE_ID,
                noteTitle: mockDb.getNote(PREVIOUS_NOTE_ID).title,
                approvedAt: new Date(MEETING_DATE - 7 * 86_400_000).toISOString(),
                // 이 회의를 검토하는 사이 다른 회의의 확정이 먼저 끝낸 결정
                endedAt: seed.replaces.endedElsewhere ? new Date(MEETING_DATE - 86_400_000).toISOString() : null,
              },
              kind: "SUPERSEDES",
              label: "대체",
              reason: seed.replaces.reason,
              decision: seed.replaces.decision ?? null,
            },
          ]
        : [],
      taskChanges: seed.changesTask
        ? [
            (() => {
              const change = seed.changesTask;
              const taskId = projectTasks.idOf(change.task);
              return {
                target: { itemId: taskId, revision: projectTasks.revisionOf(taskId) },
                status: change.status ?? null,
                assignee: change.who === undefined ? null : { value: who(noteId, change.who) },
                due:
                  change.dueIn === undefined
                    ? null
                    : { value: change.dueIn === null ? null : dueAfterMeeting(change.dueIn) },
                reason: change.reason,
                decision: change.decision ?? null,
              };
            })(),
          ]
        : [],
    };
  };

  const topicItems = REVIEW_SEED_TOPICS.map((topic) => topic.items.map(build));
  const looseItems = REVIEW_SEED_LOOSE.map(build);
  review.items = [...topicItems.flat(), ...looseItems];

  // 사람이 고친 항목과 사람이 더한 항목. 원본과 다른 모양이 목에 하나씩은 있어야 한다.
  const edited = topicItems[1][3];
  edited.content = "무료 구간은 월 5시간으로 두고 팀 요금제에서는 뺀다";
  edited.edited = true;
  edited.revision = 2;
  review.reviewVersion = 2;
  review.items.push({
    itemId: nextId("01KI"),
    revision: 1,
    kind: "QUESTION",
    content: "발표 순서를 다시 정해야 하나",
    included: true,
    edited: false,
    authoredByUserId: mockDb.getCurrentUser().userId,
    originalProposalRef: null,
    citations: [],
    assignee: null,
    due: null,
    replacements: [],
    taskChanges: [],
  });

  target.reviews.set(noteId, review);
  target.summaries.set(noteId, buildSummary(noteId, topicItems, segment));
}

function citationOf(
  row: TranscriptResponseDataSegmentsItem,
  role: ProposalRevision["citations"][number]["role"]
) {
  return {
    segmentId: row.segmentId,
    sequence: row.sequence,
    startedAtMs: row.startedAtMs,
    endedAtMs: row.endedAtMs,
    text: row.text,
    role,
  };
}

function buildSummary(
  noteId: string,
  topicItems: StoredItem[][],
  segment: (at: number) => TranscriptResponseDataSegmentsItem
): MeetingReviewSummary {
  const topics = REVIEW_SEED_TOPICS.map((seed, index): SummaryTopic => {
    const items = topicItems[index];
    const ids = items.map((item) => item.itemId);
    const ofKind = (...kinds: Kind[]) => items.filter((item) => kinds.includes(item.kind));
    const agendaItemId = seed.hasAgenda ? ids[0] : null;
    const decisions = ofKind("DECISION");
    const actions = ofKind("ACTION_ITEM");
    const insights = ofKind("INSIGHT");
    const reports = ofKind("STATUS_REPORT");
    const isQuestion = (item: StoredItem) => item.kind === "ISSUE" || item.kind === "QUESTION";
    const wasResolved = (at: number) =>
      Boolean(seed.items[at].history?.some((step) => step.operation === "RESOLVE"));
    const open = items.filter((item, at) => isQuestion(item) && !wasResolved(at));
    const resolved = items.filter((item, at) => isQuestion(item) && wasResolved(at));
    const centerItemId = seed.centerless ? null : (agendaItemId ?? decisions[0]?.itemId ?? ids[0]);
    const evidenceOf = (item: StoredItem) => item.citations.slice(0, 1).map((row) => row.segmentId);
    const relation = (
      source: StoredItem,
      targetItem: StoredItem,
      kind: string,
      label: string
    ): SummaryRelation => ({
      sourceItemId: source.itemId,
      targetItemId: targetItem.itemId,
      kind,
      label,
      reason: `${label}: ${targetItem.content}`,
      judgment: "PROPOSED",
      evidence: evidenceOf(targetItem),
    });
    const center = items.find((item) => item.itemId === centerItemId);
    // 중심이 없는 주제는 「주제」 관계를 두지 않는다. 양 끝이 없거나 같은 관계도 뺀다.
    const link = (source: StoredItem | undefined, targetItem: StoredItem | undefined, kind: string, label: string) =>
      source && targetItem && source !== targetItem ? [relation(source, targetItem, kind, label)] : [];
    const relations = [
      ...items
        .filter((item) => item.kind !== "INSIGHT" && item.kind !== "STATUS_REPORT")
        .flatMap((item) => link(center, item, "ABOUT", "주제")),
      ...actions.flatMap((action, at) =>
        link(decisions[at % Math.max(decisions.length, 1)] ?? center, action, "LEADS_TO", "후속 할 일")
      ),
      ...insights.flatMap((insight) => link(insight, decisions[0] ?? center, "SUPPORTS", "근거")),
      ...reports.flatMap((report, at) =>
        link(report, actions[at % Math.max(actions.length, 1)] ?? center, "PROGRESS", "진행 상황")
      ),
      ...resolved.flatMap((item) => link(decisions[0] ?? center, item, "RESOLVES", "해결")),
    ];
    return {
      ordinal: index + 1,
      title: seed.title,
      agendaItemId,
      centerItemId,
      members: items.map((item, at) => ({
        itemId: item.itemId,
        kind: item.kind,
        uncertain: index === 5 && at === items.length - 1,
      })),
      alsoItemIds: index === 5 ? [topicItems[0][3].itemId] : [],
      relations,
      sentences: seed.sentences.map((sentence) => ({
        text: sentence.text,
        itemIds: sentence.items.map((at) => ids[at]),
        relations: relations
          .filter((row) => sentence.items.some((at) => row.targetItemId === ids[at]))
          .slice(0, 2)
          .map(({ sourceItemId, targetItemId, kind }) => ({ sourceItemId, targetItemId, kind })),
      })),
      outline: {
        decisions: decisions.map((row) => ({
          itemId: row.itemId,
          insightItemIds: row === decisions[0] ? insights.map((i) => i.itemId) : [],
        })),
        actionItems: actions.map((row, at) => ({
          itemId: row.itemId,
          progressItemIds: reports.filter((_, r) => r % Math.max(actions.length, 1) === at).map((r) => r.itemId),
        })),
        // 열린 이슈는 풀어 준 항목이 없고, 회의 중에 풀린 이슈는 그 주제의 결정이 풀었다.
        issues: [...open, ...resolved].map((row) => ({
          itemId: row.itemId,
          backgroundItemIds: [],
          resolvedByItemIds: resolved.includes(row) ? decisions.slice(0, 1).map((d) => d.itemId) : [],
        })),
        observationItemIds: actions.length === 0 ? reports.map((r) => r.itemId) : [],
      },
      openItemIds: open.map((row) => row.itemId),
      signals: {
        itemCount: items.length,
        conclusionCount: decisions.length + actions.length,
        openCount: open.length,
        agendaSequence: seed.hasAgenda ? segment(seed.items[0].at[0]).sequence : null,
      },
    };
  });
  return {
    noteId,
    status: "SUCCEEDED",
    resultVersion: nextId("01KV"),
    headline: { text: REVIEW_SEED_HEADLINE, topics: [1, 6] },
    lead: REVIEW_SEED_LEAD,
    topics,
  };
}

/** 전사가 없는 노트의 작은 검토본. 요약은 실패로 두어 요약 없는 화면의 표본이 된다. */
function seedSmallReview(target: State, noteId: string, confirmed: boolean) {
  const item = (kind: Kind, content: string, over: Partial<StoredItem> = {}): StoredItem => ({
    itemId: nextId("01KI"),
    revision: 1,
    kind,
    content,
    included: true,
    edited: false,
    authoredByUserId: null,
    originalProposalRef: { proposalId: nextId("01KP"), revision: 1 },
    citations: [],
    assignee: null,
    due: null,
    replacements: [],
    taskChanges: [],
    ...over,
  });
  target.reviews.set(noteId, {
    reviewId: nextId("01KR"),
    noteId,
    reviewVersion: 1,
    items: [
      item("AGENDA", "알림 정책 2차 논의"),
      item("DECISION", "알림은 기본값을 끄고 설정에서 켜는 쪽으로 좁힌다"),
      item("ACTION_ITEM", "알림 설정 화면 시안을 만든다", {
        assignee: { type: "USER", id: "01K0000000020" },
        due: dueAfterMeeting(6),
      }),
      item("QUESTION", "메일 알림도 같은 기본값을 따르나"),
    ],
  });
  target.summaries.set(noteId, {
    noteId,
    status: confirmed ? "NOT_AVAILABLE" : "FAILED",
    resultVersion: null,
    headline: null,
    lead: [],
    topics: [],
  });
}

function flowOf(noteId: string): FlowStatus {
  mockDb.getNote(noteId);
  const target = store();
  const status = target.flows.get(noteId) ?? "NOT_REQUESTED";
  const since = target.runningSince.get(noteId);
  if (since === undefined || Date.now() - since < MOCK_STEP_MS) return status;
  if (status === "DIARIZING") {
    startAnalysis(noteId);
    return "ANALYZING";
  }
  if (status === "ANALYZING") {
    completeAnalysis(noteId);
    return target.flows.get(noteId) ?? status;
  }
  return status;
}

function startAnalysis(noteId: string) {
  const target = store();
  target.flows.set(noteId, "ANALYZING");
  target.runningSince.set(noteId, Date.now());
}

function reviewOf(noteId: string) {
  mockDb.getNote(noteId);
  return (
    store().reviews.get(noteId) ??
    failWith("MEETING_REVIEW_NOT_FOUND", 404, "검토본 또는 항목을 찾을 수 없습니다.")
  );
}

function view(review: StoredReview): MeetingReviewResponseData {
  const workspaceId = workspaceOfProject(mockDb.getNote(review.noteId).projectId);
  return structuredClone({
    reviewId: review.reviewId,
    noteId: review.noteId,
    reviewVersion: review.reviewVersion,
    items: review.items.map((item) => ({
      ...item,
      assignee: resolveAssignee(workspaceId, item.assignee),
      taskChanges: item.taskChanges.map((change) => ({
        ...change,
        assignee: change.assignee && {
          value: resolveAssignee(workspaceId, change.assignee.value),
        },
      })),
    })),
  });
}

function editableReview(noteId: string, expectedReviewVersion: number) {
  const review = reviewOf(noteId);
  if (flowOf(noteId) !== "REVIEWABLE" || expectedReviewVersion !== review.reviewVersion) {
    failWith(...CONFLICT);
  }
  return review;
}

function checkAssignable(kind: Kind, assignee: unknown, due: unknown) {
  if (!ASSIGNABLE_KINDS.has(kind) && (assignee != null || due != null)) failWith(...BAD_REQUEST);
}

/** 확정된 회의의 검토본을 새 회의 분석으로 만든다. 목에는 콜백을 밀어 줄 주체가 없어 개발 화면이 부른다. */
function completeAnalysis(noteId: string) {
  const target = store();
  if (target.flows.get(noteId) !== "ANALYZING") return;
  target.runningSince.delete(noteId);
  const segments = mockDb.listSegments(noteId);
  target.reviews.set(noteId, {
    reviewId: nextId("01KR"),
    noteId,
    reviewVersion: 1,
    items: REVIEW_SEED_TOPICS[0].items.map((seed) => ({
      itemId: nextId("01KI"),
      revision: 1,
      kind: seed.kind,
      content: seed.content,
      included: true,
      edited: false,
      authoredByUserId: null,
      originalProposalRef: { proposalId: nextId("01KP"), revision: 1 },
      citations: segments.slice(0, 1).map((row) => ({ segmentId: row.segmentId, role: "SUPPORTS" })),
      assignee: seed.kind === "ACTION_ITEM" && seed.who === "me" ? who(noteId, "me") : null,
      due: seed.kind === "ACTION_ITEM" && seed.dueIn !== undefined ? dueAfterMeeting(seed.dueIn) : null,
      replacements: [],
      taskChanges: [],
    })),
  });
  target.summaries.set(noteId, {
    noteId,
    status: "NOT_AVAILABLE",
    resultVersion: null,
    headline: null,
    lead: [],
    topics: [],
  });
  target.flows.set(noteId, "REVIEWABLE");
}

export const meetingFlow = {
  onMeetingEnded(noteId: string) {
    startAnalysis(noteId);
  },
  completeAnalysis,
  summaryOf(noteId: string): MeetingReviewSummary {
    mockDb.getNote(noteId);
    return (
      store().summaries.get(noteId) ?? {
        noteId,
        status: "NOT_AVAILABLE",
        resultVersion: null,
        headline: null,
        lead: [],
        topics: [],
      }
    );
  },
  /** 표본을 만드는 테스트가 계약 경로의 인자를 고를 때 쓴다. */
  proposalIds() {
    return [...store().revisions.keys()];
  },
};

export const meetingFlowHandlers = [
  http.get("*/v1/notes/:noteId/analyses/flow", ({ params }) =>
    respond(() => ({ noteId: paramId(params.noteId), status: flowOf(paramId(params.noteId)) }))
  ),

  http.post("*/v1/notes/:noteId/analyses", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      mockDb.getNote(noteId);
      const status = flowOf(noteId);
      if (status !== "ANALYSIS_FAILED" && status !== "NOT_REQUESTED") {
        failWith("MEETING_ANALYSIS_CONFLICT", 409, "저장된 분석 요청 또는 결과와 일치하지 않습니다.");
      }
      startAnalysis(noteId);
      return { noteId, requestId: nextId("01KQ") };
    }, 202)
  ),

  http.get("*/v1/notes/:noteId/meeting-review/summary", ({ params }) =>
    respond(() => meetingFlow.summaryOf(paramId(params.noteId)))
  ),

  http.get("*/v1/notes/:noteId/meeting-review", ({ params }) =>
    respond(() => view(reviewOf(paramId(params.noteId))))
  ),

  http.post("*/v1/notes/:noteId/meeting-review/items", async ({ params, request }) =>
    respond(async () => {
      const noteId = paramId(params.noteId);
      const body = (await request.json()) as AddMeetingReviewItemRequest;
      const review = editableReview(noteId, body.expectedReviewVersion);
      if (!body.content?.trim()) failWith(...BAD_REQUEST);
      checkAssignable(body.kind, body.assignee, body.due);
      review.items.push({
        itemId: nextId("01KI"),
        revision: 1,
        kind: body.kind,
        content: body.content,
        included: true,
        edited: false,
        authoredByUserId: mockDb.getCurrentUser().userId,
        originalProposalRef: null,
        citations: body.citations ?? [],
        assignee: assigneeFromRequest(body.assignee, noteId),
        due: body.due ?? null,
        replacements: [],
        taskChanges: [],
      });
      review.reviewVersion += 1;
      return view(review);
    }, 201)
  ),

  http.patch("*/v1/notes/:noteId/meeting-review/items/:itemId", async ({ params, request }) =>
    respond(async () => {
      const noteId = paramId(params.noteId);
      const body = (await request.json()) as UpdateMeetingReviewItemRequest;
      const review = editableReview(noteId, body.expectedReviewVersion);
      const item =
        review.items.find((row) => row.itemId === paramId(params.itemId)) ??
        failWith("MEETING_REVIEW_NOT_FOUND", 404, "검토본 또는 항목을 찾을 수 없습니다.");
      if (body.expectedItemRevision !== item.revision) failWith(...CONFLICT);
      if (body.included === null || (body.content !== undefined && !body.content?.trim())) {
        failWith(...BAD_REQUEST);
      }
      checkAssignable(item.kind, body.assignee, body.due);
      let changed = false;
      if (body.content !== undefined && body.content !== item.content) {
        item.content = body.content;
        item.edited = true;
        changed = true;
      }
      if (body.included !== undefined && body.included !== item.included) {
        item.included = body.included;
        changed = true;
      }
      if (body.assignee !== undefined) {
        item.assignee = assigneeFromRequest(body.assignee, noteId);
        changed = true;
      }
      if (body.due !== undefined && body.due !== item.due) {
        item.due = body.due;
        changed = true;
      }
      // 제안의 선택. 대체는 END · KEEP, 할 일 변경은 APPLIED · KEEP 이고, 그 항목의 제안에 없는 대상은 거절한다.
      for (const { targetId, decision } of body.decisions ?? []) {
        const replacement = item.replacements.find((row) => row.target.itemId === targetId);
        const taskChange = item.taskChanges.find((row) => row.target.itemId === targetId);
        if (replacement && decision !== "APPLIED") {
          changed ||= replacement.decision !== decision;
          replacement.decision = decision;
        } else if (taskChange && decision !== "END") {
          changed ||= taskChange.decision !== decision;
          taskChange.decision = decision;
        } else {
          failWith("DECISION_TARGET_UNKNOWN", 400, "제안에 없는 대상이거나 고를 수 없는 값입니다.");
        }
      }
      if (changed) {
        item.revision += 1;
        review.reviewVersion += 1;
      }
      return view(review);
    })
  ),

  http.post("*/v1/notes/:noteId/approval", async ({ params, request }) =>
    respond(async () => {
      const noteId = paramId(params.noteId);
      const note = mockDb.getNote(noteId);
      const body = (await request.json()) as MeetingApprovalRequest;
      const target = store();
      const saved = target.approvals.get(noteId);
      if (saved) {
        if (saved.body === JSON.stringify(body)) return saved.response;
        failWith("PROJECT_KNOWLEDGE_CONFLICT", 409, "프로젝트 승인 기준이 변경되었습니다. 다시 조회해 주세요.");
      }
      const review = reviewOf(noteId);
      if (flowOf(noteId) !== "REVIEWABLE" || body.reviewId !== review.reviewId) failWith(...BAD_REQUEST);
      if (body.reviewRevision !== review.reviewVersion) {
        failWith("PROJECT_KNOWLEDGE_CONFLICT", 409, "프로젝트 승인 기준이 변경되었습니다. 다시 조회해 주세요.");
      }
      const included = review.items.filter((item) => item.included);
      // 포함 항목에 저장된 끝내기만 끝낸다. 다른 확정이 먼저 끝낸 노드는 건너뛴다.
      const endedAt = new Date().toISOString();
      for (const row of included.flatMap((item) => item.replacements)) {
        if (row.decision === "END" && row.target.endedAt === null) row.target.endedAt = endedAt;
      }

      const approvalId = nextId("01KA");
      const actions = included.filter((item) => item.kind === "ACTION_ITEM");
      const promoted = projectTasks.promote(
        note.projectId,
        actions.map(({ content, assignee, due }) => ({ content, assignee, due })),
        approvalId
      );
      const response: MeetingApprovalResponseData = {
        approvalVersion: 1,
        items: included.map((item) => ({
          review: { itemId: item.itemId, revision: item.revision },
          approved:
            item.kind === "ACTION_ITEM"
              ? promoted[actions.indexOf(item)]
              : { itemId: item.itemId, revision: item.revision },
        })),
        relationIds: [],
        evidenceIds: [...new Set(included.flatMap((item) => item.citations.map((c) => c.segmentId)))],
      };
      target.approvals.set(noteId, { body: JSON.stringify(body), response });
      target.flows.set(noteId, "CONFIRMED");
      return response;
    })
  ),

  // 검토 항목의 원본 명제 이력. 이 목이 만든 명제만 답하고, 나머지는 실시간 정리 목으로 넘긴다.
  http.get("*/v1/notes/:noteId/proposals/:proposalId/revisions", ({ params }) => {
    const revisions = store().revisions.get(paramId(params.proposalId));
    if (!revisions || paramId(params.noteId) !== MENTORING_NOTE_ID) return undefined;
    return respond(() => ({ proposalId: paramId(params.proposalId), revisions }));
  }),

  http.get("*/v1/notes/:noteId/agendas", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      mockDb.getNote(noteId);
      return { agendas: store().agendas.get(noteId) ?? [] };
    })
  ),

  http.post("*/v1/notes/:noteId/agendas", async ({ params, request }) =>
    respond(async () => {
      const noteId = paramId(params.noteId);
      if (mockDb.getNote(noteId).meetingStatus === "ENDED") {
        failWith("MEETING_ALREADY_ENDED", 409, "이미 종료된 회의입니다.");
      }
      const body = (await request.json()) as NoteAgendaRequest;
      if (!body.content?.trim()) failWith(...BAD_REQUEST);
      const now = new Date().toISOString();
      const agenda = {
        agendaId: nextId("01KG"),
        noteId,
        content: body.content,
        createdBy: mockDb.getCurrentUser().userId,
        createdAt: now,
        updatedAt: now,
      } as NoteAgendaResponseData;
      const list = store().agendas.get(noteId) ?? [];
      store().agendas.set(noteId, [...list, agenda]);
      return agenda;
    }, 201)
  ),

  http.put("*/v1/notes/:noteId/agendas/:agendaId", async ({ params, request }) =>
    respond(async () => {
      const list = store().agendas.get(paramId(params.noteId)) ?? [];
      const agenda =
        list.find((row) => row.agendaId === paramId(params.agendaId)) ??
        failWith("NOT_FOUND", 404, "존재하지 않는 리소스입니다.");
      const body = (await request.json()) as NoteAgendaRequest;
      if (!body.content?.trim()) failWith(...BAD_REQUEST);
      agenda.content = body.content;
      return agenda;
    })
  ),

  http.delete("*/v1/notes/:noteId/agendas/:agendaId", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      const list = store().agendas.get(noteId) ?? [];
      store().agendas.set(
        noteId,
        list.filter((row) => row.agendaId !== paramId(params.agendaId))
      );
    }, 204)
  ),

  http.post("*/v1/notes/:noteId/_mock/advance-analysis", ({ params }) =>
    respond(() => completeAnalysis(paramId(params.noteId)), 204)
  ),
];
