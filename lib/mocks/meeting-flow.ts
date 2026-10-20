import { PROJECT_APPROVAL_CASES, type ProjectApprovalCase } from "@/lib/mocks/fixtures/project-approval-cases";
import {
  isProjectIncluded,
  requiresProjectSelection,
} from "@/lib/notes/review/project-approval";
import { http } from "msw";

import type {
  AddMeetingReviewItemRequest,
  MeetingAnalysisFlowResponseDataStatus,
  MeetingApprovalRequest,
  MeetingApprovalResponseData,
  MeetingReviewResponseData,
  MeetingReviewResponseDataItemsItem,
  NoteAgendasResponseDataAgendasItem,
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
import {
  HELP_DEMO_ENDED_ITEMS,
  helpDemoReviewSets,
  isHelpDemoEnabled,
  type HelpDemoReviewSet,
} from "@/lib/mocks/help-demo";
import { MENTORING_NOTE_ID } from "@/lib/mocks/fixtures/mentoring-note";
import { LIVE_AGENDA_NOTE_ID, liveAgendaList } from "@/lib/mocks/live-agendas";
import {
  REVIEW_SEED_HEADLINE,
  REVIEW_SEED_LEAD,
  REVIEW_SEED_LOOSE,
  REVIEW_SEED_TOPICS,
  type SeedItem,
  type SeedTopic,
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
type TaskDraft = NonNullable<
  NonNullable<UpdateMeetingReviewItemRequest["decisions"]>[number]["taskChange"]
>;

type StoredTaskChange = Omit<
  ReviewItem["taskChanges"][number],
  "assignee" | "draft"
> & {
  assignee: { value: StoredAssignee | null } | null;
  draft: TaskDraft | null;
};

type StoredItem = Omit<ReviewItem, "assignee" | "taskChanges" | "decisions"> & {
  decisions: {
    targetId: string;
    decision: ReviewItem["decisions"][number]["decision"];
    taskChange: TaskDraft | null;
  }[];
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
  approvalCase?: ProjectApprovalCase;
  saveFaultUsed?: boolean;
  flows: Map<string, FlowStatus>;
  reviews: Map<string, StoredReview>;
  summaries: Map<string, MeetingReviewSummary>;
  revisions: Map<string, ProposalRevision[]>;
  approvals: Map<
    string,
    { body: string; response: MeetingApprovalResponseData }
  >;
  /** 노트 안건 정본(GET /agendas). 확정 일꾼이 없는 목이라 비어 있고, 검토 요약의 주제로 채워진다 */
  agendas: Map<string, NoteAgendasResponseDataAgendasItem[]>;
  /** 이 회의 → 지난 회의 연결 중 제안 카드와 같은 지난 명제를 가리키는 것. 화면에서는 카드에 가려진다 */
  pastLinks: PastLink[];
  /** 목에는 콜백을 밀어 줄 주체가 없어, 도는 단계는 시간이 지나면 스스로 다음으로 넘어간다. */
  runningSince: Map<string, number>;
};

/** 화자 분리 → 분석 → 검토 가능이 목에서 각각 이만큼 걸린다. 화면의 진행 표시를 볼 만큼만 둔다. */
export const MOCK_STEP_MS = 6_000;

/** 항목 317개 · 주제 21개 검토본을 가진 노트. 그래프가 실제 규모에서 어떻게 보이는지 여기서 본다. */
export const LARGE_REVIEW_NOTE_ID = "01K0000000027";

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
  [LARGE_REVIEW_NOTE_ID]: "REVIEWABLE",
};

const MEETING_DATE = Date.UTC(2026, 8, 11);
/** 대체 제안이 끝내자는 이전 결정을 확정한 회의 */
const PREVIOUS_NOTE_ID = "01K0000000024";
/** 멘토링 검토본 주제의 안건 ID. 회의 간 연결 목(주제 이어짐)이 같은 ID를 가리켜야 해서 고정한다 */
const MENTORING_AGENDA_IDS = Array.from(
  { length: 8 },
  (_, at) => `01KG${String(at + 1).padStart(9, "0")}`
);
/** 지난 회의(PREVIOUS_NOTE_ID)의 안건. 멘토링 01 · 06 주제가 여기서 이어진다 */
const PREVIOUS_AGENDAS = [
  { agendaId: "01KG100000001", title: "첫 화면 메시지" },
  { agendaId: "01KG100000002", title: "분석 범위" },
];

type PastLink = {
  kind: string;
  sourceProposalId: string;
  target: {
    proposalId: string;
    content: string;
    proposalKind: "DECISION" | "ACTION_ITEM";
  };
};

/** 제안 카드가 끝내자는 지난 명제를 만들고, 같은 명제를 가리키는 회의 간 연결을 남긴다 */
function pastProposal(
  target: State,
  sourceProposalId: string,
  kind: string,
  content: string,
  proposalKind: PastLink["target"]["proposalKind"]
) {
  const ref = { proposalId: nextId("01KP"), revision: 1 };
  target.pastLinks.push({
    kind,
    sourceProposalId,
    target: { proposalId: ref.proposalId, content, proposalKind },
  });
  return ref;
}

const dueAfterMeeting = (days: number, base = MEETING_DATE) =>
  new Date(base + days * 86_400_000).toISOString().slice(0, 10);

/** 검토본 시드 한 벌. 멘토링 노트가 기본이고, 가이드 캡처 프리셋은 회의마다 한 벌씩 더한다(help-demo). */
type ReviewSeedSet = {
  noteId: string;
  topics: SeedTopic[];
  loose: SeedItem[];
  headline: string;
  headlineTopics: number[];
  lead: Array<{ text: string; topics: number[] }>;
  agendaIds?: string[];
  /** 기한을 세는 기준 날짜 */
  meetingDate: number;
  /** 멘토링 시드에만 있는 손질(사람이 고친 항목 · 직접 더한 항목 · 다른 주제에도 속한 항목) */
  decorated: boolean;
};

const MENTORING_SET: ReviewSeedSet = {
  noteId: MENTORING_NOTE_ID,
  topics: REVIEW_SEED_TOPICS,
  loose: REVIEW_SEED_LOOSE,
  headline: REVIEW_SEED_HEADLINE,
  headlineTopics: [1, 6],
  lead: REVIEW_SEED_LEAD,
  agendaIds: MENTORING_AGENDA_IDS,
  meetingDate: MEETING_DATE,
  decorated: true,
};

const reviewSetOf = (set: HelpDemoReviewSet): ReviewSeedSet => ({
  ...set,
  decorated: false,
});

/** 검토본 시드가 있는 노트인가. 멘토링 노트이거나, 프리셋이 켜졌을 때 요약이 성공한 프리셋 회의다. */
const hasSeededReview = (noteId: string) =>
  noteId === MENTORING_NOTE_ID ||
  (isHelpDemoEnabled() &&
    store().summaries.get(noteId)?.status === "SUCCEEDED");

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
const CONFIRMED = [
  "MEETING_REVIEW_CONFIRMED",
  409,
  "확정된 검토본은 고칠 수 없습니다.",
] as const;
const BAD_REQUEST = ["BAD_REQUEST", 400, "잘못된 요청입니다."] as const;
const ASSIGNABLE_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  "ACTION_ITEM",
  "ISSUE",
  "QUESTION",
]);

function store(): State {
  if (state) return state;
  const demoSets = isHelpDemoEnabled() ? helpDemoReviewSets() : null;
  const seededFlows: Record<string, FlowStatus> = demoSets
    ? Object.fromEntries(demoSets.map((set) => [set.noteId, set.flow]))
    : SEEDED_FLOWS;
  state = {
    flows: new Map(Object.entries(seededFlows)),
    reviews: new Map(),
    summaries: new Map(),
    revisions: new Map(),
    approvals: new Map(),
    runningSince: new Map(
      Object.entries(seededFlows)
        .filter(
          ([, status]) => status === "DIARIZING" || status === "ANALYZING"
        )
        .map(([noteId]) => [noteId, Date.now()])
    ),
    agendas: new Map(),
    pastLinks: [],
  };
  if (demoSets) {
    for (const set of demoSets) seedMentoringReview(state, reviewSetOf(set));
    return state;
  }
  seedMentoringReview(state);
  seedSmallReview(state, "01K0000000021", false);
  seedSmallReview(state, "01K0000000024", true);
  seedLargeReview(state, LARGE_REVIEW_NOTE_ID);
  const requestedCase = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("reviewCase");
  const selectedCase = PROJECT_APPROVAL_CASES.find((row) => row.key === requestedCase);
  if (selectedCase) seedApprovalCase(state, selectedCase.key);
  return state;
}

function who(
  noteId: string,
  value: SeedWho | null | undefined
): StoredAssignee | null {
  if (!value) return null;
  if (value === "me")
    return { type: "USER", id: mockDb.getCurrentUser().userId };
  if (value.startsWith("user:")) return { type: "USER", id: value.slice(5) };
  return { type: "SPEAKER_LABEL", noteId, label: value };
}

function seedMentoringReview(
  target: State,
  set: ReviewSeedSet = MENTORING_SET
) {
  const { noteId } = set;
  const segments = mockDb.listSegments(noteId);
  const segment = (at: number) => segments[Math.min(at, segments.length - 1)];
  const review: StoredReview = {
    reviewId: nextId("01KR"),
    noteId,
    reviewVersion: 1,
    items: [],
  };

  // 담당이 없는 할 일에는 담당만 있는 제안과 기한만 있는 제안을 번갈아 둔다. nullable 양쪽 표본이다.
  let suggestions = 0;
  const suggest = (seed: SeedItem): StoredItem["suggestedAssignment"] => {
    if (seed.kind !== "ACTION_ITEM" || seed.who !== undefined) return null;
    suggestions += 1;
    if (suggestions % 2 === 1)
      return { due: dueAfterMeeting(5, set.meetingDate), assignee: null };
    const me = mockDb.getCurrentUser();
    return {
      due: null,
      assignee: { type: "USER", id: me.userId, name: me.name },
    };
  };

  const build = (seed: SeedItem): StoredItem => {
    const proposalId = nextId("01KP");
    const steps = [
      {
        operation: "CREATE" as const,
        at: seed.at[0],
        content: seed.content,
        role: "SUPPORTS" as const,
      },
      ...(seed.history ?? []),
    ];
    let content = seed.content;
    const revisions = steps.map((step, index): ProposalRevision => {
      if (step.operation === "AMEND" || step.operation === "CORRECT")
        content = step.content;
      const cited = index === 0 ? seed.at : [step.at];
      return {
        proposalId,
        revision: index + 1,
        operation: step.operation,
        kind: seed.kind,
        status:
          step.operation === "RESOLVE" || step.operation === "RETRACT"
            ? "CLOSED"
            : "OPEN",
        closeReason:
          step.operation === "RESOLVE"
            ? "RESOLVED"
            : step.operation === "RETRACT"
              ? "RETRACTED"
              : null,
        revisionSource: "LIVE",
        content,
        createdSequence: segment(seed.at[0]).sequence,
        lastEvidenceSequence: segment(step.at).sequence,
        aiSemanticRevisionCount: index,
        resolvesProposalId: null,
        citations: cited.map((at) =>
          citationOf(segment(at), step.role ?? "SUPPORTS")
        ),
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
      projectSelected: flowOf(noteId) === "CONFIRMED" && !seed.excluded,
      edited: false,
      authoredByUserId: null,
      originalProposalRef: { proposalId, revision: last.revision },
      citations: revisions.flatMap((row) =>
        row.citations.map(({ segmentId, role }) => ({ segmentId, role }))
      ),
      assignee: who(noteId, seed.who),
      due:
        seed.dueIn === undefined
          ? null
          : dueAfterMeeting(seed.dueIn, set.meetingDate),
      decisions: [],
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
                // 다른 회의가 먼저 끝낸 결정은 사람이 만든 항목이라 원래 명제가 없는 경우로 둔다
                originalProposalRef: seed.replaces.endedElsewhere
                  ? null
                  : pastProposal(
                      target,
                      proposalId,
                      "SUPERSEDES",
                      seed.replaces.content,
                      "DECISION"
                    ),
                approvedAt: new Date(
                  set.meetingDate - 7 * 86_400_000
                ).toISOString(),
                // 이 회의를 검토하는 사이 다른 회의의 확정이 먼저 끝낸 결정
                endedAt: seed.replaces.endedElsewhere
                  ? new Date(set.meetingDate - 86_400_000).toISOString()
                  : null,
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
                // 프로젝트 할 일은 공개 경로로도 생겨 원래 명제가 없을 수 있다 — 목에서는 없음으로 둔다
                target: {
                  itemId: taskId,
                  revision: projectTasks.revisionOf(taskId),
                  // 완료로 바꾸자는 할 일만 회의에서 나온 할 일이다 — 같은 할 일을 가리키는 「마침」 연결이 카드에 가려진다
                  originalProposalRef:
                    change.status === "COMPLETED"
                      ? pastProposal(
                          target,
                          proposalId,
                          "COMPLETES",
                          change.task,
                          "ACTION_ITEM"
                        )
                      : null,
                },
                status: change.status ?? null,
                assignee:
                  change.who === undefined
                    ? null
                    : { value: who(noteId, change.who) },
                due:
                  change.dueIn === undefined
                    ? null
                    : {
                        value:
                          change.dueIn === null
                            ? null
                            : dueAfterMeeting(change.dueIn, set.meetingDate),
                      },
                reason: change.reason,
                decision: change.decision ?? null,
                draft: null,
              };
            })(),
          ]
        : [],
      suggestedAssignment: suggest(seed),
    };
  };

  const topicItems = set.topics.map((topic) => topic.items.map(build));
  const looseItems = set.loose.map(build);
  review.items = [...topicItems.flat(), ...looseItems];
  for (const item of review.items) {
    item.decisions = [
      ...item.replacements.flatMap((row) =>
        row.decision
          ? [
              {
                targetId: row.target.itemId,
                decision: row.decision,
                taskChange: null,
              },
            ]
          : []
      ),
      ...item.taskChanges.flatMap((row) =>
        row.decision
          ? [
              {
                targetId: row.target.itemId,
                decision: row.decision,
                taskChange: null,
              },
            ]
          : []
      ),
    ];
  }

  if (set.decorated) {
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
      projectSelected: false,
      edited: false,
      authoredByUserId: mockDb.getCurrentUser().userId,
      originalProposalRef: null,
      citations: [],
      assignee: null,
      due: null,
      decisions: [],
      replacements: [],
      taskChanges: [],

      suggestedAssignment: null,
    });
  }

  target.reviews.set(noteId, review);
  target.summaries.set(noteId, buildSummary(set, topicItems));
}

function seedApprovalCase(target: State, key: ProjectApprovalCase) {
  target.approvalCase = key;
  const review = target.reviews.get(MENTORING_NOTE_ID)!;
  const decision = review.items.find((item) => item.replacements.some((row) => row.target.endedAt === null))!;
  const action = review.items.find((item) => item.taskChanges.length > 0)!;
  const select = (item: StoredItem) => { item.projectSelected = true; };
  const choose = (item: StoredItem, value: "END" | "KEEP") => {
    select(item);
    item.replacements[0].decision = value;
    item.decisions = [{ targetId: item.replacements[0].target.itemId, decision: value, taskChange: null }];
  };
  const chooseTask = (item: StoredItem, value: "APPLY" | "KEEP") => {
    select(item);
    const change = item.taskChanges[0];
    change.decision = value;
    change.draft = { expectedRevision: change.target.revision, status: change.status, assignee: change.assignee, due: change.due };
    item.decisions = [{ targetId: change.target.itemId, decision: value, taskChange: change.draft }];
  };
  if (key === "all-selected") {
    for (const item of review.items) if (item.included && requiresProjectSelection(item.kind)) select(item);
  } else if (key === "new-items" || key === "confirmed-mixed") {
    select(review.items.find((item) => item.kind === "DECISION" && !item.replacements.length)!);
    select(review.items.find((item) => item.kind === "ACTION_ITEM" && !item.taskChanges.length)!);
  } else if (key === "replace-pending") select(decision);
  else if (key === "replace" || key === "missing-choice") choose(decision, "END");
  else if (key === "keep") choose(decision, "KEEP");
  else if (key === "ended") select(review.items.find((item) => item.replacements.some((row) => row.target.endedAt !== null))!);
  else if (key === "task-pending" || key === "task-load-error") select(action);
  else if (key === "task-apply" || key === "stale-task" || key === "duplicate-task") chooseTask(action, "APPLY");
  else if (key === "task-keep") chooseTask(action, "KEEP");
  else if (key === "excluded") { decision.included = false; decision.projectSelected = false; }
  if (key === "missing-choice") decision.replacements = [];
  if (key === "stale-task") {
    action.taskChanges[0].target.revision -= 1;
    action.taskChanges[0].draft!.expectedRevision -= 1;
    action.decisions[0].taskChange = action.taskChanges[0].draft;
  }
  if (key === "duplicate-task") {
    const other = review.items.find((item) => item !== action && item.kind === "ACTION_ITEM")!;
    other.taskChanges = structuredClone(action.taskChanges);
    other.decisions = structuredClone(action.decisions);
    select(other);
  }
  if (key === "confirmed-mixed") target.flows.set(MENTORING_NOTE_ID, "CONFIRMED");
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
  set: ReviewSeedSet,
  topicItems: StoredItem[][]
): MeetingReviewSummary {
  const { noteId } = set;
  const topics = set.topics.map((seed, index): SummaryTopic => {
    const items = topicItems[index];
    const ids = items.map((item) => item.itemId);
    const ofKind = (...kinds: Kind[]) =>
      items.filter((item) => kinds.includes(item.kind));
    const agendaItemId = seed.hasAgenda ? ids[0] : null;
    const decisions = ofKind("DECISION");
    const actions = ofKind("ACTION_ITEM");
    const insights = ofKind("INSIGHT");
    const reports = ofKind("STATUS_REPORT");
    const isQuestion = (item: StoredItem) =>
      item.kind === "ISSUE" || item.kind === "QUESTION";
    const wasResolved = (at: number) =>
      Boolean(
        seed.items[at].history?.some((step) => step.operation === "RESOLVE")
      );
    const open = items.filter(
      (item, at) => isQuestion(item) && !wasResolved(at)
    );
    const resolved = items.filter(
      (item, at) => isQuestion(item) && wasResolved(at)
    );
    const centerItemId = seed.centerless
      ? null
      : (agendaItemId ?? decisions[0]?.itemId ?? ids[0]);
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
    });
    const center = items.find((item) => item.itemId === centerItemId);
    // 중심이 없는 주제는 「주제」 관계를 두지 않는다. 양 끝이 없거나 같은 관계도 뺀다.
    const link = (
      source: StoredItem | undefined,
      targetItem: StoredItem | undefined,
      kind: string,
      label: string
    ) =>
      source && targetItem && source !== targetItem
        ? [relation(source, targetItem, kind, label)]
        : [];
    const relations = [
      ...items
        .filter(
          (item) => item.kind !== "INSIGHT" && item.kind !== "STATUS_REPORT"
        )
        .flatMap((item) => link(center, item, "ABOUT", "주제")),
      ...actions.flatMap((action, at) =>
        link(
          decisions[at % Math.max(decisions.length, 1)] ?? center,
          action,
          "LEADS_TO",
          "후속 할 일"
        )
      ),
      ...insights.flatMap((insight) =>
        link(insight, decisions[0] ?? center, "SUPPORTS", "근거")
      ),
      ...reports.flatMap((report, at) =>
        link(
          report,
          actions[at % Math.max(actions.length, 1)] ?? center,
          "PROGRESS",
          "진행 상황"
        )
      ),
      ...resolved.flatMap((item) =>
        link(decisions[0] ?? center, item, "RESOLVES", "해결")
      ),
    ];
    // 다른 주제에도 속한 항목은 그 주제의 members 에도 든다(새 계약). 옛 칸 alsoItemIds 도 server ② 전까지 같이 낸다.
    const also = set.decorated && index === 5 ? [topicItems[0][3]] : [];
    return {
      ordinal: index + 1,
      title: seed.title,
      agendaItemId,
      centerItemId,
      members: [...items, ...also].map((item) => ({
        itemId: item.itemId,
        kind: item.kind,
      })),
      alsoItemIds: also.map((item) => item.itemId),
      relations,
      sentences: seed.sentences.map((sentence) => ({
        text: sentence.text,
        itemIds: sentence.items.map((at) => ids[at]),
        relations: relations
          .filter((row) =>
            sentence.items.some((at) => row.targetItemId === ids[at])
          )
          .slice(0, 2)
          .map(({ sourceItemId, targetItemId, kind }) => ({
            sourceItemId,
            targetItemId,
            kind,
          })),
      })),
      openItemIds: open.map((row) => row.itemId),
      agendaId: set.agendaIds?.[index] ?? nextId("01KG"),
      summary:
        seed.sentences.map((sentence) => sentence.text).join(" ") || null,
      completed: true,
      description: [],
      conclusions: [],
      openItems: [],
    };
  });
  return {
    noteId,
    status: "SUCCEEDED",
    resultVersion: nextId("01KV"),
    headline: { text: set.headline, topics: set.headlineTopics },
    lead: set.lead,
    topics,
    agendas: topics,
  };
}

/**
 * 큰 검토본. 주제 크기를 1~60 으로 고르지 않게 두고, 주제 안 관계 · 주제를 넘는 관계 ·
 * 「다른 주제에도 속함」을 섞는다. 무작위는 고정 씨앗이라 열 때마다 같다.
 */
function seedLargeReview(target: State, noteId: string) {
  let seed = 7;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const pick = <T>(rows: readonly T[]) =>
    rows[Math.floor(random() * rows.length)];
  const kinds: Kind[] = [
    "DECISION",
    "ACTION_ITEM",
    "ACTION_ITEM",
    "ISSUE",
    "QUESTION",
    "INSIGHT",
    "STATUS_REPORT",
  ];
  const words = [
    "요금",
    "온보딩",
    "알림",
    "검색",
    "권한",
    "배포",
    "지표",
    "문서",
    "보안",
    "결제",
    "초대",
    "동기화",
  ];
  const sizes = [
    60, 42, 33, 27, 22, 18, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1,
  ];
  const item = (kind: Kind, content: string): StoredItem => ({
    itemId: nextId("01KI"),
    revision: 1,
    kind,
    content,
    included: true,
    projectSelected: false,
    edited: false,
    authoredByUserId: null,
    originalProposalRef: { proposalId: nextId("01KP"), revision: 1 },
    citations: [],
    assignee: null,
    due: null,
    decisions: [],
    replacements: [],
    taskChanges: [],

    suggestedAssignment: null,
  });
  const groups = sizes.map((size, index) => {
    const title = `${words[index % words.length]} ${index + 1}차 논의`;
    return Array.from({ length: size }, (_, at) =>
      at === 0 && size >= 3
        ? item("AGENDA", title)
        : item(pick(kinds), `${title} · 항목 ${at + 1}`)
    );
  });
  const loose = Array.from({ length: 17 }, (_, at) =>
    item(pick(kinds), `주제 밖 항목 ${at + 1}`)
  );
  target.reviews.set(noteId, {
    reviewId: nextId("01KR"),
    noteId,
    reviewVersion: 1,
    items: [...groups.flat(), ...loose],
  });

  const relation = (
    source: StoredItem,
    to: StoredItem,
    kind: string,
    label: string
  ): SummaryRelation => ({
    sourceItemId: source.itemId,
    targetItemId: to.itemId,
    kind,
    label,
  });
  const topics = groups.map((items, index): SummaryTopic => {
    const center = items[0];
    const relations = [
      ...items
        .slice(1)
        .filter(() => random() < 0.4)
        .map((row) => relation(center, row, "ABOUT", "주제")),
      ...items
        .slice(2)
        .filter(() => random() < 0.35)
        .map((row) => relation(pick(items), row, "LEADS_TO", "후속")),
      ...(random() < 0.5
        ? [relation(pick(items), pick(pick(groups)), "SUPPORTS", "근거")]
        : []),
    ];
    const open = items.filter(
      (row) =>
        (row.kind === "ISSUE" || row.kind === "QUESTION") && random() < 0.5
    );
    const title =
      center.kind === "AGENDA"
        ? center.content
        : `${words[index % words.length]} ${index + 1}차 논의`;
    // 다른 주제에도 속한 항목은 이 주제의 members 에도 든다(새 계약). 같은 항목이 이미 있으면 겹쳐 넣지 않는다.
    const also = (random() < 0.4 ? [pick(pick(groups))] : []).filter(
      (row) => !items.includes(row)
    );
    return {
      ordinal: index + 1,
      title,
      agendaItemId: center.kind === "AGENDA" ? center.itemId : null,
      centerItemId: center.itemId,
      members: [...items, ...also].map((row) => ({
        itemId: row.itemId,
        kind: row.kind,
      })),
      alsoItemIds: also.map((row) => row.itemId),
      relations,
      sentences: [],
      openItemIds: open.map((row) => row.itemId),
      // 옛 노트처럼 안건 행이 없는 주제도 섞는다 — 화면 key 는 순서 번호로 대신한다
      agendaId: index % 5 === 4 ? null : nextId("01KG"),
      // 옛 노트는 한 줄 요약도 없다
      summary: index % 5 === 4 ? null : `${title}에서 나온 항목을 정리했다`,
      completed: true,
      description: [],
      conclusions: [],
      openItems: open.map((row) => ({
        text: row.content,
        itemIds: [row.itemId],
      })),
    };
  });
  target.summaries.set(noteId, {
    noteId,
    status: "SUCCEEDED",
    resultVersion: nextId("01KV"),
    headline: null,
    lead: [],
    topics,
    agendas: topics,
  });
}

/** 전사가 없는 노트의 작은 검토본. 요약은 실패로 두어 요약 없는 화면의 표본이 된다. */
function seedSmallReview(target: State, noteId: string, confirmed: boolean) {
  const item = (
    kind: Kind,
    content: string,
    over: Partial<StoredItem> = {}
  ): StoredItem => ({
    itemId: nextId("01KI"),
    revision: 1,
    kind,
    content,
    included: true,
    projectSelected: confirmed,
    edited: false,
    authoredByUserId: null,
    originalProposalRef: { proposalId: nextId("01KP"), revision: 1 },
    citations: [],
    assignee: null,
    due: null,
    decisions: [],
    replacements: [],
    taskChanges: [],

    suggestedAssignment: null,
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
    agendas: [],
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
    failWith(
      "MEETING_REVIEW_NOT_FOUND",
      404,
      "검토본 또는 항목을 찾을 수 없습니다."
    )
  );
}

function draftView(
  draft: TaskDraft | null
): ReviewItem["taskChanges"][number]["draft"] {
  return draft
    ? {
        ...draft,
        status: draft.status ?? null,
        due: draft.due ?? null,
        assignee: draft.assignee
          ? {
              value: draft.assignee.value
                ? {
                    type: draft.assignee.value.type,
                    id: draft.assignee.value.id ?? null,
                    label: draft.assignee.value.label ?? null,
                  }
                : null,
            }
          : null,
      }
    : null;
}

function view(review: StoredReview): MeetingReviewResponseData {
  const workspaceId = workspaceOfProject(
    mockDb.getNote(review.noteId).projectId
  );
  return structuredClone({
    reviewId: review.reviewId,
    noteId: review.noteId,
    reviewVersion: review.reviewVersion,
    items: review.items.map((item) => ({
      ...item,
      decisions: item.decisions.map((choice) => ({
        ...choice,
        taskChange: draftView(choice.taskChange),
      })),
      assignee: resolveAssignee(workspaceId, item.assignee),
      taskChanges: item.taskChanges.map((change) => ({
        ...change,
        draft: draftView(change.draft),
        assignee: change.assignee && {
          value: resolveAssignee(workspaceId, change.assignee.value),
        },
      })),
    })),
  });
}

function editableReview(noteId: string, expectedReviewVersion: number) {
  const review = reviewOf(noteId);
  if (flowOf(noteId) === "CONFIRMED") failWith(...CONFIRMED);
  if (
    flowOf(noteId) !== "REVIEWABLE" ||
    expectedReviewVersion !== review.reviewVersion
  ) {
    failWith(...CONFLICT);
  }
  return review;
}

function checkAssignable(kind: Kind, assignee: unknown, due: unknown) {
  if (!ASSIGNABLE_KINDS.has(kind) && (assignee != null || due != null))
    failWith(...BAD_REQUEST);
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
    items: (isHelpDemoEnabled()
      ? HELP_DEMO_ENDED_ITEMS
      : REVIEW_SEED_TOPICS[0].items
    ).map((seed) => ({
      itemId: nextId("01KI"),
      revision: 1,
      kind: seed.kind,
      content: seed.content,
      included: true,
      projectSelected: false,
      edited: false,
      authoredByUserId: null,
      originalProposalRef: { proposalId: nextId("01KP"), revision: 1 },
      citations: segments
        .slice(0, 1)
        .map((row) => ({ segmentId: row.segmentId, role: "SUPPORTS" })),
      assignee:
        seed.kind === "ACTION_ITEM" && seed.who === "me"
          ? who(noteId, "me")
          : null,
      due:
        seed.kind === "ACTION_ITEM" && seed.dueIn !== undefined
          ? dueAfterMeeting(seed.dueIn)
          : null,
      decisions: [],
      replacements: [],
      taskChanges: [],

      suggestedAssignment: null,
    })),
  });
  target.summaries.set(noteId, {
    noteId,
    status: "NOT_AVAILABLE",
    resultVersion: null,
    headline: null,
    lead: [],
    topics: [],
    agendas: [],
  });
  target.flows.set(noteId, "REVIEWABLE");
}

export const meetingFlow = {
  seedApprovalCase(key: ProjectApprovalCase) { seedApprovalCase(store(), key); },
  /** 새 분석 주기에 제안이 없는 표본. 저장 선택은 실제 서버처럼 별도로 유지합니다. */
  clearSuggestions(noteId: string) {
    for (const item of reviewOf(noteId).items) {
      item.replacements = [];
      item.taskChanges = [];
    }
  },
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
        agendas: [],
      }
    );
  },
  /** 표본을 만드는 테스트가 계약 경로의 인자를 고를 때 쓴다. */
  proposalIds() {
    return [...store().revisions.keys()];
  },
};

export const meetingFlowHandlers = [
  http.get("*/v1/workspaces/:workspaceId/projects/:projectId/tasks", () => {
    if (store().approvalCase !== "task-load-error") return undefined;
    return respond(() => failWith("INTERNAL_SERVER_ERROR", 500, "기존 할 일을 불러오지 못했습니다."));
  }),
  http.get("*/v1/notes/:noteId/analyses/flow", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      const status = flowOf(noteId);
      // 요청 전이면 빈 배열이다. 요청 뒤에는 네 영역이 흐름 상태를 따라간다.
      const regionStatus =
        status === "ANALYZING"
          ? "PENDING"
          : status === "ANALYSIS_FAILED"
            ? "FAILED"
            : "SUCCEEDED";
      const regions =
        status === "NOT_REQUESTED" || status === "DIARIZING"
          ? []
          : (
              ["RELATIONS", "EVALUATION", "SUMMARY", "ITEM_ENRICHMENT"] as const
            ).map((region) => ({
              region,
              status: regionStatus,
            }));
      return { noteId, status, regions };
    })
  ),

  http.post("*/v1/notes/:noteId/analyses", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      mockDb.getNote(noteId);
      const status = flowOf(noteId);
      if (status !== "ANALYSIS_FAILED" && status !== "NOT_REQUESTED") {
        failWith(
          "MEETING_ANALYSIS_CONFLICT",
          409,
          "저장된 분석 요청 또는 결과와 일치하지 않습니다."
        );
      }
      startAnalysis(noteId);
      return { noteId, requestId: nextId("01KQ"), flowStatus: flowOf(noteId) };
    }, 202)
  ),

  http.get("*/v1/notes/:noteId/meeting-review/summary", ({ params }) =>
    respond(() => meetingFlow.summaryOf(paramId(params.noteId)))
  ),

  http.get("*/v1/notes/:noteId/meeting-review", ({ params }) =>
    respond(() => view(reviewOf(paramId(params.noteId))))
  ),

  http.post(
    "*/v1/notes/:noteId/meeting-review/items",
    async ({ params, request }) =>
      respond(async () => {
        const noteId = paramId(params.noteId);
        const body = (await request.json()) as AddMeetingReviewItemRequest;
        const review = editableReview(noteId, body.expectedReviewVersion);
        if (!body.content?.trim()) failWith(...BAD_REQUEST);
        checkAssignable(body.kind, body.assignee, body.due);
        // 서버처럼: 요약에 없는 주제 번호는 거절하고, 있으면 그 주제 members 에 합친다.
        const topic =
          body.topicOrdinal == null
            ? null
            : (store()
                .summaries.get(noteId)
                ?.topics.find((row) => row.ordinal === body.topicOrdinal) ??
              failWith("TOPIC_UNKNOWN", 400, "요약에 없는 주제입니다."));
        const itemId = nextId("01KI");
        // 실패할 수 있는 변환을 모두 끝낸 뒤에 상태를 바꾼다. 400 뒤에 요약만 바뀌어 남으면 안 된다.
        const assignee = assigneeFromRequest(body.assignee, noteId);
        topic?.members.push({ itemId, kind: body.kind });
        review.items.push({
          itemId,
          revision: 1,
          kind: body.kind,
          content: body.content,
          included: true,
          projectSelected: false,
          edited: false,
          authoredByUserId: mockDb.getCurrentUser().userId,
          originalProposalRef: null,
          citations: body.citations ?? [],
          assignee,
          due: body.due ?? null,
          decisions: [],
          replacements: [],
          taskChanges: [],

          suggestedAssignment: null,
        });
        review.reviewVersion += 1;
        return view(review);
      }, 201)
  ),

  http.patch(
    "*/v1/notes/:noteId/meeting-review/items/:itemId",
    async ({ params, request }) =>
      respond(async () => {
        const noteId = paramId(params.noteId);
        const body = (await request.json()) as UpdateMeetingReviewItemRequest;
        const review = editableReview(noteId, body.expectedReviewVersion);
        const itemIndex = review.items.findIndex(
          (row) => row.itemId === paramId(params.itemId)
        );
        if (itemIndex < 0)
          failWith(
            "MEETING_REVIEW_NOT_FOUND",
            404,
            "검토본 또는 항목을 찾을 수 없습니다."
          );
        const item = structuredClone(review.items[itemIndex]);
        const target = store();
      if (noteId === MENTORING_NOTE_ID && !target.saveFaultUsed && (target.approvalCase === "save-error" || target.approvalCase === "save-conflict")) {
        target.saveFaultUsed = true;
        if (target.approvalCase === "save-error") failWith("INTERNAL_SERVER_ERROR", 500, "저장하지 못했습니다. 다시 시도해 주세요.");
        review.reviewVersion += 1;
        review.items[itemIndex].revision += 1;
        failWith(...CONFLICT);
      }
      if (body.expectedItemRevision !== item.revision) failWith(...CONFLICT);
        if (
          body.included === null ||
          (body.content !== undefined && !body.content?.trim())
        ) {
          failWith(...BAD_REQUEST);
        }
        if (
          body.projectSelected !== undefined &&
          (typeof body.projectSelected !== "boolean" ||
            !requiresProjectSelection(item.kind) ||
            (body.projectSelected && !(body.included ?? item.included)))
        )
          failWith(...BAD_REQUEST);
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
        const projectSelected =
          (body.projectSelected ?? item.projectSelected) && item.included;
        if (projectSelected !== item.projectSelected) {
          item.projectSelected = projectSelected;
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
        const decisions = body.decisions ?? [];
        if (
          new Set(decisions.map((row) => row.targetId)).size !==
          decisions.length
        )
          failWith(...BAD_REQUEST);
        // 선택 저장은 실제 업무를 바꾸지 않습니다. APPLY는 초안 전체가 필요하고 KEEP 생략은 보존합니다.
        for (const { targetId, decision, taskChange: draft } of decisions) {
          const replacement = item.replacements.find(
            (row) => row.target.itemId === targetId
          );
          const taskChange = item.taskChanges.find(
            (row) => row.target.itemId === targetId
          );
          const previous = item.decisions.find(
            (row) => row.targetId === targetId
          );
          if (previous?.decision === "APPLIED" && decision !== "APPLIED")
            failWith(...BAD_REQUEST);
          if (
            !replacement &&
            !taskChange &&
            decision === null &&
            previous &&
            !draft
          ) {
            changed = true;
          } else if (
            replacement &&
            decision !== "APPLIED" &&
            decision !== "APPLY" &&
            !draft
          ) {
            changed ||= replacement.decision !== decision;
            replacement.decision = decision;
          } else if (taskChange && decision !== "END") {
            if (taskChange.decision === "APPLIED" && decision !== "APPLIED")
              failWith(...BAD_REQUEST);
            if (decision === "APPLY" && !draft) failWith(...BAD_REQUEST);
            if (draft) {
              if (
                (decision !== "APPLY" && decision !== "KEEP") ||
                draft.expectedRevision !== taskChange.target.revision
              )
                failWith(...BAD_REQUEST);
              if (
                (draft.assignee && !("value" in draft.assignee)) ||
                (draft.due && !("value" in draft.due))
              )
                failWith(...BAD_REQUEST);
              if (draft.assignee?.value)
                assigneeFromRequest(draft.assignee.value, noteId);
            }
            const nextDraft =
              decision === null ? null : (draft ?? taskChange.draft);
            changed ||=
              JSON.stringify(nextDraft) !== JSON.stringify(taskChange.draft);
            taskChange.draft = nextDraft;
            changed ||= taskChange.decision !== decision;
            taskChange.decision = decision;
          } else {
            failWith(
              "DECISION_TARGET_UNKNOWN",
              400,
              "제안에 없는 대상이거나 고를 수 없는 값입니다."
            );
          }
        }
        for (const { targetId, decision, taskChange } of decisions) {
          const previous = item.decisions.find(
            (row) => row.targetId === targetId
          );
          const next =
            decision === null
              ? null
              : {
                  targetId,
                  decision,
                  taskChange: taskChange ?? previous?.taskChange ?? null,
                };
          changed ||= JSON.stringify(previous ?? null) !== JSON.stringify(next);
          item.decisions = item.decisions.filter(
            (row) => row.targetId !== targetId
          );
          if (next) item.decisions.push(next);
        }
        if (changed) {
          item.revision += 1;
          review.reviewVersion += 1;
          review.items[itemIndex] = item;
        }
        return view(review);
      })
  ),

  http.post("*/v1/notes/:noteId/approval", async ({ params, request }) =>
    respond(async () => {
      const noteId = paramId(params.noteId);
      const note = mockDb.getNote(noteId);
      const body = (await request.json()) as MeetingApprovalRequest;
      if (body.projectSelectionConfirmed !== true) failWith(...BAD_REQUEST);
      const target = store();
      const saved = target.approvals.get(noteId);
      if (saved) {
        if (saved.body === JSON.stringify(body)) return saved.response;
        failWith(
          "PROJECT_KNOWLEDGE_CONFLICT",
          409,
          "프로젝트 승인 기준이 변경되었습니다. 다시 조회해 주세요."
        );
      }
      const review = reviewOf(noteId);
      if (flowOf(noteId) !== "REVIEWABLE" || body.reviewId !== review.reviewId)
        failWith(...BAD_REQUEST);
      if (body.reviewRevision !== review.reviewVersion) {
        failWith(
          "PROJECT_KNOWLEDGE_CONFLICT",
          409,
          "프로젝트 승인 기준이 변경되었습니다. 다시 조회해 주세요."
        );
      }
      const included = review.items.filter(isProjectIncluded);
      // 저장 선택이 현재 제안에서 사라졌으면 업무를 쓰기 전에 전체 거절합니다.
      if (
        included.some((item) =>
          item.decisions.some(
            (choice) =>
              (choice.decision === "END" &&
                !item.replacements.some(
                  (row) => row.target.itemId === choice.targetId
                )) ||
              (choice.decision === "APPLY" &&
                !item.taskChanges.some(
                  (row) => row.target.itemId === choice.targetId
                ))
          )
        )
      )
        failWith(
          "PROJECT_KNOWLEDGE_CONFLICT",
          409,
          "프로젝트 승인 기준이 변경되었습니다. 다시 조회해 주세요."
        );
      const approvalId = nextId("01KA");
      const changes = included
        .flatMap((item) => item.taskChanges)
        .filter((row) => row.decision === "APPLY")
        .map((row) => {
          const draft = row.draft ?? failWith(...BAD_REQUEST);
          return {
            ...draft,
            taskId: row.target.itemId,
            assignee: draft.assignee
              ? { value: assigneeFromRequest(draft.assignee.value, noteId) }
              : null,
          };
        });
      // 모든 충돌 검사가 끝난 뒤에만 새 할 일과 이전 결정도 확정합니다.
      projectTasks.applyReviewedChanges(note.projectId, changes, approvalId);
      // 포함 항목에 저장된 끝내기만 끝낸다. 다른 확정이 먼저 끝낸 노드는 건너뛴다.
      const endedAt = new Date().toISOString();
      for (const row of included.flatMap((item) => item.replacements)) {
        if (row.decision === "END" && row.target.endedAt === null)
          row.target.endedAt = endedAt;
      }

      const actions = included.filter((item) => item.kind === "ACTION_ITEM");
      const promoted = projectTasks.promote(
        note.projectId,
        actions.map(({ content, assignee, due }) => ({
          content,
          assignee,
          due,
        })),
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
        evidenceIds: [
          ...new Set(
            included.flatMap((item) => item.citations.map((c) => c.segmentId))
          ),
        ],
      };
      target.approvals.set(noteId, { body: JSON.stringify(body), response });
      target.flows.set(noteId, "CONFIRMED");
      return response;
    })
  ),

  // 검토 항목의 원본 명제 이력. 이 목이 만든 명제만 답하고, 나머지는 실시간 정리 목으로 넘긴다.
  http.get(
    "*/v1/notes/:noteId/proposals/:proposalId/revisions",
    ({ params }) => {
      const revisions = store().revisions.get(paramId(params.proposalId));
      if (!revisions || !hasSeededReview(paramId(params.noteId)))
        return undefined;
      return respond(() => ({
        proposalId: paramId(params.proposalId),
        revisions,
      }));
    }
  ),

  // 회의 간 연결. 멘토링 노트만 지난 회의(PREVIOUS_NOTE_ID)와 이어져 있다 — 카드에 가려지는 대체 연결,
  // 카드 없이 서는 「마침」 연결 하나, 주제 이어짐 둘.
  http.get("*/v1/projects/:projectId/meeting-links", ({ request }) =>
    respond(() => {
      const noteId = new URL(request.url).searchParams.get("noteId");
      const empty = {
        notes: [],
        meetingLinks: [],
        conflicts: [],
        agendaLinks: [],
      };
      if (noteId !== MENTORING_NOTE_ID) return empty;
      const summary = store().summaries.get(MENTORING_NOTE_ID);
      const review = store().reviews.get(MENTORING_NOTE_ID);
      if (!summary || !review) return empty;
      const byId = new Map(review.items.map((row) => [row.itemId, row]));
      const now = mockDb.getNote(MENTORING_NOTE_ID);
      const past = mockDb.getNote(PREVIOUS_NOTE_ID);
      const startedAt = new Date(MEETING_DATE).toISOString();
      const pastStartedAt = new Date(
        MEETING_DATE - 7 * 86_400_000
      ).toISOString();
      const side = (
        noteId: string,
        proposalId: string,
        content: string,
        proposalKind: PastLink["target"]["proposalKind"]
      ) => ({
        noteId,
        proposalId,
        revision: 1,
        content,
        proposalKind,
      });
      const sourceOf = (proposalId: string) =>
        review.items.find(
          (row) => row.originalProposalRef?.proposalId === proposalId
        );
      const carded = store().pastLinks.flatMap((link) => {
        const source = sourceOf(link.sourceProposalId);
        if (!source) return [];
        return [
          {
            kind: link.kind,
            reason: "새 결정이 지난 결정을 대신한다",
            evidenceSequences: [],
            source: side(
              MENTORING_NOTE_ID,
              link.sourceProposalId,
              source.content,
              "DECISION"
            ),
            target: side(
              PREVIOUS_NOTE_ID,
              link.target.proposalId,
              link.target.content,
              link.target.proposalKind
            ),
          },
        ];
      });
      // 「차별점과 요금」의 첫 결정이 지난 회의의 할 일을 마친다 — 카드가 없어 결론 옆 한 줄로 선다
      const pricing = summary.agendas[1];
      const finishing = pricing?.members
        .map((member) => byId.get(member.itemId))
        .find((row) => row?.kind === "DECISION" && row.originalProposalRef);
      const free = finishing?.originalProposalRef
        ? [
            {
              kind: "COMPLETES",
              reason: "지난 회의에서 맡은 조사를 이번에 마쳤다",
              evidenceSequences: [],
              source: side(
                MENTORING_NOTE_ID,
                finishing.originalProposalRef.proposalId,
                finishing.content,
                "DECISION"
              ),
              target: side(
                PREVIOUS_NOTE_ID,
                "01KP900000001",
                "경쟁 도구 요금표를 모은다",
                "ACTION_ITEM"
              ),
            },
          ]
        : [];
      const priceDecision = review.items.find(
        (row) =>
          row.kind === "DECISION" &&
          row.content.includes("좌석이 아니라 회의 시간")
      );
      const priceSource = priceDecision?.originalProposalRef
        ? {
            ...side(
              MENTORING_NOTE_ID,
              priceDecision.originalProposalRef.proposalId,
              priceDecision.content,
              "DECISION"
            ),
            revision: priceDecision.originalProposalRef.revision,
          }
        : null;
      return {
        notes: [
          {
            noteId: MENTORING_NOTE_ID,
            title: now.title,
            startedAt,
            agendas: summary.agendas.flatMap((row) =>
              row.agendaId
                ? [
                    {
                      agendaId: row.agendaId,
                      title: row.title,
                      completed: row.completed,
                      proposalIds: [],
                    },
                  ]
                : []
            ),
          },
          {
            noteId: PREVIOUS_NOTE_ID,
            title: past.title,
            startedAt: pastStartedAt,
            agendas: PREVIOUS_AGENDAS.map((row) => ({
              ...row,
              completed: true,
              proposalIds: [],
            })),
          },
        ],
        conflicts: [
          ...carded.slice(0, 1),
          ...(priceSource
            ? [
                {
                  kind: "SUPERSEDES",
                  reason:
                    "좌석 수 대신 실제 회의 시간을 과금 기준으로 정했습니다.",
                  evidenceSequences: [108],
                  source: priceSource,
                  target: {
                    type: "APPROVED",
                    itemId: "01KD900000001",
                    revision: 3,
                    proposalKind: "DECISION",
                    content: "요금은 좌석 수에 따라 계산한다",
                  },
                },
              ]
            : []),
        ],
        meetingLinks: [
          ...carded.slice(1),
          ...free,
          ...(priceSource
            ? [
                {
                  kind: "SUCCEEDS",
                  reason:
                    "회의 시간 기준 요금을 적용하기 위해 원가 계산을 이어서 확인합니다.",
                  evidenceSequences: [109],
                  source: priceSource,
                  target: {
                    type: "APPROVED",
                    itemId: "01KT900000001",
                    revision: 2,
                    proposalKind: "ACTION_ITEM",
                    content: "회의 시간별 원가 계산을 검토한다",
                  },
                },
              ]
            : []),
        ],
        agendaLinks: [
          {
            source: {
              noteId: MENTORING_NOTE_ID,
              agendaId: MENTORING_AGENDA_IDS[1],
            },
            target: {
              noteId: MENTORING_NOTE_ID,
              agendaId: MENTORING_AGENDA_IDS[0],
            },
          },
          {
            source: {
              noteId: MENTORING_NOTE_ID,
              agendaId: MENTORING_AGENDA_IDS[0],
            },
            target: {
              noteId: PREVIOUS_NOTE_ID,
              agendaId: PREVIOUS_AGENDAS[0].agendaId,
            },
          },
          {
            source: {
              noteId: MENTORING_NOTE_ID,
              agendaId: MENTORING_AGENDA_IDS[5],
            },
            target: {
              noteId: PREVIOUS_NOTE_ID,
              agendaId: PREVIOUS_AGENDAS[1].agendaId,
            },
          },
        ],
      };
    })
  ),

  http.get("*/v1/notes/:noteId/agendas", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      mockDb.getNote(noteId);
      // 끝난 멘토링 회의는 검토 요약의 주제가 곧 안건 정본이다(분석이 목록을 바꾼 뒤의 모양)
      const summary = hasSeededReview(noteId)
        ? store().summaries.get(noteId)
        : undefined;
      const review = store().reviews.get(noteId);
      if (summary && review) {
        const proposalOf = new Map(
          review.items.map((row) => [
            row.itemId,
            row.originalProposalRef?.proposalId ?? null,
          ])
        );
        const proposals = (itemIds: string[]) =>
          itemIds.flatMap((id) =>
            proposalOf.get(id) ? [proposalOf.get(id)!] : []
          );
        const sentences = (rows: { text: string; itemIds: string[] }[]) =>
          rows.map((row) => ({
            text: row.text,
            proposalIds: proposals(row.itemIds),
          }));
        return {
          asOfSequence: 420,
          agendas: summary.agendas.flatMap((row) =>
            row.agendaId
              ? [
                  {
                    agendaId: row.agendaId,
                    title: row.title,
                    completed: row.completed,
                    proposalIds: proposals(
                      row.members.map((member) => member.itemId)
                    ),
                    description: sentences(row.description),
                    conclusions: sentences(row.conclusions),
                    openItems: sentences(row.openItems),
                  },
                ]
              : []
          ),
        };
      }
      if (noteId === LIVE_AGENDA_NOTE_ID) return liveAgendaList(Date.now());
      return { asOfSequence: null, agendas: store().agendas.get(noteId) ?? [] };
    })
  ),

  http.post("*/v1/notes/:noteId/_mock/advance-analysis", ({ params }) =>
    respond(() => completeAnalysis(paramId(params.noteId)), 204)
  ),
];
