import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { KNOWN_EVENTS } from "@/lib/chat/stream-protocol";

const openapi = parse(readFileSync("openapi3.yml", "utf8"));
const asyncapi = parse(readFileSync("asyncapi.yml", "utf8"));

describe("REST and WebSocket contract consistency", () => {
  it("shares TSID and persisted final segment fields", () => {
    const rest = openapi.components.schemas;

    // Verify TSID pattern consistency
    const restTsidPattern =
      rest.TranscriptionSessionResponse.properties.data.properties.noteId
        .pattern;
    expect(asyncapi.components.schemas.Tsid.pattern).toBe(restTsidPattern);

    // 실시간 final 과 저장된 발화가 같은 필드를 갖는지 본다. 어긋나면 화면이 두 소스를
    // 한 목록에 섞을 때 한쪽만 있는 필드가 조용히 undefined 가 된다.
    // 손으로 speakerLabel 을 더하던 우회가 있었다. REST 계약이 그것을 required 로 안
    // 말해서였는데, 서버가 nullable + contractRequired 로 고치면서 필요 없어졌다 (APP-421).
    const restRequired = [
      ...rest.TranscriptResponse.properties.data.properties.segments.items
        .required,
    ].sort();
    const socketRequired = [
      ...asyncapi.components.messages.FinalEvent.payload.required,
    ]
      .filter((field) => !["type", "utteranceId"].includes(field))
      .sort();

    expect(socketRequired).toEqual(restRequired);
  });

  it("keeps meeting pause out of the realtime protocol", () => {
    const eventTypes = Object.values(
      asyncapi.components.messages as Record<
        string,
        { payload?: { properties?: { type?: { enum?: string[] } } } }
      >
    ).flatMap(
      (message: { payload?: { properties?: { type?: { enum?: string[] } } } }) =>
        message.payload?.properties?.type?.enum ?? []
    );

    expect(eventTypes).not.toContain("meeting.paused");
    expect(eventTypes).toEqual(
      expect.arrayContaining(["recording.started", "recording.stopped"])
    );
  });

  it("binds note topics to STOMP and chat streams to the SSE edge", () => {
    expect(asyncapi.channels.noteTopic.servers).toEqual([
      { $ref: "#/servers/production" },
    ]);
    expect(asyncapi.channels.agentChatStream.servers).toEqual([
      { $ref: "#/servers/sseEdge" },
    ]);
  });
});

describe("chat SSE contract", () => {
  /**
   * **층 하나만 보면 나머지에 남는다.** 채널만 지우고 operation·message·REST 경로가
   * 남아 있어도 채널 검사는 초록이다 — 걷어낸 것은 네 곳에서 함께 사라져야 한다.
   */
  it("채널이 하나다 — 공유 챗봇이 층마다 사라졌다", () => {
    expect(Object.keys(asyncapi.channels)).toEqual(
      expect.arrayContaining(["agentChatStream"])
    );
    expect(Object.keys(asyncapi.channels)).not.toContain("noteSharedChatStream");
    expect(Object.keys(asyncapi.operations)).not.toContain(
      "receiveNoteSharedChatEvents"
    );
    expect(Object.keys(asyncapi.components.messages).join(",")).not.toMatch(
      /NoteChat/
    );
    expect(Object.keys(openapi.paths)).not.toContain(
      "/v1/notes/{noteId}/chat/messages"
    );
  });

  /**
   * ★ **「모르는 이벤트를 조용히 삼킨다」의 구조적 방어.**
   *
   * 계약에만 있고 화면에는 없는 상태가 오래 가는 것을 막는다 — 실제로 `thinking_delta`가
   * 그랬다. 양쪽을 기계로 대조하면 계약에 이벤트를 더하는 순간 이 검사가 빨개진다.
   */
  it("asyncapi 의 이벤트와 리듀서가 아는 이벤트가 같다", () => {
    // 채널이 참조하는 것만 본다. `components.messages`에는 전사 채널 것도 함께 있다.
    const declared = new Set(
      Object.keys(asyncapi.channels.agentChatStream.messages).map(
        (key) => asyncapi.components.messages[key].name
      )
    );
    expect(declared).toEqual(KNOWN_EVENTS);
  });

  /**
   * ★ **봉투를 안 씌운다** (`03-계약 §3`). 번호를 `id:` 줄과 payload 두 곳에 두면
   * 언젠가 갈리고, 그때 커서가 어느 쪽을 믿을지가 코드마다 달라진다.
   *
   * 리듀서 쪽은 `stream-protocol.test.ts` 가 본다. 여기서 보는 것은 **계약이 그렇게
   * 적혀 있나**다 — 예시가 봉투를 쓰기 시작하면 그것이 곧 계약 변경이다.
   */
  it("커서가 id: 줄에 있고 data 안에는 없다", () => {
    const frame =
      openapi.paths["/v1/agent-chats/{chatId}/messages"].post.responses["200"]
        .content["text/event-stream"].examples.sendAgentChatMessage_Success
        .value;

    expect(frame).toContain("id:129");
    expect(frame).toContain('data:{"turnId":"0K9GVJT2C4Q3B","startSeq":128}');
    expect(frame).not.toContain('"payload"');
  });

  /**
   * ★ **이어받기는 셋이 함께 있어야 성립한다** — 좌표(`cursor`)와 물을 자리(`?after=`)와
   * 「지금 뭐가 도나」(`activeTurn`). 하나만 빠져도 재진입이 원리적으로 불가능한데,
   * 각각은 다른 화면이 쓰는 값이라 하나가 빠져도 나머지 화면은 멀쩡해 보인다.
   */
  it("이어받기 경로가 온전하다 — cursor · ?after= · activeTurn", () => {
    const data =
      openapi.components.schemas.AgentChatMessagesResponse.properties.data;

    expect(data.required).toContain("cursor");
    expect(Object.keys(data.properties)).toEqual(
      expect.arrayContaining(["cursor", "activeTurn", "lastTurn"])
    );
    // 진행 중 턴의 행은 스트림 백로그로도 온다. 이 값이 없으면 도구 카드가 두 벌 그려진다.
    expect(data.properties.messages.items.properties.turnId).toBeDefined();

    const events = openapi.paths["/v1/agent-chats/{chatId}/events"].get;
    expect(events.parameters.map((each: { name: string }) => each.name)).toEqual(
      expect.arrayContaining(["chatId", "after"])
    );
    expect(
      openapi.paths["/v1/agent-chats/{chatId}/turns/{turnId}/cancel"].post
        .operationId
    ).toBe("cancelAgentChatTurn");
  });

  /**
   * **모양이 갈리는 것은 이름이 갈리는 것보다 늦게 들킨다.** 이벤트 하나가 통째로
   * 없으면 화면이 즉시 죽지만, 필드가 참조를 잃거나 타입이 바뀌면 목이 계약대로
   * 답하는 동안 조용히 산다.
   *
   * `ScopeMiss` 는 여기서 안 본다 — 낼 쪽이 없어 계약에만 남은 필드다
   * (`변경사항/계약-어긋남.md`). 못박으면 걷을 때 이 검사가 막는다.
   */
  it("범위 턴의 payload 필드가 선언돼 있다", () => {
    expect(
      asyncapi.components.messages.MessageEnd.payload.properties.refs.items.$ref
    ).toBe("#/components/schemas/NoteRef");
    expect(
      asyncapi.components.messages.ToolCallStart.payload.properties.target
        .allOf[0].$ref
    ).toBe("#/components/schemas/ToolTarget");

    // kind 를 enum 으로 닫으면 도구가 늘 때마다 web 배포가 ai 배포에 묶인다.
    expect(
      asyncapi.components.schemas.ToolTarget.properties.kind.enum
    ).toBeUndefined();

    expect(
      openapi.paths["/v1/agent-chats/{chatId}/messages"].post.requestBody
        .content["application/json"].schema.$ref
    ).toBe("#/components/schemas/SendAgentChatMessageRequest");
    expect(
      Object.keys(
        openapi.components.schemas.SendAgentChatMessageRequest.properties
      )
    ).toEqual(expect.arrayContaining(["message", "noteIds", "projectIds"]));
  });
});
