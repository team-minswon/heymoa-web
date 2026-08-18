import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

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

  // 공유 챗의 `lock`은 아무도 안 잡으면 전부 null이다. 남의 잠금과 승인 대기를 심어
  // 비-null 쪽을 만든다.
  mockDb.seedForeignLock(notes[0], "한지원");
  mockDb.setSharedChatPendingApproval(notes[0], {
    approvalId: "01K0000000030",
    tool: "linear_create_issue",
    summary: "APP-12 이슈를 만듭니다.",
  });
  // `summary`는 계약상 nullable이다 — 없는 쪽 표본을 다른 노트에 심는다.
  mockDb.setSharedChatPendingApproval(notes[3], {
    approvalId: "01K0000000031",
    tool: "linear_create_issue",
    summary: null,
  });

  // 채팅은 시드에 없다. 두 스코프를 다 만들어야 `workspaceId`·`noteId`가 양쪽으로 나온다.
  const chatIds = [
    mockDb.createAgentChat({
      scope: "workspace",
      workspaceId: workspaces[0].workspaceId,
    }).chatId,
    mockDb.createAgentChat({ scope: "note", noteId: notes[0] }).chatId,
  ];

  /**
   * 메시지가 없으면 `messages[]` 안의 nullable 필드는 값이 0개라 관측조차 안 된다.
   * `toolEvent`의 `decision`과 `status`는 서로 배타라(승인 확정이면 decision, 실행 결과면
   * status) 기록 둘을 다 넣어야 양쪽이 나온다. `url`도 실행 기록에만 있다.
   */
  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "USER",
    content: "논의된 이슈를 만들어줘",
    toolEvent: null,
  });
  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "TOOL",
    content: "이슈 생성을 승인했습니다.",
    toolEvent: {
      tool: "linear_create_issue",
      decision: "APPROVED",
      status: null,
      url: null,
    },
  });
  mockDb.appendAgentChatMessage(chatIds[0], {
    role: "TOOL",
    content: "APP-12 생성됨",
    toolEvent: {
      tool: "linear_create_issue",
      decision: null,
      status: "success",
      url: "https://linear.app/minswon/issue/APP-12",
    },
  });

  // 공유 챗은 `authorName`도 nullable이다 — USER는 값, ASSISTANT/TOOL은 null이다.
  mockDb.appendSharedChatMessage(notes[0], {
    role: "USER",
    content: "이번 회의에서 정한 것만 정리해줘",
    authorName: "테스트 유저",
    toolEvent: null,
  });
  mockDb.appendSharedChatMessage(notes[0], {
    role: "TOOL",
    content: "APP-13 생성됨",
    authorName: null,
    toolEvent: {
      tool: "linear_create_issue",
      decision: null,
      status: "success",
      url: "https://linear.app/minswon/issue/APP-13",
    },
  });
  mockDb.appendSharedChatMessage(notes[0], {
    role: "TOOL",
    content: "이슈 생성을 승인했습니다.",
    authorName: null,
    toolEvent: {
      tool: "linear_create_issue",
      decision: "APPROVED",
      status: null,
      url: null,
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
  const requiredQuerySamples: Record<string, string[]> = {
    "/v1/agent-chats/active": [
      `?scope=workspace&workspaceId=${workspaces[0].workspaceId}`,
      `?scope=note&noteId=${notes[0]}`,
      // `data` 자체가 nullable이다 — 활성 챗을 만들지 않은 워크스페이스가 null 쪽 표본이다.
      `?scope=workspace&workspaceId=${workspaces[1].workspaceId}`,
    ],
  };

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
  "CurrentUserResponse.data.image",
  // `createAgentChat`이 `title: null`로만 만든다 — 목에 제목을 붙이는 수단이 없다.
  "AgentChatV2NullableResponse.data.title",
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
const KNOWN_UNOBSERVED = new Set<string>([]);

describe("nullable 목 표본", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => mockDb.reset());
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
