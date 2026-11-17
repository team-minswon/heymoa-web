import type { GapRow } from "@/lib/transcription/gaps";
import type { RecordingPhase } from "@/lib/transcription/recording-state";
import type { LivePartial } from "@/lib/transcription/transcript-reducer";

export type TranscriptPresentationSegment = {
  segmentId: string;
  sequence: number;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  speakerLabel?: string | null;
  assignedParticipantId?: string | null;
};

export function formatOffset(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  if (minutes < 60) return `${pad(minutes)}:${pad(seconds % 60)}`;
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}

export type TranscriptRow =
  | {
      type: "segment";
      startedAtMs: number;
      segment: TranscriptPresentationSegment;
    }
  | { type: "gap"; startedAtMs: number; gap: GapRow };

export function interleaveTranscript(
  segments: TranscriptPresentationSegment[],
  gaps: GapRow[]
): TranscriptRow[] {
  const rows: TranscriptRow[] = [
    ...gaps.map(
      (gap) => ({ type: "gap", startedAtMs: gap.startedAtMs, gap }) as const
    ),
    ...segments
      .filter((segment) => segment.text.trim())
      .map(
        (segment) =>
          ({
            type: "segment",
            startedAtMs: segment.startedAtMs,
            segment,
          }) as const
      ),
  ];
  return rows.sort(
    (a, b) =>
      a.startedAtMs - b.startedAtMs ||
      (a.type === "gap" ? -1 : 0) - (b.type === "gap" ? -1 : 0)
  );
}

export type DiarizationSpeaker = {
  label: string;
  assignedName?: string | null;
};

export function mergeLiveSegments(
  persisted: readonly TranscriptPresentationSegment[],
  ...liveSources: readonly (readonly TranscriptPresentationSegment[])[]
): TranscriptPresentationSegment[] {
  const rows = new Map<string, TranscriptPresentationSegment>();
  persisted.forEach((segment) => rows.set(segment.segmentId, segment));
  for (const source of liveSources) {
    for (const segment of source) {
      if (!rows.has(segment.segmentId)) rows.set(segment.segmentId, segment);
    }
  }
  return [...rows.values()];
}

type LiveTranscriptSource = {
  partial: LivePartial | null;
  finalSegments: readonly { utteranceId: string }[];
};

export function selectLivePartial({
  recordingHere,
  phase,
  own,
  topic,
}: {
  recordingHere: boolean;
  phase: RecordingPhase;
  own: LiveTranscriptSource;
  topic: LiveTranscriptSource;
}): { confirmedText: string; pendingText: string } | null {
  const ownSocketIsSource =
    recordingHere && (phase === "recording" || phase === "stopping");
  const live = ownSocketIsSource ? own.partial : topic.partial;
  if (!live) return null;
  const settledIn = (source: LiveTranscriptSource) =>
    source.finalSegments.some(
      (segment) => segment.utteranceId === live.utteranceId
    );
  if (settledIn(topic) || (recordingHere && settledIn(own))) return null;

  const confirmedText = live.confirmedText.trimStart();
  const pendingText = confirmedText
    ? live.pendingText
    : live.pendingText.trimStart();
  if (!confirmedText && !pendingText.trim()) return null;
  return { confirmedText, pendingText };
}
