import { describe, expect, it } from "vitest";
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
      { loading: false, failed: false, reconnecting: true }
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
  });
});
