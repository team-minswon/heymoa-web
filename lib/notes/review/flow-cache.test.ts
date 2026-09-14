import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { getGetAnalysisFlowQueryKey } from "@/lib/api/generated/analysis/analysis";
import { flowPollInterval, moveFlowStatus } from "@/lib/notes/review/flow-cache";

describe("flowPollInterval", () => {
  it("도는 단계는 자주, 사람을 기다리는 단계는 드물게 묻고, 확정 뒤에는 묻지 않는다", () => {
    expect(flowPollInterval("ANALYZING")).toBe(3_000);
    expect(flowPollInterval("DIARIZING")).toBe(3_000);
    expect(flowPollInterval("ANALYSIS_FAILED")).toBe(15_000);
    expect(flowPollInterval("REVIEWABLE")).toBe(15_000);
    expect(flowPollInterval("CONFIRMED")).toBe(false);
    expect(flowPollInterval("NOT_APPLICABLE")).toBe(false);
    expect(flowPollInterval(null)).toBe(false);
  });
});

describe("moveFlowStatus", () => {
  it("읽어 둔 흐름의 상태만 옮기고, 읽은 적 없으면 만들지 않는다", () => {
    const client = new QueryClient();
    const key = getGetAnalysisFlowQueryKey("n1");
    client.setQueryData(key, {
      status: 200,
      data: { success: true, data: { noteId: "n1", status: "REVIEWABLE" }, error: null },
      headers: new Headers(),
    });

    moveFlowStatus(client, "n1", "CONFIRMED");
    expect(client.getQueryData(key)).toMatchObject({ data: { data: { noteId: "n1", status: "CONFIRMED" } } });

    moveFlowStatus(client, "n2", "ANALYZING");
    expect(client.getQueryData(getGetAnalysisFlowQueryKey("n2"))).toBeUndefined();
  });
});
