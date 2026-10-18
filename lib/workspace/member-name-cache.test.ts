import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { writeMemberName } from "@/lib/workspace/member-name-cache";

const USER = "0HZX2K7M9Q4AU";

function ok(data: unknown) {
  return { status: 200, data: { success: true, data } };
}

function seed() {
  const client = new QueryClient();
  client.setQueryData(
    ["/v1/workspaces/W/members"],
    ok({
      members: [
        { userId: USER, name: "상어", displayName: null, accountName: "상어" },
        {
          userId: "OTHER",
          name: "한지원",
          displayName: null,
          accountName: "한지원",
        },
      ],
    })
  );
  // 이 워크스페이스의 회의 — 상세가 workspaceId 를 들고 있다
  client.setQueryData(
    ["/v1/notes/N1"],
    ok({
      workspaceId: "W",
      projectId: "P1",
      meetingStartedBy: { userId: USER, name: "상어" },
      participants: [
        { participantId: "PA", userId: USER, guestId: null, name: "상어" },
      ],
    })
  );
  client.setQueryData(
    ["/v1/notes/N1/transcript"],
    ok({
      diarization: {
        speakers: [{ assignedParticipantId: "PA", assignedName: "상어" }],
      },
    })
  );
  // 프로젝트 할 일 — 프로젝트가 이 워크스페이스 것임을 회의 상세가 알려 준다
  client.setQueryData(
    ["/v1/projects/P1/tasks"],
    ok({
      tasks: [
        { taskId: "T", assignee: { type: "USER", id: USER, name: "상어" } },
      ],
    })
  );
  // 다른 워크스페이스의 회의 — 같은 사람이지만 거기서는 다른 이름일 수 있다
  client.setQueryData(
    ["/v1/notes/N2"],
    ok({
      workspaceId: "OTHER-W",
      projectId: "P2",
      participants: [
        { participantId: "PB", userId: USER, guestId: null, name: "상어" },
      ],
    })
  );
  return client;
}

function data<T>(client: QueryClient, key: string): T {
  return (client.getQueryData([key]) as { data: { data: T } }).data.data;
}

describe("writeMemberName", () => {
  it("이 워크스페이스의 멤버 목록·참여자·회의 시작자·화자·담당을 고치고 다른 워크스페이스는 두지 않는다", () => {
    const client = seed();
    writeMemberName(client, "W", {
      userId: USER,
      name: "김민수",
      displayName: "김민수",
      accountName: "상어",
    });

    const members = data<{ members: Record<string, unknown>[] }>(
      client,
      "/v1/workspaces/W/members"
    ).members;
    expect(members[0]).toMatchObject({
      name: "김민수",
      displayName: "김민수",
      accountName: "상어",
    });
    expect(members[1]).toMatchObject({ name: "한지원" });

    const note = data<{
      meetingStartedBy: { name: string };
      participants: { name: string }[];
    }>(client, "/v1/notes/N1");
    expect(note.meetingStartedBy.name).toBe("김민수");
    expect(note.participants[0].name).toBe("김민수");
    expect(
      data<{ diarization: { speakers: { assignedName: string }[] } }>(
        client,
        "/v1/notes/N1/transcript"
      ).diarization.speakers[0].assignedName
    ).toBe("김민수");
    expect(
      data<{ tasks: { assignee: { name: string } }[] }>(
        client,
        "/v1/projects/P1/tasks"
      ).tasks[0].assignee.name
    ).toBe("김민수");

    expect(
      data<{ participants: { name: string }[] }>(client, "/v1/notes/N2")
        .participants[0].name
    ).toBe("상어");
  });

  it("표시 이름을 지우면 계정 이름으로 쓰고, 받아 온 시각은 그대로 둔다", () => {
    const client = seed();
    const before = client.getQueryState(["/v1/notes/N1"])?.dataUpdatedAt;
    writeMemberName(client, "W", {
      userId: USER,
      name: "김민수",
      displayName: "김민수",
      accountName: "상어",
    });
    writeMemberName(client, "W", {
      userId: USER,
      name: "상어",
      displayName: null,
      accountName: "상어",
    });

    expect(
      data<{ members: Record<string, unknown>[] }>(
        client,
        "/v1/workspaces/W/members"
      ).members[0]
    ).toMatchObject({ name: "상어", displayName: null });
    expect(client.getQueryState(["/v1/notes/N1"])?.dataUpdatedAt).toBe(before);
  });

  it("옛 서버의 목록 항목(표시 이름 필드 없음)에도 두 필드를 채운다", () => {
    const client = new QueryClient();
    client.setQueryData(
      ["/v1/workspaces/W/members"],
      ok({ members: [{ userId: USER, name: "상어", role: "MEMBER" }] })
    );
    writeMemberName(client, "W", {
      userId: USER,
      name: "김민수",
      displayName: "김민수",
      accountName: "상어",
    });
    expect(
      data<{ members: Record<string, unknown>[] }>(
        client,
        "/v1/workspaces/W/members"
      ).members[0]
    ).toMatchObject({
      name: "김민수",
      displayName: "김민수",
      accountName: "상어",
    });
  });

  it("프로젝트 목록만으로도 그 프로젝트의 회의 목록을 이 워크스페이스 것으로 안다", () => {
    const client = new QueryClient();
    client.setQueryData(
      ["/v1/workspaces/W/projects"],
      ok({ projects: [{ projectId: "P9" }] })
    );
    client.setQueryData(
      ["/v1/projects/P9/notes"],
      ok({
        notes: [
          {
            noteId: "N9",
            participants: [{ participantId: "X", userId: USER, name: "상어" }],
          },
        ],
      })
    );
    writeMemberName(client, "W", {
      userId: USER,
      name: "김민수",
      displayName: "김민수",
      accountName: "상어",
    });
    expect(
      data<{ notes: { participants: { name: string }[] }[] }>(
        client,
        "/v1/projects/P9/notes"
      ).notes[0].participants[0].name
    ).toBe("김민수");
  });
});
