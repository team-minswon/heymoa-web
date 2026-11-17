export function personAvatarKey(person: {
  participantId?: string | null;
  userId?: string | null;
  guestId?: string | null;
  email?: string | null;
  name?: string | null;
}) {
  return (
    person.guestId ||
    person.userId ||
    person.participantId ||
    person.email ||
    person.name ||
    "?"
  );
}

export function unnamedSpeakerAvatarKey(label: string) {
  return `label:${label}`;
}
