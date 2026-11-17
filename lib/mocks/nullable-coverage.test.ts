import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { billingHandlers, billingMock } from "@/lib/mocks/billing";
import { CONTEXT_SNAPSHOT } from "@/lib/mocks/proposals";
import { mockDb } from "@/lib/mocks/db";
import { meetingFlow, meetingFlowHandlers } from "@/lib/mocks/meeting-flow";
import { MENTORING_NOTE_ID } from "@/lib/mocks/fixtures/mentoring-note";
import { projectTaskHandlers, projectTasks } from "@/lib/mocks/project-tasks";
import { restHandlers, seedShareMail } from "@/lib/mocks/rest-handlers";
import { termHandlers } from "@/lib/mocks/terms";
import {
  resetChatStreamsForTests,
  seedAgentChatTurnForTests,
} from "@/lib/mocks/sse-handler";

const server = setupServer(
  ...meetingFlowHandlers,
  ...projectTaskHandlers,
  ...restHandlers,
  ...termHandlers,
  ...billingHandlers
);
const contract = parse(readFileSync("openapi3.yml", "utf8"));

function nullableLeaves(schema: unknown, path = ""): string[] {
  if (!schema || typeof schema !== "object") return [];
  const node = schema as {
    properties?: Record<string, unknown>;
    items?: unknown;
  };
  const out: string[] = [];
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    const next = path ? `${path}.${key}` : key;
    if ((value as Record<string, unknown>)?.nullable === true) out.push(next);
    out.push(...nullableLeaves(value, next));
  }
  if (node.items) out.push(...nullableLeaves(node.items, `${path}[]`));
  return out;
}

function patternLeaves(
  schema: unknown,
  path = ""
): Array<{ leaf: string; pattern: string }> {
  if (!schema || typeof schema !== "object") return [];
  const node = schema as {
    properties?: Record<string, { pattern?: string }>;
    items?: { pattern?: string };
    oneOf?: unknown[];
  };
  const out: Array<{ leaf: string; pattern: string }> = [];
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    const next = path ? `${path}.${key}` : key;
    if (typeof value?.pattern === "string")
      out.push({ leaf: next, pattern: value.pattern });
    out.push(...patternLeaves(value, next));
  }
  if (node.items) {
    if (typeof node.items.pattern === "string")
      out.push({ leaf: `${path}[]`, pattern: node.items.pattern });
    out.push(...patternLeaves(node.items, `${path}[]`));
  }
  for (const branch of node.oneOf ?? [])
    out.push(...patternLeaves(branch, path));
  return out;
}

function valuesAt(node: unknown, parts: string[]): unknown[] {
  if (parts.length === 0) return [node];
  const [head, ...rest] = parts;
  if (head.endsWith("[]")) {
    const key = head.slice(0, -2);
    const list = key ? (node as Record<string, unknown>)?.[key] : node;
    if (!Array.isArray(list)) return [];
    return list.flatMap((item) => valuesAt(item, rest));
  }
  if (node === null || node === undefined) return [];
  return valuesAt((node as Record<string, unknown>)[head], rest);
}

type NullableSchema = {
  properties?: Record<string, NullableSchema>;
  items?: NullableSchema;
  required?: string[];
};
function optionalLeaf(
  schema: NullableSchema | undefined,
  parts: string[]
): boolean {
  const [part, ...rest] = parts;
  const key = part.replace(/\[\]$/, "");
  if (rest.length === 0) return !schema?.required?.includes(key);
  const child = schema?.properties?.[key];
  return optionalLeaf(part.endsWith("[]") ? child?.items : child, rest);
}

type GetOperation = {
  path: string;
  schema: string;
  params: string[];
  requiredQuery: string[];
};

function jsonGetOperations(): GetOperation[] {
  const paths = contract.paths as Record<
    string,
    Record<
      string,
      {
        responses?: Record<string, unknown>;
        parameters?: Array<{ name: string; in: string; required?: boolean }>;
      }
    >
  >;
  const operations: GetOperation[] = [];
  for (const [path, methods] of Object.entries(paths)) {
    const ok = (
      methods.get?.responses?.["200"] as
        | { content?: Record<string, { schema?: { $ref?: string } }> }
        | undefined
    )?.content;
    const ref = ok
      ? Object.values(ok).find((media) => media?.schema?.$ref)?.schema?.$ref
      : undefined;
    if (!ref) continue;
    operations.push({
      path,
      schema: ref.replace("#/components/schemas/", ""),
      params: (path.match(/\{(\w+)\}/g) ?? []).map((token) =>
        token.slice(1, -1)
      ),
      requiredQuery: (methods.get?.parameters ?? [])
        .filter((parameter) => parameter.in === "query" && parameter.required)
        .map((parameter) => parameter.name),
    });
  }
  return operations;
}

async function contractSamples() {
  const workspaces = mockDb.listWorkspaces();
  const tuples: Array<Record<string, string>> = [];
  for (const { workspaceId } of workspaces) {
    const projects = mockDb.listProjects(workspaceId);
    if (projects.length === 0) tuples.push({ workspaceId });
    for (const { projectId } of projects) {
      const notes = mockDb.listNotes(projectId);
      if (notes.length === 0) tuples.push({ workspaceId, projectId });
      for (const { noteId } of notes) {
        tuples.push({ workspaceId, projectId, noteId });
      }
    }
  }

  const billingWorkspaces = await seedBilling(workspaces[0].workspaceId);

  const notes = tuples.filter((tuple) => tuple.noteId).map((t) => t.noteId!);

  const operable = notes.filter((noteId) => {
    const note = mockDb.getNote(noteId);
    return (
      note.meetingStatus === "NOT_STARTED" || note.meetingStatus === "PAUSED"
    );
  });

  for (const [index, noteId] of [operable[0], operable[1]].entries()) {
    const session = mockDb.createSession(noteId);
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
    mockDb.endMeeting(noteId);
    mockDb.requestAnalysis(noteId);
    if (index === 0) {
      mockDb.failAnalysis(noteId);
      continue;
    }
    mockDb.advanceAnalysis(noteId);
    mockDb.requestAnalysis(noteId);
  }
  const unstartedSession = mockDb.createSession(operable[2]);
  mockDb.updateSessionStatus(unstartedSession.sessionId, "COMPLETED");
  const activeSession = mockDb.createSession(operable[3]);
  mockDb.updateSessionStatus(activeSession.sessionId, "ACTIVE");
  const sessionIds = [
    "01K0000000010",
    unstartedSession.sessionId,
    activeSession.sessionId,
  ];

  mockDb.connectIntegration(workspaces[0].workspaceId, "LINEAR");

  const proposalIds = [
    ...new Set(
      [
        CONTEXT_SNAPSHOT.proposals.find((c) => c.closeReason !== null),
        CONTEXT_SNAPSHOT.proposals.find((c) => c.resolvesProposalId !== null),
        CONTEXT_SNAPSHOT.proposals.find(
          (c) => c.closeReason === null && c.resolvesProposalId === null
        ),
      ]
        .filter((c) => c !== undefined)
        .map((c) => c.proposalId)
    ),
  ];

  const chatIds = Array.from(
    { length: 6 },
    () =>
      mockDb.createAgentChat({ workspaceId: workspaces[0].workspaceId }).chatId
  );
  const approval = {
    approvalId: "0K9GVJT2C4Q7F",
    tool: "linear.create_issue",
  };
  seedAgentChatTurnForTests(chatIds[1], {
    approvalEntryId: "1735689600000-4",
    pendingApproval: {
      ...approval,
      summary: "이슈를 만들까요?",
      args: { projectId: "0HZX2K7M9Q4AE", title: "APP 버그 수정" },
      card: FULL_CARD,
    },
  });
  seedAgentChatTurnForTests(chatIds[5], {
    pendingApproval: {
      ...approval,
      summary: "이슈를 만들까요?",
      args: null,
      card: SPARSE_CARD,
    },
  });
  seedAgentChatTurnForTests(chatIds[2], {});
  seedAgentChatTurnForTests(chatIds[3], {
    pendingApproval: { ...approval, summary: null, args: null, card: null },
  });
  seedAgentChatTurnForTests(chatIds[4], {
    status: "FAILED",
    failureCode: "UPSTREAM_ERROR",
    retryable: true,
  });

  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "USER",
    scope: [
      {
        kind: "NOTE",
        id: notes[0],
        title: "주간 배포 회의",
        unavailable: false,
      },
      { kind: "NOTE", id: "01KDE1ETED000", title: null, unavailable: true },
    ],
    content: "논의된 이슈를 만들어줘",
    toolEvent: null,
  });
  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "TOOL",
    scope: [],
    content: "이슈 생성을 승인했습니다.",
    toolEvent: {
      tool: "linear_create_issue",
      decision: "APPROVED",
      status: null,
      url: null,
      card: FULL_CARD,
    },
  });
  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "TOOL",
    scope: [],
    content: "알림 읽음 표시를 승인했습니다.",
    toolEvent: {
      tool: "heymoa_mark_notification_read",
      decision: "APPROVED",
      status: null,
      url: null,
      card: SPARSE_CARD,
    },
  });
  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "TOOL",
    turnId: "0K9GVJT2C4Q3B",
    scope: [],
    content: "APP-12 생성됨",
    toolEvent: {
      tool: "linear_create_issue",
      decision: null,
      status: "success",
      url: "https://linear.app/minswon/issue/APP-12",
      card: null,
    },
  });

  mockDb.createInvitation(workspaces[0].workspaceId, {
    email: "invitee@heymoa.com",
    role: "MEMBER",
  });

  const requiredQuerySamples: Record<string, string[]> = {
    "/v1/notes/{noteId}/transcript/segments": [
      "?afterStartedAtMs=0&afterSequence=0",
    ],
    "/v1/agent-oauth/consent": ["?state=mock-consent"],
    "/v1/mail/unsubscribe": ["?t=mock"],
  };

  const samples: Array<[string, string]> = [];
  const skipped: string[] = [];
  for (const { path, schema, params, requiredQuery } of jsonGetOperations()) {
    let queries = [""];
    if (requiredQuery.length > 0) {
      const sampled = requiredQuerySamples[path];
      if (!sampled) {
        skipped.push(`${path} — 필수 query ${requiredQuery}의 표본이 없습니다`);
        continue;
      }
      queries = sampled;
    }
    const proposals = params.length === 0 ? [{}] : tuples;
    let filled = 0;
    for (const tuple of proposals) {
      const values: Record<string, string[]> = {
        ...Object.fromEntries(
          Object.entries(tuple).map(([key, value]) => [key, [value]])
        ),
        sessionId: sessionIds,
        chatId: chatIds,
        proposalId: [...proposalIds, ...meetingFlow.proposalIds().slice(0, 12)],
        taskId: projectTasks.ids(),
        setupId: billingMock.setupIds(),
        paymentId: billingMock.payments().map((payment) => payment.paymentId),
        delegationId: mockDb
          .listAgentDelegations()
          .map((delegation) => delegation.delegationId),
        mailId:
          "noteId" in tuple
            ? [seedShareMail(String(tuple.noteId), ["kim@example.com"])]
            : [],
      };
      if (params.some((param) => !values[param]?.length)) continue;
      let urls = [path];
      for (const param of params) {
        urls = urls.flatMap((url) =>
          values[param].map((value) => url.replace(`{${param}}`, value))
        );
      }
      for (const url of urls) {
        for (const query of queries) {
          const suffix =
            path === "/v1/projects/{projectId}/meeting-links" && tuple.noteId
              ? `?noteId=${tuple.noteId}`
              : query;
          samples.push([schema, `${url}${suffix}`]);
          if (path === "/v1/notifications")
            samples.push([schema, `${url}?schema=2`]);
          if (path === "/v1/admin/users" || path === "/v1/admin/feedbacks")
            samples.push([schema, `${url}?limit=1`]);
        }
      }
      filled += urls.length;
    }
    if (filled === 0) skipped.push(`${path} — 채울 수 없는 param: ${params}`);
  }
  for (const workspaceId of billingWorkspaces) {
    samples.push([
      "WorkspaceBillingResponse",
      `/v1/workspaces/${workspaceId}/billing`,
    ]);
    samples.push([
      "WorkspaceBillingPaymentsResponse",
      `/v1/workspaces/${workspaceId}/billing/payments`,
    ]);
  }
  for (const { workspaceId, paymentId } of billingMock.payments())
    samples.push([
      "BillingPaymentResponse",
      `/v1/workspaces/${workspaceId}/billing/payments/${paymentId}`,
    ]);
  return {
    samples: [...new Map(samples.map((s) => [s[1], s])).values()],
    skipped,
  };
}

async function seedBilling(firstWorkspaceId: string) {
  const call = (path: string, init?: { method: string; body?: unknown }) =>
    fetch(`http://localhost${path}`, {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  const open = async (workspaceId: string, requestKey: string) => {
    const response = await call(
      `/v1/workspaces/${workspaceId}/billing/setups`,
      {
        method: "POST",
        body: {
          requestKey,
          purpose: "PURCHASE",
          expectedProductVersion: "TEST_MONTHLY_V1",
          agreementVersion: "BILLING_TEST_V1",
        },
      }
    );
    return (await response.json()).data.setupId as string;
  };
  const run = async (
    scenario: Parameters<typeof billingMock.setScenario>[0],
    name: string,
    polls: number
  ) => {
    const { workspaceId } = mockDb.createWorkspace({ name });
    billingMock.setScenario(scenario);
    const setupId = await open(workspaceId, `key-${name}`);
    await call(`/v1/workspaces/${workspaceId}/billing/setups/${setupId}/card`, {
      method: "POST",
      body: {
        cardNumber: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "39",
        identity: "900101",
        passwordPrefix: "12",
      },
    });
    for (let i = 0; i < polls; i += 1)
      await call(`/v1/me/billing/setups/${setupId}`);
    return workspaceId;
  };
  billingMock.setScenario("ok");
  const canceled = await open(firstWorkspaceId, "key-canceled");
  await call(
    `/v1/workspaces/${firstWorkspaceId}/billing/setups/${canceled}/cancel`,
    { method: "POST" }
  );
  await open(firstWorkspaceId, "key-open");
  const created = [
    await run("ok", "결제 완료", 4),
    await run("decline", "결제 거절", 3),
    await run("unknown", "결제 확인 지연", 3),
    await run("lost", "권한 상실", 1),
    await run("refund", "결제 자동 취소", 5),
    await run("refund", "결제 취소 중", 3),
    await run("ok", "갱신 거절로 종료", 4),
  ];
  billingMock.setScenario("unpaid");
  await call(`/v1/workspaces/${created[created.length - 1]}/billing`);
  billingMock.setScenario(null);
  return created;
}

const KNOWN_ONE_SIDED = new Set([
  "WorkspaceBillingResponse.data.product.recordingAllowanceMinutes",
  "WorkspaceBillingResponse.data.detail.refundedAttempt.errorCode",
  "WorkspaceBillingResponse.data.detail.refundedAttempt.refundStatus",
  "WorkspaceBillingResponse.data.detail.refundedAttempt.refundOrigin",
  "WorkspaceBillingResponse.data.detail.latestAttempt.errorCode",
  "MeetingReviewSummaryResponse.data.agendas[].agendaItemId",
  "MeetingReviewSummaryResponse.data.agendas[].centerItemId",
  "MeetingReviewResponse.data.items[].replacements[].target.noteTitle",
  "MeetingReviewResponse.data.items[].replacements[].target.noteId",
  "ProjectMeetingLinksResponse.data.meetingLinks[].source.itemId",
  "ProjectMeetingLinksResponse.data.meetingLinks[].source.type",
  "ProjectMeetingLinksResponse.data.conflicts[].source.itemId",
  "ProjectMeetingLinksResponse.data.conflicts[].source.type",
  "NotificationListResponse.data.nextCreatedAt",
  "NotificationListResponse.data.nextNotificationId",
  "NoteListResponse.data.nextNoteId",
  "NoteListResponse.data.nextSortedAt",
  "WorkspaceTaskListResponse.data.nextDue",
  "WorkspaceTaskListResponse.data.nextTaskId",
  "AgentChatsResponse.data.nextUpdatedAt",
  "AgentChatsResponse.data.nextChatId",
  "WorkspaceGuestListResponse.data.nextDisplayName",
  "WorkspaceGuestListResponse.data.nextGuestId",
  "AgentChatMessagesResponse.data.lastTurn.pendingApproval",
  "AgentChatMessagesResponse.data.activeTurn.failureCode",
  "CurrentUserResponse.data.image",
  "CurrentUserResponse.data.language",
  "AuthSessionResponse.data.user.language",
  "AuthSessionResponse.data.user.image",
  "AnalysisResultResponse.data.retry.errorCode",
  "AnalysisResultResponse.data.retry.errorMessage",
  "NotificationSettingsResponse.data.marketingEmail.changedAt",
]);

const KNOWN_UNOBSERVED = new Set<string>([
  ...["agendaItemId", "centerItemId", "agendaId", "summary"].map(
    (field) => `MeetingReviewSummaryResponse.data.topics[].${field}`
  ),
  "AgentChatMessagesResponse.data.lastTurn.pendingApproval.args",
  "AgentChatMessagesResponse.data.lastTurn.pendingApproval.summary",
  ...[
    "",
    ".warning",
    ".body",
    ".target",
    ".items",
    ".items[].target",
    ...["", ".items[]"].flatMap((at) =>
      ["value", "before", "after", "added", "removed", "kept"].map(
        (key) => `${at}.fields[].${key}`
      )
    ),
  ].map(
    (rest) =>
      `AgentChatMessagesResponse.data.lastTurn.pendingApproval.card${rest}`
  ),
]);

const emptyField = {
  value: null,
  before: null,
  after: null,
  added: null,
  removed: null,
  kept: null,
};
const fullFields = [
  { ...emptyField, label: "제목", value: "APP 버그 수정" },
  { ...emptyField, label: "상태", before: "할 일", after: "진행 중" },
  {
    ...emptyField,
    label: "라벨",
    added: ["버그"],
    removed: ["기능"],
    kept: ["web"],
  },
];
const FULL_CARD = {
  title: "Linear 이슈 만들기",
  target: "앱 팀",
  warning: "되돌릴 수 없습니다",
  fields: fullFields,
  items: [
    { title: "APP-12", target: "앱 팀", fields: fullFields },
    { title: "APP-13", target: null, fields: [] },
  ],
  body: { label: "설명", text: "배포 전 확인 사항" },
};
const SPARSE_CARD = {
  title: "알림을 읽음으로 표시",
  target: null,
  warning: null,
  fields: [],
  items: null,
  body: null,
};

describe("nullable 목 표본", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => {
    mockDb.reset();
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  it("계약의 nullable 필드마다 null과 비-null을 모두 보여준다", async () => {
    const observed = new Map<string, { total: number; nulls: number }>();
    const { samples, skipped } = await contractSamples();
    const answered = new Set<string>();
    const patternViolations = new Set<string>();

    expect(skipped, "표본을 만들 수 없는 GET operation").toEqual([]);

    for (const [schemaName, url] of samples) {
      const schema = contract.components.schemas[schemaName];
      expect(schema, `계약에 ${schemaName}이 없습니다`).toBeDefined();

      const response = await fetch(`http://localhost${url}`);
      if (!response.ok) continue;
      answered.add(schemaName);
      const bodies = [await response.json()];
      if (
        schemaName === "MeetingReviewResponse" &&
        bodies[0].data.noteId === MENTORING_NOTE_ID
      ) {
        for (const fields of [
          {
            status: "COMPLETED",
            assignee: {
              value: { type: "USER", id: mockDb.getCurrentUser().userId },
            },
            due: { value: "2026-12-05" },
          },
          {
            status: null,
            assignee: { value: { type: "SPEAKER_LABEL", label: "B" } },
            due: { value: null },
          },
          { status: null, assignee: { value: null }, due: null },
          { status: null, assignee: null, due: null },
        ]) {
          const current = bodies.at(-1).data;
          const item = current.items.find(
            (row: { taskChanges: unknown[] }) => row.taskChanges.length > 0
          );
          const target = item.taskChanges[0].target;
          const saved = await fetch(
            `http://localhost/v1/notes/${MENTORING_NOTE_ID}/meeting-review/items/${item.itemId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                expectedReviewVersion: current.reviewVersion,
                expectedItemRevision: item.revision,
                decisions: [
                  {
                    targetId: target.itemId,
                    decision: "APPLY",
                    taskChange: {
                      expectedRevision: target.revision,
                      ...fields,
                    },
                  },
                ],
              }),
            }
          );
          expect(saved.status).toBe(200);
          bodies.push(await (await fetch(`http://localhost${url}`)).json());
        }
      }

      for (const body of bodies)
        for (const { leaf, pattern } of patternLeaves(schema)) {
          const regex = new RegExp(pattern);
          for (const value of valuesAt(body, leaf.split(".")))
            if (typeof value === "string" && !regex.test(value))
              patternViolations.add(`${schemaName}.${leaf} = ${value}`);
        }

      for (const body of bodies)
        for (const leaf of nullableLeaves(schema)) {
          if (leaf === "error") continue;
          const values = valuesAt(body, leaf.split("."));
          if (values.length === 0) continue;
          const key = `${schemaName}.${leaf}`;
          const entry = observed.get(key) ?? { total: 0, nulls: 0 };
          entry.total += values.length;
          const optional = optionalLeaf(schema, leaf.split("."));
          entry.nulls += values.filter(
            (value) => value === null || (optional && value === undefined)
          ).length;
          observed.set(key, entry);
        }
    }

    expect([...patternViolations], "계약 pattern 을 어긴 목 값").toEqual([]);

    const unanswered = [...new Set(samples.map(([schema]) => schema))].filter(
      (schema) => !answered.has(schema)
    );
    expect(unanswered, "200 응답을 한 번도 못 받은 스키마").toEqual([]);

    const expected = new Set(
      [...new Set(samples.map(([schema]) => schema))].flatMap((schemaName) =>
        nullableLeaves(contract.components.schemas[schemaName])
          .filter((leaf) => leaf !== "error")
          .map((leaf) => `${schemaName}.${leaf}`)
      )
    );
    const unobserved = [...expected].filter((key) => !observed.has(key));
    expect(
      unobserved.filter((key) => !KNOWN_UNOBSERVED.has(key)),
      "한 번도 관측되지 않은 nullable 필드"
    ).toEqual([]);
    expect(
      [...KNOWN_UNOBSERVED].filter((key) => !unobserved.includes(key)),
      "이제 관측되는데 KNOWN_UNOBSERVED에 남은 필드"
    ).toEqual([]);

    const oneSided = [...observed]
      .filter(([, v]) => v.nulls === 0 || v.nulls === v.total)
      .map(([key]) => key);

    expect(oneSided.filter((key) => !KNOWN_ONE_SIDED.has(key))).toEqual([]);
    expect(
      [...KNOWN_ONE_SIDED].filter((key) => !oneSided.includes(key))
    ).toEqual([]);
  });
});
