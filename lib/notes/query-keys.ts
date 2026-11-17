import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

const NOTE_LIST_QUERY_PATTERNS = [
  /^\/v1\/projects\/[^/]+\/notes$/,
  /^\/v1\/workspaces\/[^/]+\/notes$/,
];

export function isNoteListQueryKey(queryKey: readonly unknown[]) {
  return (
    typeof queryKey[0] === "string" &&
    NOTE_LIST_QUERY_PATTERNS.some((pattern) =>
      pattern.test(queryKey[0] as string)
    )
  );
}

const WORKSPACE_GUESTS_QUERY_PATTERN = /^\/v1\/workspaces\/[^/]+\/guests$/;

export function isWorkspaceGuestsQueryKey(queryKey: readonly unknown[]) {
  return (
    typeof queryKey[0] === "string" &&
    WORKSPACE_GUESTS_QUERY_PATTERN.test(queryKey[0])
  );
}

export function isSpeakerAssigneeQueryKey(
  noteId: string,
  queryKey: readonly unknown[]
) {
  return (
    queryKey[0] === `/v1/notes/${noteId}/meeting-review` ||
    isProjectTaskQueryKey(queryKey)
  );
}

const NOTE_QUERY_PATTERN = /^\/v1\/notes\/[^/]+$/;
const NOTE_TRANSCRIPT_QUERY_PATTERN = /^\/v1\/notes\/[^/]+\/transcript$/;

export function isNoteQueryKey(query: { queryKey: readonly unknown[] }) {
  return (
    typeof query.queryKey[0] === "string" &&
    NOTE_QUERY_PATTERN.test(query.queryKey[0])
  );
}

export function isNoteTranscriptQueryKey(query: {
  queryKey: readonly unknown[];
}) {
  return (
    typeof query.queryKey[0] === "string" &&
    NOTE_TRANSCRIPT_QUERY_PATTERN.test(query.queryKey[0])
  );
}
