import type { MeetingReviewResponseDataItemsItemAssignee } from "@/lib/api/generated/models";
import { mockDb } from "@/lib/mocks/db";
import { failWith } from "@/lib/mocks/mock-envelope";

/** 저장된 담당. 서버처럼 사람은 식별자, 회의 라벨은 노트·라벨로 두고 조회 때 푼다. */
export type StoredAssignee =
  | { type: "USER" | "GUEST"; id: string }
  | { type: "SPEAKER_LABEL"; noteId: string; label: string };

export type AssigneeView = MeetingReviewResponseDataItemsItemAssignee;

type AssigneeRequest = {
  type: "USER" | "GUEST" | "SPEAKER_LABEL";
  id?: string;
  label?: string;
  noteId?: string;
};

function badRequest(): never {
  return failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
}

export function assigneeFromRequest(
  request: AssigneeRequest | null | undefined,
  noteId: string | null
): StoredAssignee | null {
  if (!request) return null;
  if (request.type === "SPEAKER_LABEL") {
    const owner = request.noteId ?? noteId;
    if (!owner || !request.label) badRequest();
    return { type: "SPEAKER_LABEL", noteId: owner, label: request.label };
  }
  if (!request.id) badRequest();
  return { type: request.type, id: request.id };
}

/**
 * 조회 시점 담당. 회의 라벨은 그 라벨의 발화가 **모두 한 참여자**로 풀릴 때만 그 사람이 되고,
 * 아니면 라벨 그대로 내린다. 지워진 사람은 `null` 이다.
 */
export function resolveAssignee(
  workspaceId: string,
  stored: StoredAssignee | null
): AssigneeView | null {
  if (!stored) return null;
  if (stored.type === "SPEAKER_LABEL") {
    const person = personOfLabel(stored.noteId, stored.label);
    return person
      ? resolveAssignee(workspaceId, person)
      : { type: "SPEAKER_LABEL", noteId: stored.noteId, label: stored.label };
  }
  const name =
    stored.type === "USER"
      ? mockDb.listMembers(workspaceId).find((m) => m.userId === stored.id)?.name
      : mockDb
          .listWorkspaceGuests(workspaceId)
          .guests.find((g) => g.guestId === stored.id)?.displayName;
  return name ? { type: stored.type, id: stored.id, name } : null;
}

function personOfLabel(noteId: string, label: string): StoredAssignee | null {
  const { segments, diarization } = mockDb.getTranscript(noteId);
  const labelOwner =
    diarization.speakers.find((speaker) => speaker.label === label)
      ?.assignedParticipantId ?? null;
  const owners = new Set(
    segments
      .filter((segment) => segment.speakerLabel === label)
      .map((segment) => segment.assignedParticipantId ?? labelOwner)
  );
  if (owners.size !== 1) return null;
  const [participantId] = owners;
  const participant = mockDb
    .getNote(noteId)
    .participants.find((row) => row.participantId === participantId);
  if (participant?.userId) return { type: "USER", id: participant.userId };
  if (participant?.guestId) return { type: "GUEST", id: participant.guestId };
  return null;
}

export function workspaceOfProject(projectId: string) {
  const workspace = mockDb
    .listWorkspaces()
    .find((row) =>
      mockDb
        .listProjects(row.workspaceId)
        .some((project) => project.projectId === projectId)
    );
  return workspace?.workspaceId ?? failWith("PROJECT_NOT_FOUND", 404, "프로젝트를 찾을 수 없습니다.");
}
