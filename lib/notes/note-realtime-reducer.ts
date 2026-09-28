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

/**
 * 뷰어도 살아 있는 partial은 하나만 든다 — 근거는 `lib/transcription/transcript-reducer.ts`의
 * `LivePartial` 주석과 같다. 여기는 어느 세션의 발화인지도 알아야 `recording.stopped`에서
 * 그 세션 것만 지울 수 있다.
 */
type ViewerLivePartial = {
  utteranceId: string;
  transcriptionSessionId: string;
  /** 두 토막인 근거는 `lib/transcription/protocol.ts` 의 partial 주석에 있다. */
  confirmedText: string;
  pendingText: string;
};

export type NoteRealtimeState = {
  /** 이 상태가 어느 노트의 것인가. 렌더에서 이 값으로 거른다 — effect 초기화만 믿으면
      노트 전환 첫 커밋에 이전 노트의 카드·partial이 한 프레임 그려진다. */
  noteId: string | null;
  partial: ViewerLivePartial | null;
  finalSegments: NoteTopicFinalSegment[];
  context: ContextState;
};

export type NoteRealtimeAction =
  | { type: "reset"; noteId: string }
  /**
   * 재연결 catch-up 용. partial 과 저장본이 이미 가진 확정 발화만 비운다. 원장까지 비우면
   * 그 직후의 snapshot 재조회가 실패했을 때(캐시가 남아 `isLoadingError`도 거짓) 다시 채울
   * 경로가 없어 원장이 「정리된 사건이 없습니다」로 남는다.
   */
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
    // 저장본에 아직 없는 확정 발화는 남긴다. 비우면 다시 받는 동안 최근 발화가 사라졌다
    // 나타난다. 저장본에 있는 것은 덜어 내 긴 회의에서도 쌓이지 않게 한다.
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
    // REST가 정본이다. 임시로 접어 둔 것을 버리고 이걸로 다시 선다.
    return { ...state, context: reduceContextEvent(state.context, action) };
  }
  const event = action.event;
  switch (event.type) {
    case "transcript.partial":
      // 다른 utteranceId면 이전 발화를 대체한다 — 그것이 계약이 말하는 정리 기준이다.
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
      // final이 오면 id와 무관하게 현재 partial을 비운다 — 근거는
      // `lib/transcription/transcript-reducer.ts`의 같은 분기 주석에 있다.
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
    // 맥락 후보는 통째로 순수 리듀서에 넘긴다 — 이 파일은 이벤트 의미를 모른다.
    case "proposal.changed":
    case "transcript-analysis-run.applied":
      return { ...state, context: reduceContextEvent(state.context, event) };
    default:
      return state;
  }
}
