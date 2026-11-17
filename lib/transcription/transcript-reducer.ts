import type {
  RealtimeFinalSegment,
  ServerEvent,
} from "@/lib/transcription/protocol";

export type LivePartial = {
  utteranceId: string;
  confirmedText: string;
  pendingText: string;
};

export type TranscriptState = {
  partial: LivePartial | null;
  finalSegments: RealtimeFinalSegment[];
  completed: boolean;
};

export const initialTranscriptState: TranscriptState = {
  partial: null,
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
    return { ...state, partial: null };
  }

  if (event.type === "partial") {
    if (state.completed) return state;
    return {
      ...state,
      partial: {
        utteranceId: event.utteranceId,
        confirmedText: event.confirmedText,
        pendingText: event.pendingText,
      },
    };
  }

  if (event.type === "final") {
    const finalSegments = state.finalSegments
      .filter((segment) => segment.segmentId !== event.segmentId)
      .concat(event)
      .sort((a, b) => a.sequence - b.sequence);
    return { ...state, partial: null, finalSegments };
  }

  if (event.type === "completed") {
    return { ...state, partial: null, completed: true };
  }

  return state;
}
