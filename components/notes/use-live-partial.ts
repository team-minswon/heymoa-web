"use client";

import { useMemo } from "react";

import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import {
  useRecording,
  useRecordingTranscript,
} from "@/components/transcription/recording-provider";
import { selectLivePartial } from "@/lib/transcription/presentation";

/**
 * 이 노트에서 지금 받아 적는 중인 발화. 스크립트와 타임라인이 같은 줄을 보여야 해서 한 곳에서
 * 고른다 — 내 녹음 소켓과 노트 토픽 중 어느 쪽이 원본인지는 `selectLivePartial` 이 가른다.
 */
export function useLivePartial(noteId: string) {
  const recording = useRecording();
  const liveTranscript = useRecordingTranscript();
  const noteRealtime = useNoteRealtime();
  const liveForNote =
    (recording.activeNoteId ?? recording.session?.noteId) === noteId;

  const { partial: ownPartial, finalSegments: ownFinals } = liveTranscript;
  const { partial: topicPartial, finalSegments: topicFinals } =
    noteRealtime.transcript;
  return useMemo(
    () =>
      selectLivePartial({
        recordingHere: liveForNote,
        phase: recording.phase,
        own: { partial: ownPartial, finalSegments: ownFinals },
        topic: { partial: topicPartial, finalSegments: topicFinals },
      }),
    [
      liveForNote,
      ownFinals,
      ownPartial,
      recording.phase,
      topicFinals,
      topicPartial,
    ]
  );
}
