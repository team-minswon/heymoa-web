import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { hintedInterval, SAFETY_NET_MS } from "@/lib/events/interval";
import {
  filterOf,
  OWNED_TARGET,
  targetsForHint,
} from "@/lib/events/invalidation";
import { parseUserEvent, USER_EVENT_NAMES } from "@/lib/events/protocol";

const frame = (event: string, data: unknown) => ({
  event,
  data: JSON.stringify(data),
});

describe("protocol", () => {
  it("아는 힌트를 읽고, 모르는 이름·깨진 본문·하트비트는 null, 모르는 필드는 버린다", () => {
    expect(
      parseUserEvent(
        frame("note.changed", {
          workspaceId: "W",
          noteId: "N",
          aspects: ["analysis"],
          extra: 1,
        })
      )
    ).toEqual({
      type: "note.changed",
      workspaceId: "W",
      noteId: "N",
      aspects: ["analysis"],
    });
    expect(parseUserEvent(frame("someday.changed", {}))).toBeNull();
    expect(parseUserEvent({ event: "note.changed", data: "{" })).toBeNull();
    expect(parseUserEvent({ event: "heartbeat", data: "{}" })).toBeNull();
    expect(parseUserEvent(frame("notifications.changed", {}))).toEqual({
      type: "notifications.changed",
    });
  });

  it("계약(/v1/events 설명)의 이벤트 이름과 protocol 이 같다", () => {
    const contract = parse(readFileSync("openapi3.yml", "utf8"));
    const description: string = contract.paths["/v1/events"].get.description;
    const named = new Set(
      description.match(/\b(ready|resync|degraded|[a-z]+\.changed)\b/g)
    );
    expect([...named].sort()).toEqual([...USER_EVENT_NAMES].sort());
  });
});

describe("힌트 → 다시 읽을 쿼리", () => {
  const closed = { isNoteSocketOpen: () => false };
  const open = { isNoteSocketOpen: (id: string) => id === "N" };

  it.each([
    [
      {
        type: "note.changed",
        workspaceId: "W",
        noteId: "N",
        aspects: ["analysis"],
      },
      closed,
      ["analysis:N"],
    ],
    [
      {
        type: "note.changed",
        workspaceId: "W",
        noteId: "N",
        aspects: ["meeting"],
      },
      closed,
      ["note:N", "notes:ws:W"],
    ],
    // 노트 소켓이 열린 노트의 회의 상태는 STOMP 가 이미 무효화한다.
    [
      {
        type: "note.changed",
        workspaceId: "W",
        noteId: "N",
        aspects: ["meeting", "analysis"],
      },
      open,
      ["analysis:N"],
    ],
    [
      {
        type: "note.changed",
        workspaceId: "W",
        noteId: "N",
        aspects: ["transcript"],
      },
      closed,
      [],
    ],
    [{ type: "notes.changed", workspaceId: "W" }, closed, ["notes:ws:W"]],
    [
      { type: "notes.changed", workspaceId: "W", projectId: "P" },
      closed,
      ["notes:ws:W", "notes:project:P"],
    ],
    [{ type: "chats.changed", workspaceId: "W" }, closed, ["chats:W"]],
    [{ type: "notifications.changed" }, closed, ["notifications"]],
    [{ type: "membership.changed", workspaceId: "W" }, closed, ["workspaces"]],
  ] as const)("%o", (hint, context, expected) => {
    expect(
      targetsForHint(hint as Parameters<typeof targetsForHint>[0], context)
    ).toEqual(expected);
  });

  it("대상은 그 쿼리만 집고 나머지는 건드리지 않는다", () => {
    const client = new QueryClient();
    const keys = [
      ["/v1/notes/N/analyses/flow"],
      ["/v1/notes/N/analyses/latest"],
      ["/v1/notes/N"],
      ["/v1/notes/N/transcript"],
      ["/v1/notes/M/analyses/flow"],
      ["/v1/workspaces/W/notes", { pages: 1 }],
      ["/v1/projects/P/notes"],
      ["/v1/workspaces/W/agent-chats", { limit: 50 }],
      ["/v1/notifications/unread-count", { schema: "2" }],
      ["/v1/notifications", { filter: "ALL" }],
      ["/v1/notifications", { filter: "ALL" }, "head"],
      ["/v1/workspaces"],
      ["/v1/workspaces/W"],
    ];
    for (const key of keys) client.setQueryData(key, 1);
    const hit = (target: string) =>
      client
        .getQueryCache()
        .findAll(filterOf(target))
        .map((query) => JSON.stringify(query.queryKey));
    expect(hit("analysis:N")).toEqual([
      JSON.stringify(keys[0]),
      JSON.stringify(keys[1]),
    ]);
    expect(hit("note:N")).toEqual([JSON.stringify(keys[2])]);
    expect(hit("notes:ws:W")).toEqual([JSON.stringify(keys[5])]);
    expect(hit("chats:W")).toEqual([JSON.stringify(keys[7])]);
    // 불러온 알림 목록(무한 쿼리)은 다시 읽지 않는다 — 개수와 열린 모달의 첫 쪽만.
    expect(hit("notifications")).toEqual([
      JSON.stringify(keys[8]),
      JSON.stringify(keys[10]),
    ]);
    expect(hit("workspaces")).toEqual([JSON.stringify(keys[11])]);
    expect(hit(OWNED_TARGET)).toHaveLength(10);
  });
});

describe("hintedInterval", () => {
  it("건강하면 안전망, 아니면 원래 간격, 게이트가 닫혔으면 그대로", () => {
    expect(hintedInterval(true, 3_000)).toBe(SAFETY_NET_MS);
    expect(hintedInterval(false, 3_000)).toBe(3_000);
    expect(hintedInterval(true, false)).toBe(false);
    expect(hintedInterval(true, 120_000)).toBe(120_000);
  });
});
