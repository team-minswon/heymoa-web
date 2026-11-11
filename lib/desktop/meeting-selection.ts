import type { MeetingTarget } from "@heymoa/desktop-contracts";

let selection: MeetingTarget | null = null;
const listeners = new Set<() => void>();
export const getMeetingSelection = () => selection;
export const emptyMeetingSelection = () => null;
export function setMeetingSelection(value: MeetingTarget | null) {
  if (
    selection?.noteId === value?.noteId &&
    selection?.workspaceId === value?.workspaceId &&
    selection?.requestId === value?.requestId
  )
    return;
  selection = value;
  for (const listener of listeners) listener();
}
export function subscribeMeetingSelection(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
