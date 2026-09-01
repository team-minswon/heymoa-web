import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { CONTEXT_SNAPSHOT } from "@/lib/mocks/context-candidates";
import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";
import {
  resetChatStreamsForTests,
  seedAgentChatTurnForTests,
} from "@/lib/mocks/sse-handler";

/**
 * 계약에서 `nullable: true`인 필드는 실서버가 null을 줄 수 있다는 뜻이다. 목이 한쪽 값만
 * 주면 화면의 반대쪽 분기는 411개 테스트를 다 통과하고 실서버에서 처음 실행된다.
 * 여기서 "목이 양쪽을 다 보여주는가"를 지킨다 — 화면 검증이 아니라 **표본 검증**이다.
 *
 * 시드만 찌르면 오판한다 (`startedAt` 같은 필드는 `createSession`이 런타임에 null로 만든다).
 * 그래서 목록·상세를 전수로 훑고, 세션은 생성 직후 상태까지 함께 본다.
 */
const server = setupServer(...restHandlers);
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

type GetOperation = {
  path: string;
  schema: string;
  params: string[];
  requiredQuery: string[];
};

/** 계약의 GET operation에서 `{param}`·필수 query·200 응답 스키마를 뽑는다. */
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
    if (!ref) continue; // 리다이렉트 계열(`/authorize`·`/callback`)은 JSON 본문이 없다
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

/**
 * 시드의 모든 엔티티 조합으로 GET operation마다 URL을 만든다. 손으로 나열하지 않는 이유는
 * 새 엔드포인트가 계약에 생겼을 때 목록에서 빠져 게이트가 조용히 좁아지기 때문이다.
 *
 * 채울 수 없는 `{param}`이 남은 operation은 `skipped`로 돌려준다 — 조용히 빠뜨리면
 * "전부 검사했다"로 읽힌다.
 */
function contractSamples() {
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

  const notes = tuples.filter((tuple) => tuple.noteId).map((t) => t.noteId!);

  // 현재 유저가 시작·종료할 수 있는 노트는 미시작이거나 현재 유저가 시작한 진행 중 노트다.
  // **위치가 아니라 상태로 고른다** —
  // 시드에 종료된 노트가 늘면 `notes[0]`이 그쪽으로 바뀌어 표본 생성이 통째로 깨진다.
  // 현재 목 DB의 정본인 상세 상태로 고른다.
  const currentUserId = mockDb.getCurrentUser().userId;
  const operable = notes.filter((noteId) => {
    const note = mockDb.getNote(noteId);
    return (
      note.meetingStatus === "NOT_STARTED" ||
      (note.meetingStatus === "IN_PROGRESS" &&
        note.meetingStartedBy?.userId === currentUserId)
    );
  });

  // 분석은 시드에 없어 모든 노트가 404다. 회의를 끝내 두 표본을 만든다 — **목에서 회의를
  // 끝낼 수 있는 노트가 넷뿐이고 둘은 아래 세션이 쓴다.** 그래서 이 둘에 최대한 담는다.
  //
  //   [0] FAILED           → 결과 `errorCode`·`errorMessage`의 비-null 쪽, `retry`의 null 쪽
  //   [1] SUCCEEDED + 재요약 진행 중 → 그 반대쪽과 `retry`의 비-null 쪽
  for (const [index, noteId] of [operable[0], operable[1]].entries()) {
    const session = mockDb.createSession(noteId);
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
    mockDb.endMeeting(noteId);
    if (index === 0) {
      mockDb.failAnalysis(noteId);
      continue;
    }
    mockDb.advanceAnalysis(noteId);
    // 요약은 마지막 성공본 하나이므로 이 노트의 본문은 그대로고 `retry`만 붙는다 (APP-421).
    mockDb.requestAnalysis(noteId);
  }
  // READY 세션은 마지막에 만든다 — 전역 가드가 위 endMeeting들을 막지 않게. 이 세션이
  // `startedAt`·`endedAt`·`endReason`의 null 쪽 표본이다.
  // 방금 종료한 둘 말고 아직 진행 중인 노트에 만든다 — 종료된 회의는 세션을 못 만든다.
  const unstartedSession = mockDb.createSession(operable[2]);
  mockDb.updateSessionStatus(unstartedSession.sessionId, "COMPLETED");
  const activeSession = mockDb.createSession(operable[3]);
  mockDb.updateSessionStatus(activeSession.sessionId, "ACTIVE");
  const sessionIds = [
    "01K0000000010",
    unstartedSession.sessionId,
    activeSession.sessionId,
  ];

  // 연동은 목이 둘 다 미연동으로 시작한다 — 하나를 연결해 `connectedAt`·`connectedBy`의
  // 비-null 쪽을 만든다.
  mockDb.connectIntegration(workspaces[0].workspaceId, "LINEAR");

  /**
   * 후보 revision 이력은 `{candidateId}` 가 있어야 부를 수 있다. **id 를 손으로 박지
   * 않는다** — 목이 바뀌면 조용히 빈 응답을 부르게 되고, 그러면 nullable 표본이 0개인데도
   * 이 테스트가 통과한다.
   *
   * 목 스냅샷에서 **필요한 성질별로 하나씩** 고른다. `closeReason` 과
   * `resolvesCandidateId` 가 둘 다 nullable 이라 양쪽 값을 내는 후보가 함께 있어야 한다.
   */
  const candidateIds = [
    ...new Set(
      [
        CONTEXT_SNAPSHOT.candidates.find((c) => c.closeReason !== null),
        CONTEXT_SNAPSHOT.candidates.find((c) => c.resolvesCandidateId !== null),
        CONTEXT_SNAPSHOT.candidates.find(
          (c) => c.closeReason === null && c.resolvesCandidateId === null
        ),
      ]
        .filter((c) => c !== undefined)
        .map((c) => c.candidateId)
    ),
  ];

  /**
   * 채팅은 시드에 없다. **다섯을 만든다** — 이어받기 필드(`activeTurn`·`lastTurn`)는 턴
   * 상태에서 나오는데 한 대화가 한 조합만 보여 줄 수 있어서다. 정지 상태의 GET만으로는
   * 전부 null이라 「목이 양쪽을 다 보여주는가」가 거짓말이 된다.
   *
   *   [0] 턴 없음        → activeTurn·lastTurn 의 null 쪽. 히스토리도 이 대화에 담는다
   *   [1] 도는 턴 + 승인  → pendingApproval·summary 의 비-null 쪽
   *   [2] 도는 턴만       → 그 셋의 null 쪽
   *   [3] 도는 턴 + 요약 없는 승인 → pendingApproval.summary 의 null 쪽
   *   [4] 실패로 끝난 턴  → lastTurn.failureCode·retryable 의 비-null 쪽
   */
  const chatIds = Array.from(
    { length: 5 },
    () => mockDb.createAgentChat({ workspaceId: workspaces[0].workspaceId }).chatId
  );
  const approval = {
    approvalId: "0K9GVJT2C4Q7F",
    tool: "linear.create_issue",
  };
  seedAgentChatTurnForTests(chatIds[1], {
    // 인자가 있는 승인 — 카드가 「무엇을 승인하나」를 말하는 쪽.
    pendingApproval: {
      ...approval,
      summary: "이슈를 만들까요?",
      args: { projectId: "0HZX2K7M9Q4AE", title: "APP 버그 수정" },
    },
  });
  seedAgentChatTurnForTests(chatIds[2], {});
  seedAgentChatTurnForTests(chatIds[3], {
    // 인자도 요약도 없는 승인 — 도구 id 만으로 묻는 쪽.
    pendingApproval: { ...approval, summary: null, args: null },
  });
  seedAgentChatTurnForTests(chatIds[4], {
    status: "FAILED",
    failureCode: "UPSTREAM_ERROR",
    retryable: true,
  });

  /**
   * 메시지가 없으면 `messages[]` 안의 nullable 필드는 값이 0개라 관측조차 안 된다.
   * `toolEvent`의 `decision`과 `status`는 서로 배타라(승인 확정이면 decision, 실행 결과면
   * status) 기록 둘을 다 넣어야 양쪽이 나온다. `url`도 실행 기록에만 있다.
   */
  // `scope[].title`은 nullable이다 — 지워졌거나 권한이 없으면 제목을 안 싣는다.
  // 둘을 한 메시지에 담아 null·비-null 양쪽을 만든다.
  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "USER",
    scope: [
      { kind: "NOTE", id: notes[0], title: "주간 배포 회의", unavailable: false },
      { kind: "NOTE", id: "01KDELETED0000", title: null, unavailable: true },
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
    },
  });
  // `turnId`도 nullable이다 — 위 둘은 안 싣고(null 쪽) 이 행만 싣는다(비-null 쪽).
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
    },
  });

  // 시드의 초대는 받은 것(다른 워크스페이스) 하나뿐이라 `/invitations`가 비어 있다.
  mockDb.createInvitation(workspaces[0].workspaceId, {
    email: "invitee@heymoa.com",
    role: "MEMBER",
  });

  /**
   * 필수 query가 있는 operation은 경로만으로는 **계약을 어기는 요청**이다. 자동 루프에
   * 넣으면 목이 기본값을 적용해 돌려주는 계약 위반 응답(예: `scope` 없이 200 + `data: null`)을
   * 유효한 null 표본으로 세게 되고, 핸들러를 계약대로 400으로 고치는 순간 이 테스트가
   * 정상 변경을 막는다. 그래서 여기 손으로 적은 유효 요청만 쓴다.
   */
  // 지금은 비어 있다 — 대화 목록이 `/v1/workspaces/{workspaceId}/agent-chats`로 옮겨가면서
  // 마지막 항목이 빠졌다. 그 경로는 `{workspaceId}`가 `tuples`에서 자동으로 채워지고, 대화를
  // 하나도 안 만든 워크스페이스까지 표본에 든다. 비었다고 이 갈래를 지우지 않는다 — 필수
  // query를 가진 GET이 계약에 생기면 여기 없다는 이유로 `skipped`가 그것을 드러낸다.
  const requiredQuerySamples: Record<string, string[]> = {};

  const samples: Array<[string, string]> = [];
  const skipped: string[] = [];
  for (const { path, schema, params, requiredQuery } of jsonGetOperations()) {
    if (requiredQuery.length > 0) {
      const queries = requiredQuerySamples[path];
      if (!queries) {
        skipped.push(`${path} — 필수 query ${requiredQuery}의 표본이 없습니다`);
        continue;
      }
      for (const query of queries) samples.push([schema, `${path}${query}`]);
      continue;
    }
    // 파라미터가 없는 operation은 시드 조합과 무관하게 한 번만 부른다.
    const candidates = params.length === 0 ? [{}] : tuples;
    let filled = 0;
    for (const tuple of candidates) {
      const values: Record<string, string[]> = {
        ...Object.fromEntries(
          Object.entries(tuple).map(([key, value]) => [key, [value]])
        ),
        sessionId: sessionIds,
        chatId: chatIds,
        candidateId: candidateIds,
      };
      if (params.some((param) => !values[param]?.length)) continue;
      // 한 operation의 `{param}` 조합을 전개한다 (sessionId처럼 값이 여럿일 수 있다).
      let urls = [path];
      for (const param of params) {
        urls = urls.flatMap((url) =>
          values[param].map((value) => url.replace(`{${param}}`, value))
        );
      }
      for (const url of urls) samples.push([schema, url]);
      filled += urls.length;
    }
    if (filled === 0) skipped.push(`${path} — 채울 수 없는 param: ${params}`);
  }
  return {
    samples: [...new Map(samples.map((s) => [s[1], s])).values()],
    skipped,
  };
}

/**
 * 양쪽 표본이 구조적으로 불가능한 필드만 남긴다. **늘리면 이 테스트가 깨진다** — 새로 심은
 * 목이 한쪽 값만 준다는 뜻이다. 반대로 줄면 여기서 지워야 목록이 거짓말을 하지 않는다.
 *
 * `CurrentUserResponse`는 목 유저가 하나라 `image`가 한쪽밖에 안 나온다. 실서버는 Google
 * 로그인이라 값이 오는 쪽이 정상이다. null 쪽 표본은 멤버 목록 응답(`한지원`)에 있지만
 * `members-settings`가 아직 아바타를 그리지 않아 화면에서는 지나지 않는다.
 */
const KNOWN_ONE_SIDED = new Set([
  // **server 가 늘 `null` 을 보낸다.** 계약이 선언만 하고 채우는 경로가 없다
  // (`변경사항/계약-어긋남.md` 6번 「스키마만 넓다」). 고칠 자리는 server 의
  // `turnFields()` 헬퍼이고, 그때 이 줄을 지운다.
  "AgentChatMessagesResponse.data.lastTurn.pendingApproval",
  // **도는 턴에는 실패 코드가 없다.** `activeTurn` 은 정의상 아직 안 끝났으므로
  // 이 값은 늘 `null` 이다 — 목이 좁은 게 아니라 뜻이 그렇다. 값이 서는 자리는
  // `lastTurn.failureCode` 와 `turn_failed` 프레임이고 그쪽은 양쪽 다 관측된다.
  "AgentChatMessagesResponse.data.activeTurn.failureCode",
  "CurrentUserResponse.data.image",
  // 목은 현재 유저의 열린 세션을 하나만 허용한다. 같은 스냅샷에서 READY(null)와
  // ACTIVE(값 있음)를 동시에 만들 수 없어 REST Docs가 nullable 양쪽 계약을 맡는다.
  "CurrentTranscriptionSessionNullableResponse.data.startedAt",
  // 재요약의 오류 두 필드는 **실패한 재요약** 표본이 있어야 비-null이 나오는데, 회의를
  // 끝낼 수 있는 목 노트가 넷뿐이고 둘은 세션이 쓴다. 남은 둘에는 「실패한 분석」과
  // 「진행 중인 재요약」을 담았다 — 셋째 조합을 놓을 노트가 없다 (APP-421).
  "AnalysisResultResponse.data.retry.errorCode",
  "AnalysisResultResponse.data.retry.errorMessage",
]);

/** 표본에서 한 번도 관측되지 않는 필드. 비어 있어야 정상이고, 늘면 게이트가 좁아진 것이다. */
const KNOWN_UNOBSERVED = new Set<string>([
  // **server 가 `lastTurn.pendingApproval` 에 늘 `null` 을 보낸다.** 계약이 선언만 하고
  // 채우는 경로가 없어서, 그 아래 필드는 목이 무엇을 해도 관측될 수 없다.
  // 목을 억지로 채우면 **실서버가 안 내는 모양을 화면이 믿게 된다** — 그게 이 프로젝트가
  // 계약 감사에서 찾은 병이다(`변경사항/계약-어긋남.md` 6번, 「스키마만 넓다」).
  // 고칠 자리는 server 의 `turnFields()` 헬퍼이고, 그때 이 둘을 여기서 지운다.
  "AgentChatMessagesResponse.data.lastTurn.pendingApproval.args",
  "AgentChatMessagesResponse.data.lastTurn.pendingApproval.summary",
]);

describe("nullable 목 표본", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  // 목 DB는 리셋하면 같은 chatId를 다시 발급하므로 스트림 상태도 짝으로 비운다.
  afterEach(() => {
    mockDb.reset();
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  it("계약의 nullable 필드마다 null과 비-null을 모두 보여준다", async () => {
    const observed = new Map<string, { total: number; nulls: number }>();
    const { samples, skipped } = contractSamples();
    const answered = new Set<string>();

    // 조용히 좁아지지 않게 못 부른 operation을 남긴다.
    expect(skipped, "표본을 만들 수 없는 GET operation").toEqual([]);

    for (const [schemaName, url] of samples) {
      const schema = contract.components.schemas[schemaName];
      expect(schema, `계약에 ${schemaName}이 없습니다`).toBeDefined();

      const response = await fetch(`http://localhost${url}`);
      // 404는 정상 응답인 operation이 있다 (분석 없는 노트의 `/analyses/latest`).
      // 그래서 개별 URL은 봐주고, 아래에서 스키마별로 200을 한 번은 받았는지 본다.
      if (!response.ok) continue;
      answered.add(schemaName);
      const body = await response.json();

      for (const leaf of nullableLeaves(schema)) {
        if (leaf === "error") continue; // 성공 응답의 봉투는 언제나 null이다
        const values = valuesAt(body, leaf.split("."));
        if (values.length === 0) continue;
        const key = `${schemaName}.${leaf}`;
        const entry = observed.get(key) ?? { total: 0, nulls: 0 };
        entry.total += values.length;
        entry.nulls += values.filter((value) => value === null).length;
        observed.set(key, entry);
      }
    }

    // 200을 한 번도 못 받은 스키마가 있으면 그 응답은 통째로 미검사다.
    const unanswered = [...new Set(samples.map(([schema]) => schema))].filter(
      (schema) => !answered.has(schema)
    );
    expect(unanswered, "200 응답을 한 번도 못 받은 스키마").toEqual([]);

    /**
     * 빈 배열 안의 필드는 값이 0개라 위 루프가 아무것도 세지 않는다. 그대로 두면 관측조차
     * 안 된 필드가 `oneSided`에도 안 들어가 "검사했다"로 읽힌다 — 계약에서 기대한 키와
     * 대조해 0회 관측을 드러낸다.
     */
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

    // 알려진 것보다 늘어났으면 새로 심은 목이 한쪽 값만 준다는 뜻이다.
    expect(oneSided.filter((key) => !KNOWN_ONE_SIDED.has(key))).toEqual([]);
    // 줄었으면 KNOWN_ONE_SIDED에서 지워야 목록이 거짓말을 하지 않는다.
    expect(
      [...KNOWN_ONE_SIDED].filter((key) => !oneSided.includes(key))
    ).toEqual([]);
  });
});
