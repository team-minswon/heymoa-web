import { compareLabels } from "@/lib/transcription/speaker-identity";
import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";
import { personAvatarKey } from "@/lib/people/avatar-key";
import { speakerAvatarName } from "@/lib/transcription/speaker-identity";

export type SpeakerJumpVia = "strip" | "step";

export type SpeakerStat = {
  key: string;
  name: string;
  avatarName: string;
  image: string | null;
  labels: string[];
  ownedLabels: string[];
  speakingMs: number;
  segmentCount: number;
  share: number;
  timeline: number[];
  unassigned: boolean;
  firstSegmentId: string | null;
  firstStartedAtMs: number | null;
  utterances: SpeakerUtterance[];
  stepTargets: SpeakerUtterance[];
};

export type SpeakerUtterance = {
  segmentId: string;
  startedAtMs: number;
  endedAtMs: number;
};

export const MIN_STEP_SEGMENT_MS = 1500;

export const TIMELINE_MIN_VISIBLE = 0.25;

type SpeakerInput = {
  label: string;
  assignedParticipantId?: string | null;
  assignedName?: string | null;
  confirmed?: boolean;
};

export const TIMELINE_BINS = 48;

type ParticipantInput = {
  participantId: string;
  userId?: string | null;
  guestId?: string | null;
  name: string;
  image?: string | null;
};

export type SpeakerFallbackNames = {
  unnamedParticipant: string;
  speaker: (label: string) => string;
};

export function summarizeSpeakers({
  segments,
  speakers,
  participants = [],
  durationMs,
  names,
}: {
  segments: TranscriptPresentationSegment[];
  speakers: SpeakerInput[];
  participants?: ParticipantInput[];
  durationMs?: number;
  names: SpeakerFallbackNames;
}): SpeakerStat[] {
  const byLabel = new Map(speakers.map((speaker) => [speaker.label, speaker]));
  const personOf = new Map(
    participants.map((participant) => [participant.participantId, participant])
  );
  const ownedLabelsOf = new Map<string, string[]>();
  for (const speaker of speakers) {
    const participantId = speaker.assignedParticipantId;
    if (!participantId) continue;
    ownedLabelsOf.set(participantId, [
      ...(ownedLabelsOf.get(participantId) ?? []),
      speaker.label,
    ]);
  }

  const hashKeyOf = new Map<string, string>();
  const rows = new Map<string, SpeakerStat>();
  const firstStartedAtMs = new Map<string, number>();
  const spoken = new Map<string, SpeakerUtterance[]>();
  const meetingMs = Math.max(
    durationMs ?? 0,
    segments.reduce((end, segment) => Math.max(end, segment.endedAtMs), 0)
  );
  const binMs = meetingMs / TIMELINE_BINS;

  for (const segment of segments) {
    const label = segment.speakerLabel;
    if (!label) continue;

    const speaker = byLabel.get(label);
    const participantId =
      segment.assignedParticipantId ?? speaker?.assignedParticipantId ?? null;
    const person = participantId ? personOf.get(participantId) : undefined;
    const key = participantId ? participantId : `label:${label}`;
    hashKeyOf.set(
      key,
      participantId ? personAvatarKey(person ?? { participantId }) : key
    );

    const row =
      rows.get(key) ??
      ({
        key,
        avatarName: "",
        name: participantId
          ? (person?.name ?? names.unnamedParticipant)
          : names.speaker(label),
        image: person?.image ?? null,
        labels: [],
        ownedLabels: participantId
          ? [...(ownedLabelsOf.get(participantId) ?? [])]
          : [],
        speakingMs: 0,
        segmentCount: 0,
        share: 0,
        timeline: Array<number>(TIMELINE_BINS).fill(0),
        unassigned: !participantId,
        firstSegmentId: null,
        firstStartedAtMs: null,
        utterances: [],
        stepTargets: [],
      } satisfies SpeakerStat);

    if (!row.labels.includes(label)) row.labels.push(label);
    row.speakingMs += Math.max(0, segment.endedAtMs - segment.startedAtMs);
    row.segmentCount += 1;
    const list = spoken.get(key) ?? [];
    list.push({
      segmentId: segment.segmentId,
      startedAtMs: segment.startedAtMs,
      endedAtMs: segment.endedAtMs,
    });
    spoken.set(key, list);
    const first = firstStartedAtMs.get(key);
    if (first === undefined || segment.startedAtMs < first) {
      firstStartedAtMs.set(key, segment.startedAtMs);
      row.firstSegmentId = segment.segmentId;
      row.firstStartedAtMs = segment.startedAtMs;
    }
    rows.set(key, row);
  }

  for (const participant of participants) {
    if (rows.has(participant.participantId)) continue;
    hashKeyOf.set(participant.participantId, personAvatarKey(participant));
    rows.set(participant.participantId, {
      key: participant.participantId,
      avatarName: "",
      name: participant.name,
      image: participant.image ?? null,
      labels: [],
      ownedLabels: [...(ownedLabelsOf.get(participant.participantId) ?? [])],
      speakingMs: 0,
      segmentCount: 0,
      share: 0,
      timeline: Array<number>(TIMELINE_BINS).fill(0),
      unassigned: false,
      firstSegmentId: null,
      firstStartedAtMs: null,
      utterances: [],
      stepTargets: [],
    });
  }

  const total = [...rows.values()].reduce(
    (sum, row) => sum + row.speakingMs,
    0
  );
  for (const row of rows.values()) {
    row.labels.sort(compareLabels);
    row.ownedLabels.sort(compareLabels);
    const all = [...(spoken.get(row.key) ?? [])].sort(
      (a, b) => a.startedAtMs - b.startedAtMs
    );
    const meaningful = all.filter(
      (item) => item.endedAtMs - item.startedAtMs >= MIN_STEP_SEGMENT_MS
    );
    row.utterances = all;
    row.stepTargets = meaningful.length > 0 ? meaningful : all;
    const spokenBins = new Set<number>();
    for (const item of binMs > 0 ? all : []) {
      const firstBin = Math.min(
        TIMELINE_BINS - 1,
        Math.floor(item.startedAtMs / binMs)
      );
      const lastBin = Math.min(
        TIMELINE_BINS - 1,
        Math.floor(Math.max(item.startedAtMs, item.endedAtMs) / binMs)
      );
      spokenBins.add(firstBin);
      for (let bin = firstBin; bin <= lastBin; bin += 1) {
        const overlap =
          Math.min(item.endedAtMs, (bin + 1) * binMs) -
          Math.max(item.startedAtMs, bin * binMs);
        if (overlap > 0) spokenBins.add(bin);
        row.timeline[bin] += Math.max(0, overlap);
      }
    }
    row.share = total > 0 ? row.speakingMs / total : 0;
    row.avatarName = speakerAvatarName(row.ownedLabels, {
      label: row.unassigned ? row.labels[0] : null,
      hashKey: hashKeyOf.get(row.key) ?? row.key,
    });
    const peak = Math.max(...row.timeline);
    row.timeline = row.timeline.map((ms, bin) =>
      spokenBins.has(bin)
        ? Math.max(TIMELINE_MIN_VISIBLE, peak > 0 ? ms / peak : 0)
        : 0
    );
  }

  return [...rows.values()].sort(
    (a, b) => b.speakingMs - a.speakingMs || a.name.localeCompare(b.name, "ko")
  );
}

export function jumpIndexAt(
  utterances: Pick<SpeakerUtterance, "startedAtMs" | "endedAtMs">[],
  atMs: number
) {
  let best = -1;
  let bestGap = Infinity;
  utterances.forEach(({ startedAtMs: start, endedAtMs }, index) => {
    const end = Math.max(start, endedAtMs);
    const gap = atMs < start ? start - atMs : atMs > end ? atMs - end : 0;
    if (gap < bestGap) {
      best = index;
      bestGap = gap;
    }
  });
  return best;
}

export function speakingTimeParts(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}
