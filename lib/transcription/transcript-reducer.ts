import type {
  RealtimeFinalSegment,
  ServerEvent,
} from "@/lib/transcription/protocol";

/**
 * 살아 있는 partial은 세션당 하나다 — 계약(`asyncapi.yml` PartialEvent)이
 * "`utteranceId`는 commit마다 새로 발급되며 확정된 발화의 partial 표시를 지우는 기준"이라고
 * 정의한다. 맵으로 쌓으면 final이 오지 않는 발화(빈 확정, 재연결로 폐기된 commit)의 텍스트가
 * 남아 이후 발화에 계속 이어 붙는다.
 */
export type LivePartial = {
  utteranceId: string;
  /** 안 바뀌는 앞부분. 확정 행과 같은 농도로 그린다. */
  confirmedText: string;
  /** 다음 snapshot 이 갈아치울 뒷부분. 옅게 그린다. */
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
    // 다른 utteranceId면 이전 발화를 대체한다 — 그것이 계약이 말하는 정리 기준이다.
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
    // final이 오면 id와 무관하게 현재 partial을 비운다.
    //
    // id를 비교해 "더 이른 발화의 final이면 남긴다"로 하고 싶어지지만, utteranceId는
    // 최신성을 뜻하지 않는다 — 서버가 재연결 때 폐기한 commit의 이전 id를 되살린다
    // (heymoa-server `rollbackDiscardedCommit`). 그래서 id 순서로 판단하면 되살아난
    // 뒤에 온 final이 죽은 partial을 못 지우고 세션 끝까지 남는다.
    //
    // 반대로 너무 일찍 지우는 쪽의 대가는 작다: 다음 partial snapshot이 곧 다시 채운다.
    // 오래 남는 고아와 한 순간의 빈 줄 중 후자를 고른다.
    return { ...state, partial: null, finalSegments };
  }

  if (event.type === "completed") {
    return { ...state, partial: null, completed: true };
  }

  return state;
}
