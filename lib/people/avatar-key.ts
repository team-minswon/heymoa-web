/**
 * 그 사람의 얼굴 열쇠. **워크스페이스에서 변하지 않는 식별자가 먼저다** — 계정과 임시
 * 참여자 식별자는 회의를 옮겨도 같아서, 같은 사람이 전사·참석자·설정에서 한 얼굴로 선다.
 * `participantId` 는 한 회의 안에서만 뜻이 있어 회의마다 얼굴이 튀므로 마지막 수단이다.
 *
 * **이름을 먼저 쓰면 안 된다** — 한 워크스페이스에 박도현·박순영이 같이 있고, 개명하면
 * 얼굴이 튄다.
 */
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

/**
 * 아직 아무도 안 붙은 화자의 얼굴 열쇠. 전사의 칩과 요약·할 일의 담당 칸이 **둘 다 이것을 쓴다** —
 * 담당 칸만 노트 id 를 섞어서 같은 「화자 B」가 두 얼굴로 섰다.
 */
export function unnamedSpeakerAvatarKey(label: string) {
  return `label:${label}`;
}
