import {
  PROJECT_APPROVAL_CASES,
  type ProjectApprovalCase,
} from "@/lib/mocks/fixtures/project-approval-cases";
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
  helpDemoPack,
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
import {
  projectAgendaMapMock,
  projectAgendaMapSummary,
} from "@/lib/mocks/project-agenda-map";
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
  agendas: Map<string, NoteAgendasResponseDataAgendasItem[]>;
  pastLinks: PastLink[];
  runningSince: Map<string, number>;
};

export const MOCK_STEP_MS = 6_000;

export const LARGE_REVIEW_NOTE_ID = "01K0000000027";

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
const PREVIOUS_NOTE_ID = "01K0000000024";
const MENTORING_AGENDA_IDS = Array.from(
  { length: 8 },
  (_, at) => `01KG${String(at + 1).padStart(9, "0")}`
);
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

type ReviewSeedSet = {
  noteId: string;
  topics: SeedTopic[];
  loose: SeedItem[];
  headline: string;
  headlineTopics: number[];
  lead: Array<{ text: string; topics: number[] }>;
  agendaIds?: string[];
  meetingDate: number;
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
  const demoSets = isHelpDemoEnabled() ? helpDemoPack().reviewSets() : null;
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
  const requestedCase =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("reviewCase");
  const selectedCase = PROJECT_APPROVAL_CASES.find(
    (row) => row.key === requestedCase
  );
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
      } as ProposalRevision;
    });
    target.revisions.set(proposalId, revisions);
    const last = revisions[revisions.length - 1];
    return {
      itemId: nextId("01KJ"),
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
              target: {
                itemId: nextId("01KN"),
                revision: 1,
                kind: "DECISION",
                content: seed.replaces.content,
                noteId: PREVIOUS_NOTE_ID,
                noteTitle: mockDb.getNote(PREVIOUS_NOTE_ID).title,
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
                target: {
                  itemId: taskId,
                  revision: projectTasks.revisionOf(taskId),
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
    const edited = topicItems[1][3];
    edited.content = "무료 구간은 월 5시간으로 두고 팀 요금제에서는 뺀다";
    edited.edited = true;
    edited.revision = 2;
    review.reviewVersion = 2;
    review.items.push({
      itemId: nextId("01KJ"),
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
  const decision = review.items.find((item) =>
    item.replacements.some((row) => row.target.endedAt === null)
  )!;
  const action = review.items.find((item) => item.taskChanges.length > 0)!;
  const select = (item: StoredItem) => {
    item.projectSelected = true;
  };
  const choose = (item: StoredItem, value: "END" | "KEEP") => {
    select(item);
    item.replacements[0].decision = value;
    item.decisions = [
      {
        targetId: item.replacements[0].target.itemId,
        decision: value,
        taskChange: null,
      },
    ];
  };
  const chooseTask = (item: StoredItem, value: "APPLY" | "KEEP") => {
    select(item);
    const change = item.taskChanges[0];
    change.decision = value;
    change.draft = {
      expectedRevision: change.target.revision,
      status: change.status,
      assignee: change.assignee,
      due: change.due,
    };
    item.decisions = [
      {
        targetId: change.target.itemId,
        decision: value,
        taskChange: change.draft,
      },
    ];
  };
  if (key === "all-selected") {
    for (const item of review.items)
      if (item.included && requiresProjectSelection(item.kind)) select(item);
  } else if (key === "new-items" || key === "confirmed-mixed") {
    select(
      review.items.find(
        (item) => item.kind === "DECISION" && !item.replacements.length
      )!
    );
    select(
      review.items.find(
        (item) => item.kind === "ACTION_ITEM" && !item.taskChanges.length
      )!
    );
  } else if (key === "replace-pending") select(decision);
  else if (key === "replace" || key === "missing-choice")
    choose(decision, "END");
  else if (key === "keep") choose(decision, "KEEP");
  else if (key === "ended")
    select(
      review.items.find((item) =>
        item.replacements.some((row) => row.target.endedAt !== null)
      )!
    );
  else if (key === "task-pending" || key === "task-load-error") select(action);
  else if (
    key === "task-apply" ||
    key === "stale-task" ||
    key === "duplicate-task"
  )
    chooseTask(action, "APPLY");
  else if (key === "task-keep") chooseTask(action, "KEEP");
  else if (key === "excluded") {
    decision.included = false;
    decision.projectSelected = false;
  }
  if (key === "missing-choice") decision.replacements = [];
  if (key === "stale-task") {
    action.taskChanges[0].target.revision -= 1;
    action.taskChanges[0].draft!.expectedRevision -= 1;
    action.decisions[0].taskChange = action.taskChanges[0].draft;
  }
  if (key === "duplicate-task") {
    const other = review.items.find(
      (item) => item !== action && item.kind === "ACTION_ITEM"
    )!;
    other.taskChanges = structuredClone(action.taskChanges);
    other.decisions = structuredClone(action.decisions);
    select(other);
  }
  if (key === "confirmed-mixed")
    target.flows.set(MENTORING_NOTE_ID, "CONFIRMED");
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
    const also = set.decorated && index === 5 ? [topicItems[0][3]] : [];
    return {
      ordinal: index + 1,
      title: seed.title,
      agendaItemId,
      centerItemId,
      members: items.map((item) => ({ itemId: item.itemId, kind: item.kind })),
      memberships: [
        ...items.map((item) => ({ itemId: item.itemId, secondary: false })),
        ...also.map((item) => ({ itemId: item.itemId, secondary: true })),
      ],
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
    itemId: nextId("01KJ"),
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
    const also = (random() < 0.4 ? [pick(pick(groups))] : []).filter(
      (row) => !items.includes(row)
    );
    return {
      ordinal: index + 1,
      title,
      agendaItemId: center.kind === "AGENDA" ? center.itemId : null,
      centerItemId: center.itemId,
      members: items.map((row) => ({ itemId: row.itemId, kind: row.kind })),
      memberships: [
        ...items.map((row) => ({ itemId: row.itemId, secondary: false })),
        ...also.map((row) => ({ itemId: row.itemId, secondary: true })),
      ],
      alsoItemIds: also.map((row) => row.itemId),
      relations,
      sentences: [],
      openItemIds: open.map((row) => row.itemId),
      agendaId: index % 5 === 4 ? null : nextId("01KG"),
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

function seedSmallReview(target: State, noteId: string, confirmed: boolean) {
  const item = (
    kind: Kind,
    content: string,
    over: Partial<StoredItem> = {}
  ): StoredItem => ({
    itemId: nextId("01KJ"),
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

function retryableOf(status: FlowStatus) {
  return status === "ANALYSIS_FAILED" || status === "NOT_REQUESTED";
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
      ? helpDemoPack().endedItems
      : REVIEW_SEED_TOPICS[0].items
    ).map((seed) => ({
      itemId: nextId("01KJ"),
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
  dueAnalysisNoteIds(): string[] {
    const target = store();
    return [...target.runningSince.entries()]
      .filter(([, since]) => Date.now() - since >= MOCK_STEP_MS)
      .map(([noteId]) => noteId);
  },
  seedApprovalCase(key: ProjectApprovalCase) {
    seedApprovalCase(store(), key);
  },
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
  proposalIds() {
    return [...store().revisions.keys()];
  },
};

export const meetingFlowHandlers = [
  http.get("*/v1/workspaces/:workspaceId/projects/:projectId/tasks", () => {
    if (store().approvalCase !== "task-load-error") return undefined;
    return respond(() =>
      failWith(
        "INTERNAL_SERVER_ERROR",
        500,
        "기존 할 일을 불러오지 못했습니다."
      )
    );
  }),
  http.get("*/v1/notes/:noteId/analyses/flow", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      const status = flowOf(noteId);
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
      return { noteId, status, regions, retryable: retryableOf(status) };
    })
  ),

  http.post("*/v1/notes/:noteId/analyses", ({ params }) =>
    respond(() => {
      const noteId = paramId(params.noteId);
      mockDb.getNote(noteId);
      if (!retryableOf(flowOf(noteId))) {
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
    respond(() => {
      const summary = structuredClone(
        projectAgendaMapSummary(paramId(params.noteId)) ??
          meetingFlow.summaryOf(paramId(params.noteId))
      );
      Reflect.deleteProperty(summary, "topics");
      for (const agenda of summary.agendas) {
        for (const field of [
          "sentences",
          "agendaItemId",
          "centerItemId",
          "alsoItemIds",
        ]) {
          Reflect.deleteProperty(agenda, field);
        }
      }
      return summary;
    })
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
        const topic =
          body.topicOrdinal == null
            ? null
            : (store()
                .summaries.get(noteId)
                ?.topics.find((row) => row.ordinal === body.topicOrdinal) ??
              failWith("TOPIC_UNKNOWN", 400, "요약에 없는 주제입니다."));
        const itemId = nextId("01KJ");
        const assignee = assigneeFromRequest(body.assignee, noteId);
        topic?.members.push({ itemId, kind: body.kind });
        topic?.memberships.push({ itemId, secondary: false });
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
        if (
          noteId === MENTORING_NOTE_ID &&
          !target.saveFaultUsed &&
          (target.approvalCase === "save-error" ||
            target.approvalCase === "save-conflict")
        ) {
          target.saveFaultUsed = true;
          if (target.approvalCase === "save-error")
            failWith(
              "INTERNAL_SERVER_ERROR",
              500,
              "저장하지 못했습니다. 다시 시도해 주세요."
            );
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
      projectTasks.applyReviewedChanges(note.projectId, changes, approvalId);
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

  http.get("*/v1/notes/:noteId/proposals", ({ params }) => {
    const noteId = paramId(params.noteId);
    const review = store().reviews.get(noteId);
    if (!review || !hasSeededReview(noteId)) return undefined;
    const proposalIds = new Set(
      review.items.flatMap((row) =>
        row.originalProposalRef?.proposalId
          ? [row.originalProposalRef.proposalId]
          : []
      )
    );
    return respond(() => ({
      proposals: [...proposalIds].flatMap((proposalId) => {
        const latest = store().revisions.get(proposalId)?.at(-1);
        return latest ? [latest] : [];
      }),
      runs: [],
    }));
  }),

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

  http.get("*/v1/projects/:projectId/meeting-links", ({ request, params }) =>
    respond(() => {
      const noteId = new URL(request.url).searchParams.get("noteId");
      const empty = {
        notes: [],
        meetingLinks: [],
        conflicts: [],
        agendaLinks: [],
      };
      if (!noteId) return projectAgendaMapMock(paramId(params.projectId));
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
