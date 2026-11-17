"use client";

import { useMemo } from "react";

import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import {
  useRecording,
  useRecordingTranscript,
} from "@/components/transcription/recording-provider";
import { selectLivePartial } from "@/lib/transcription/presentation";

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
