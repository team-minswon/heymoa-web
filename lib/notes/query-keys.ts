const PROJECT_NOTES_QUERY_PATTERN = /^\/v1\/projects\/[^/]+\/notes$/;

export function isProjectNotesQueryKey(queryKey: readonly unknown[]) {
  return (
    typeof queryKey[0] === "string" &&
    PROJECT_NOTES_QUERY_PATTERN.test(queryKey[0])
  );
}
