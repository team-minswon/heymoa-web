import type { MeetingTimelineSnapshot } from "@heymoa/desktop-contracts";
import type { ContextState } from "@/lib/notes/proposals/reducer";
import {
  selectTimeline,
  type AgendaList,
  type AgendaPlacement,
} from "@/lib/notes/proposals/timeline";
import type { ProposalHead } from "@/lib/notes/proposals/contract";

// The popup is a recent view. Native validates the same ceilings at the IPC boundary.
export function meetingTimelineSnapshot(
  noteId: string,
  title: string,
  state: ContextState,
  status: Pick<MeetingTimelineSnapshot, "loading" | "failed" | "reconnecting">,
  /** 유형 이름. 화면 언어(`notes.kinds`)로 넘긴다 */
  kindLabel: (kind: ProposalHead["kind"]) => string,
  detail?: {
    plan: { list: AgendaList; placement: AgendaPlacement } | null;
    partial: { confirmedText: string; pendingText: string } | null;
    ended?: boolean;
    workspaceId?: string;
    ownsRecording?: boolean;
    selectionId?: number;
    meetingState?: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "ENDED";
    summary?: NonNullable<MeetingTimelineSnapshot["detail"]>["summary"];
  }
): MeetingTimelineSnapshot {
  const timeline = selectTimeline(state, "ALL", detail?.plan);
  const items = timeline.groups.flatMap((group) => group.items);
  const recent = items.slice(-120);
  const ids = new Set(recent.map(({ proposal }) => proposal.proposalId));
  return {
    noteId,
    title: title.slice(0, 300),
    ...status,
    total: timeline.counts.ALL,
    ...(detail
      ? {
          detail: {
            ...(detail.workspaceId ? { workspaceId: detail.workspaceId } : {}),
            ...(detail.ownsRecording !== undefined
              ? { ownsRecording: detail.ownsRecording }
              : {}),
            ...(detail.selectionId !== undefined
              ? { selectionId: detail.selectionId }
              : {}),
            ...(detail.meetingState
              ? { meetingState: detail.meetingState }
              : {}),
            ...(detail.ended !== undefined ? { ended: detail.ended } : {}),
            ...(detail.summary ? { summary: detail.summary } : {}),
            counts: timeline.counts,
            groups: timeline.groups.flatMap((group) => {
              const itemIds = group.items
                .map(({ proposal }) => proposal.proposalId)
                .filter((id) => ids.has(id));
              return itemIds.length
                ? [
                    {
                      id: group.key.slice(0, 160),
                      title: (group.agenda?.title ?? "").slice(0, 300),
                      startMs: group.startMs,
                      endMs: group.endMs,
                      itemIds,
                    },
                  ]
                : [];
            }),
            partial: detail.partial
              ? {
                  confirmedText: detail.partial.confirmedText.slice(0, 4000),
                  pendingText: detail.partial.pendingText.slice(0, 4000),
                }
              : null,
          },
        }
      : {}),
    items: recent.map(({ proposal, tone, atMs }) => ({
      id: proposal.proposalId,
      tone,
      label: kindLabel(proposal.kind),
      content: proposal.content.slice(0, 4000),
      atMs,
      citations: proposal.citations.slice(0, 8).map((citation) => ({
        atMs: citation.startedAtMs,
        text: citation.text.slice(0, 4000),
      })),
    })),
  };
}
