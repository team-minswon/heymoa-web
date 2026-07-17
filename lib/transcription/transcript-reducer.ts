import type {
  RealtimeFinalSegment,
  ServerEvent,
} from "@/lib/transcription/protocol";

export type TranscriptState = {
  partialByUtteranceId: Record<string, string>;
  finalSegments: RealtimeFinalSegment[];
  completed: boolean;
};

export const initialTranscriptState: TranscriptState = {
  partialByUtteranceId: {},
  finalSegments: [],
  completed: false,
};

export type TranscriptAction =
  | ServerEvent
  | { type: "reset" }
  | { type: "clear-partials" };

export function transcriptReducer(
  state: TranscriptState,
  event: TranscriptAction
): TranscriptState {
  if (event.type === "reset") return initialTranscriptState;
  if (event.type === "clear-partials") {
    return { ...state, partialByUtteranceId: {} };
  }

  if (event.type === "partial") {
    if (state.completed) return state;
    return {
      ...state,
      partialByUtteranceId: {
        ...state.partialByUtteranceId,
        [event.utteranceId]: event.text,
      },
    };
  }

  if (event.type === "final") {
    const partialByUtteranceId = { ...state.partialByUtteranceId };
    delete partialByUtteranceId[event.utteranceId];
    const finalSegments = state.finalSegments
      .filter((segment) => segment.segmentId !== event.segmentId)
      .concat(event)
      .sort((a, b) => a.sequence - b.sequence);

    return { ...state, partialByUtteranceId, finalSegments };
  }

  if (event.type === "completed") {
    return { ...state, partialByUtteranceId: {}, completed: true };
  }

  return state;
}
