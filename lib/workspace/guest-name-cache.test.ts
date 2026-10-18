import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { writeGuestName } from "@/lib/workspace/guest-name-cache";

const GUEST = "0HZX2K7M9Q4AR";
const OTHER = "0HZX2K7M9Q4AS";
const PARTICIPANT = "0HZX2K7M9Q4BA";

function ok(data: unknown) {
  return { status: 200, data: { success: true, data } };
}

function seed() {
  const client = new QueryClient();
  client.setQueryData(
    ["/v1/workspaces/W/guests"],
    ok({
      guests: [
        { guestId: GUEST, displayName: "박서준", noteCount: 1 },
        { guestId: OTHER, displayName: "김민수", noteCount: 0 },
      ],
    })
  );
  client.setQueryData(
    ["/v1/workspaces/W/guests", { limit: 30, pages: 1 }],
    ok({ guests: [{ guestId: GUEST, displayName: "박서준", noteCount: 1 }] })
  );
  client.setQueryData(
    ["/v1/notes/N"],
    ok({
      participants: [
        {
          participantId: PARTICIPANT,
          guestId: GUEST,
          userId: null,
          name: "박서준",
        },
        { participantId: "P2", guestId: OTHER, userId: null, name: "김민수" },
      ],
    })
  );
  client.setQueryData(
    ["/v1/notes/N/transcript"],
    ok({
      diarization: {
        speakers: [
          {
            label: "A",
            assignedParticipantId: PARTICIPANT,
            assignedName: "박서준",
          },
          { label: "B", assignedParticipantId: "P2", assignedName: "김민수" },
        ],
      },
    })
  );
  client.setQueryData(
    ["/v1/projects/P/notes"],
    ok({
      notes: [
        {
          noteId: "N",
          participants: [
            { participantId: PARTICIPANT, guestId: GUEST, name: "박서준" },
          ],
        },
      ],
    })
  );
  client.setQueryData(
    ["/v1/projects/P/tasks"],
    ok({
      tasks: [
        {
          taskId: "T1",
          assignee: { type: "GUEST", id: GUEST, name: "박서준" },
        },
        { taskId: "T2", assignee: { type: "USER", id: GUEST, name: "계정" } },
      ],
    })
  );
  return client;
}

describe("writeGuestName", () => {
  it("목록·참여자·화자의 이름을 직접 고치고 다른 사람은 건드리지 않는다", () => {
    const client = seed();

    writeGuestName(client, { guestId: GUEST, displayName: "박서준(수정)" });

    const guests = (key: unknown[]) =>
      (client.getQueryData(key) as ReturnType<typeof ok>).data.data as {
        guests: { guestId: string; displayName: string }[];
      };
    expect(
      guests(["/v1/workspaces/W/guests"]).guests.map((g) => g.displayName)
    ).toEqual(["박서준(수정)", "김민수"]);
    expect(
      guests(["/v1/workspaces/W/guests", { limit: 30, pages: 1 }]).guests[0]
        .displayName
    ).toBe("박서준(수정)");
    expect(JSON.stringify(client.getQueryData(["/v1/notes/N"]))).toContain(
      '"name":"박서준(수정)"'
    );
    expect(JSON.stringify(client.getQueryData(["/v1/notes/N"]))).toContain(
      '"name":"김민수"'
    );
    const transcript = JSON.stringify(
      client.getQueryData(["/v1/notes/N/transcript"])
    );
    expect(transcript).toContain('"assignedName":"박서준(수정)"');
    expect(transcript).toContain('"assignedName":"김민수"');
    expect(
      JSON.stringify(client.getQueryData(["/v1/projects/P/notes"]))
    ).toContain("박서준(수정)");
  });

  it("재조회하지 않고 받아 온 시각도 그대로 둔다", () => {
    const client = seed();
    const before = client.getQueryState(["/v1/notes/N"])?.dataUpdatedAt;
    const invalidated: unknown[] = [];
    client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "invalidate")
        invalidated.push(event);
    });

    writeGuestName(client, { guestId: GUEST, displayName: "새 이름" });

    expect(client.getQueryState(["/v1/notes/N"])?.dataUpdatedAt).toBe(before);
    expect(client.getQueryState(["/v1/notes/N"])?.isInvalidated).toBe(false);
    expect(invalidated).toHaveLength(0);
  });

  it("이미 같은 이름이면 같은 참조를 그대로 둔다", () => {
    const client = seed();
    const before = client.getQueryData(["/v1/notes/N"]);

    writeGuestName(client, { guestId: GUEST, displayName: "박서준" });

    expect(client.getQueryData(["/v1/notes/N"])).toBe(before);
  });
});
