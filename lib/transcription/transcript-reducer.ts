import type {
  ServerEvent,
  TranscriptSegment,
} from "@/lib/transcription/protocol";

export type TranscriptState = {
  partialByItemId: Record<string, string>;
  finalSegments: TranscriptSegment[];
};

export const initialTranscriptState: TranscriptState = {
  partialByItemId: {},
  finalSegments: [],
};

export function transcriptReducer(
  state: TranscriptState,
  event: ServerEvent
): TranscriptState {
  if (event.type === "TRANSCRIPT_PARTIAL") {
    return {
      ...state,
      partialByItemId: {
        ...state.partialByItemId,
        [event.itemId]: event.text,
      },
    };
  }

  if (event.type === "TRANSCRIPT_FINAL") {
    const partialByItemId = { ...state.partialByItemId };
    delete partialByItemId[event.itemId];
    const existingIndex = state.finalSegments.findIndex(
      (segment) => segment.segmentId === event.segment.segmentId
    );
    const finalSegments = [...state.finalSegments];
    if (existingIndex >= 0) finalSegments[existingIndex] = event.segment;
    else finalSegments.push(event.segment);
    finalSegments.sort((a, b) => a.sequence - b.sequence);
    return { partialByItemId, finalSegments };
  }

  return state;
}
