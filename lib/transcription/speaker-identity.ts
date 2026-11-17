import {
  personAvatarKey,
  unnamedSpeakerAvatarKey,
} from "@/lib/people/avatar-key";
import type { DiarizationSpeaker } from "@/lib/transcription/presentation";

function indexOfLabel(label: string) {
  if (!/^[A-Z]+$/.test(label)) return null;
  let index = 0;
  for (const character of label) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
}

export function compareLabels(a: string, b: string) {
  const left = indexOfLabel(a);
  const right = indexOfLabel(b);
  if (left === null || right === null) return a.localeCompare(b);
  return left - right;
}

export function speakerAvatarName(
  ownedLabels: readonly string[],
  fallback: { label?: string | null; hashKey: string }
) {
  if (ownedLabels.length) return fallback.hashKey;
  if (fallback.label) return unnamedSpeakerAvatarKey(fallback.label);
  return fallback.hashKey;
}

export type SpeakerIdentity = {
  displayName: string;
  avatarName: string;
  imageUrl: string | null;
  unassigned: boolean;
};

export type SpeakerIdentitySource = DiarizationSpeaker & {
  assignedParticipantId?: string | null;
  confirmed?: boolean;
  image?: string | null;
};

export type SpeakerFace = {
  participantId: string;
  userId?: string | null;
  guestId?: string | null;
  name?: string | null;
  image?: string | null;
};

export function createSpeakerIdentityResolver(
  speakers: SpeakerIdentitySource[],
  participants: SpeakerFace[],
  speakerName: (label: string) => string
) {
  const byLabel = new Map(speakers.map((speaker) => [speaker.label, speaker]));
  const ownedLabelsOf = new Map<string, string[]>();
  for (const speaker of speakers) {
    const participantId = speaker.assignedParticipantId;
    if (!participantId) continue;
    ownedLabelsOf.set(participantId, [
      ...(ownedLabelsOf.get(participantId) ?? []),
      speaker.label,
    ]);
  }
  const keyOf = new Map(
    participants.map((participant) => [
      participant.participantId,
      personAvatarKey(participant),
    ])
  );
  const faceOf = new Map(
    participants.map((participant) => [
      participant.participantId,
      participant.image ?? null,
    ])
  );
  const nameOf = new Map(
    participants.map((participant) => [
      participant.participantId,
      participant.name ?? null,
    ])
  );

  const byLabelCache = new Map<string, SpeakerIdentity | null>();
  const resolve = (
    label: string | null | undefined,
    overriddenParticipantId?: string | null
  ): SpeakerIdentity | null => {
    if (!label) return null;
    const overriddenName = overriddenParticipantId
      ? (nameOf.get(overriddenParticipantId) ?? null)
      : null;
    if (overriddenName) {
      return {
        displayName: overriddenName,
        avatarName: speakerAvatarName(
          ownedLabelsOf.get(overriddenParticipantId!) ?? [],
          {
            hashKey:
              keyOf.get(overriddenParticipantId!) ?? overriddenParticipantId!,
          }
        ),
        imageUrl: faceOf.get(overriddenParticipantId!) ?? null,
        unassigned: false,
      };
    }
    const speaker = byLabel.get(label);
    const name = speaker?.assignedParticipantId
      ? (nameOf.get(speaker.assignedParticipantId) ?? null)
      : null;
    const displayName = name ?? speakerName(label);

    return {
      displayName,
      avatarName: speaker?.assignedParticipantId
        ? speakerAvatarName(
            ownedLabelsOf.get(speaker.assignedParticipantId) ?? [],
            {
              hashKey:
                keyOf.get(speaker.assignedParticipantId) ??
                speaker.assignedParticipantId,
            }
          )
        : speakerAvatarName([], { label, hashKey: label }),
      imageUrl:
        speaker?.image ??
        (speaker?.assignedParticipantId
          ? (faceOf.get(speaker.assignedParticipantId) ?? null)
          : null),
      unassigned: !speaker?.confirmed,
    };
  };

  return (
    label: string | null | undefined,
    overriddenParticipantId?: string | null
  ): SpeakerIdentity | null => {
    if (!label) return null;
    if (overriddenParticipantId && nameOf.get(overriddenParticipantId)) {
      return resolve(label, overriddenParticipantId);
    }
    if (!byLabelCache.has(label)) byLabelCache.set(label, resolve(label));
    return byLabelCache.get(label)!;
  };
}
