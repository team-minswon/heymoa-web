import { describe, expect, it } from "vitest";
import { testAppT } from "@/components/help/test-intl";
import { meetingTimeline as validateNativeTimeline } from "@/apps/desktop/src/meeting-timeline";
import { meetingTimelineSnapshot } from "./meeting-timeline";
import { initialContextState } from "@/lib/notes/proposals/reducer";
import type { ProposalHead } from "@/lib/notes/proposals/contract";

describe("meeting timeline display snapshot", () => {
  it("uses the web selector's order and tones while bounding recent content without claiming a smaller total", () => {
    const proposals = Array.from(
      { length: 125 },
      (_, index): ProposalHead => ({
        proposalId: `item-${index}`,
        revision: 1,
        operation: "CREATE",
        kind: "ACTION_ITEM",
        status: "OPEN",
        closeReason: null,
        revisionSource: "LIVE",
        content: "x".repeat(5000),
        createdSequence: index,
        lastEvidenceSequence: index,
        aiSemanticRevisionCount: 0,
        resolvesProposalId: null,
        citations: [
          {
            segmentId: `segment-${index}`,
            sequence: index,
            startedAtMs: index * 1000,
            endedAtMs: index * 1000 + 500,
            text: "회의 발언",
            role: "SUPPORTS",
          },
        ],
      })
    );
    const result = meetingTimelineSnapshot(
      "note-a",
      "회의",
      {
        ...initialContextState,
        proposals: Object.fromEntries(
          proposals.reverse().map((p) => [p.proposalId, p])
        ),
      },
      { loading: false, failed: false, reconnecting: true },
      (kind) => testAppT()(`notes.kinds.${kind}`)
    );
    expect(result.total).toBe(125);
    expect(result.items).toHaveLength(120);
    expect(result.items[0]).toMatchObject({
      id: "item-5",
      tone: "task",
      atMs: 5000,
      label: "할 일",
      citations: [{ atMs: 5000, text: "회의 발언" }],
    });
    expect(result.items.at(-1)?.id).toBe("item-124");
    expect(result.items[0].content).toHaveLength(4000);
    expect(result.reconnecting).toBe(true);
    expect(JSON.stringify(result)).not.toContain("segmentId");
    expect(result).not.toHaveProperty("detail");
    const detailed = meetingTimelineSnapshot("note-a", "회의", {
      ...initialContextState,
      proposals: Object.fromEntries(proposals.map(p => [p.proposalId, p])),
    }, { loading: false, failed: false, reconnecting: false }, () => "할 일", {
      plan: { list: { agendas: [{ agendaId: "agenda-a", title: "배포 검증", completed: false, proposalIds: ["item-124"] }] }, placement: new Map([["item-124", "agenda-a"]]) },
      partial: { confirmedText: "현재 ", pendingText: "발언" },
    });
    expect(detailed.detail?.counts).toMatchObject({ ALL: 125, ACTION_ITEM: 125 });
    expect(detailed.detail?.groups.at(-1)).toMatchObject({ title: "배포 검증", itemIds: ["item-124"] });
    expect(detailed.detail?.groups.flatMap(g => g.itemIds)).toEqual(detailed.items.map(i => i.id));
    expect(detailed.detail?.partial).toEqual({ confirmedText: "현재 ", pendingText: "발언" });
    expect(validateNativeTimeline(detailed)).toEqual(detailed);
    expect(validateNativeTimeline(result)).toEqual(result);
  });
});
