import type { QueryClient } from "@tanstack/react-query";

import {
  getGetAnalysisFlowQueryKey,
  type getAnalysisFlowResponse,
} from "@/lib/api/generated/analysis/analysis";
import type {
  MeetingAnalysisFlowResponseData,
  MeetingAnalysisFlowResponseDataStatus,
} from "@/lib/api/generated/models";

export function flowPollInterval(
  status: MeetingAnalysisFlowResponseDataStatus | null,
  regions: MeetingAnalysisFlowResponseData["regions"] = []
): number | false {
  if (regions.some((row) => row.status === "PENDING")) return 3_000;
  switch (status) {
    case "DIARIZING":
    case "NOT_REQUESTED":
    case "ANALYZING":
      return 3_000;
    case "ANALYSIS_FAILED":
    case "REVIEWABLE":
      return 15_000;
    default:
      return false;
  }
}

export function moveFlowStatus(
  queryClient: QueryClient,
  noteId: string,
  status: MeetingAnalysisFlowResponseDataStatus
) {
  queryClient.setQueryData<getAnalysisFlowResponse>(
    getGetAnalysisFlowQueryKey(noteId),
    (previous) =>
      previous?.status === 200 && previous.data.success
        ? ({
            ...previous,
            data: {
              ...previous.data,
              data: { ...previous.data.data, status, retryable: false },
            },
          } as getAnalysisFlowResponse)
        : previous
  );
}
