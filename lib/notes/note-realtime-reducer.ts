import type { RunRange, ProposalHead } from "@/lib/notes/proposals/contract";
import {
  initialContextState,
  reduceContextEvent,
  type ContextState,
} from "@/lib/notes/proposals/reducer";
import type {
  NoteTopicEvent,
  NoteTopicFinalSegment,
} from "@/lib/notes/note-topic-protocol";

type ViewerLivePartial = {
  utteranceId: string;
  transcriptionSessionId: string;
  confirmedText: string;
  pendingText: string;
};

export type NoteRealtimeState = {
  noteId: string | null;
  partial: ViewerLivePartial | null;
  finalSegments: NoteTopicFinalSegment[];
  context: ContextState;
};

export type NoteRealtimeAction =
  | { type: "reset"; noteId: string }
  | { type: "transcript-reset"; persistedThrough: number | null }
  | { type: "event"; event: NoteTopicEvent }
  | {
      type: "snapshot";
      proposals: ProposalHead[];
      runs: RunRange[];
    };

export const initialNoteRealtimeState: NoteRealtimeState = {
  noteId: null,
  partial: null,
  finalSegments: [],
  context: initialContextState,
};

export function noteRealtimeReducer(
  state: NoteRealtimeState,
  action: NoteRealtimeAction
): NoteRealtimeState {
  if (action.type === "reset") {
    return { ...initialNoteRealtimeState, noteId: action.noteId };
  }
  if (action.type === "transcript-reset") {
    const through = action.persistedThrough;
    return {
      ...state,
      partial: null,
      finalSegments:
        through === null
          ? state.finalSegments
          : state.finalSegments.filter((segment) => segment.sequence > through),
    };
  }
  if (action.type === "snapshot") {
    return { ...state, context: reduceContextEvent(state.context, action) };
  }
  const event = action.event;
  switch (event.type) {
    case "transcript.partial":
      return {
        ...state,
        partial: {
          utteranceId: event.utteranceId,
          transcriptionSessionId: event.transcriptionSessionId,
          confirmedText: event.confirmedText,
          pendingText: event.pendingText,
        },
      };
    case "transcript.final": {
      const index = state.finalSegments.findIndex(
        (segment) => segment.segmentId === event.segmentId
      );
      const finalSegments =
        index < 0
          ? [...state.finalSegments, event]
          : state.finalSegments.map((segment, current) =>
              current === index ? event : segment
            );
      return { ...state, partial: null, finalSegments };
    }
    case "recording.stopped":
      return {
        ...state,
        partial:
          state.partial?.transcriptionSessionId === event.transcriptionSessionId
            ? null
            : state.partial,
      };
    case "meeting.ended":
      return { ...state, partial: null };
    case "proposal.changed":
    case "transcript-analysis-run.applied":
      return { ...state, context: reduceContextEvent(state.context, event) };
    default:
      return state;
  }
}
