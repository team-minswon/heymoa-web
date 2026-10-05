import type { MeetingTimelineSnapshot } from "@heymoa/desktop-contracts";
import type { ContextState } from "@/lib/notes/proposals/reducer";
import { selectTimeline } from "@/lib/notes/proposals/timeline";
import { CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";

// The popup is a recent view. Native validates the same ceilings at the IPC boundary.
export function meetingTimelineSnapshot(
  noteId: string,
  title: string,
  state: ContextState,
  status: Pick<MeetingTimelineSnapshot, "loading" | "failed" | "reconnecting">
): MeetingTimelineSnapshot {
  const timeline = selectTimeline(state, "ALL");
  const items = timeline.groups.flatMap((group) => group.items);
  return {
    noteId,
    title: title.slice(0, 300),
    ...status,
    total: timeline.counts.ALL,
    items: items.slice(-120).map(({ proposal, tone, atMs }) => ({
      id: proposal.proposalId,
      tone,
      label: CONTEXT_KIND_LABEL[proposal.kind],
      content: proposal.content.slice(0, 4000),
      atMs,
      citations: proposal.citations.slice(0, 8).map((citation) => ({
        atMs: citation.startedAtMs,
        text: citation.text.slice(0, 4000),
      })),
    })),
  };
}
