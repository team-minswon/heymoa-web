import type { DiarizationSpeaker } from "@/lib/transcription/presentation";

/**
 * 파스텔 다섯. `DESIGN.md` 가 이 색들을 **배경으로만** 쓰라고 못박는다 —
 * 「never as button fills, never as text colors」. 그래서 이니셜 칩의 바탕으로만 쓰고
 * 글자는 기존 전경색을 그대로 둔다.
 */
const SPEAKER_TINTS = [
  "var(--el-gradient-sky)",
  "var(--el-gradient-peach)",
  "var(--el-gradient-mint)",
  "var(--el-gradient-lavender)",
  "var(--el-gradient-rose)",
] as const;

/** FNV-1a. 짧고 결정적이면 된다 — 암호용이 아니다. */
function hash(value: string) {
  let h = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type SpeakerIdentity = {
  /** 화면에 쓸 이름. 연결 안 됐으면 `화자 A`. */
  displayName: string;
  /** 칩 바탕. 배경으로만 쓴다. */
  tint: string;
  /** 프로필 사진이 없을 때 그릴 글자. */
  initial: string;
  /** 계정이 연결됐으면 사진 URL. */
  imageUrl: string | null;
  /** 아직 아무도 안 본 화자. 점을 찍어 이름을 붙일 이유를 만든다. */
  unassigned: boolean;
};

export type SpeakerIdentitySource = DiarizationSpeaker & {
  assignedUserId?: string | null;
  confirmed?: boolean;
  image?: string | null;
};

/**
 * 화자에게 얼굴을 준다. **아무것도 저장하지 않는다** — 렌더 시점에 계산한다.
 *
 * 저장하면 팔레트를 바꿀 때 옛 회의만 옛 색으로 남고, 화자 수가 팔레트보다 많으면 어차피
 * 겹치므로 안정성을 약속할 수도 없다.
 *
 * **한 사람이 두 화자로 쪼개진 경우가 공짜로 풀린다.** 둘을 같은 이름에 연결하면 해싱
 * 입력이 같아져 색이 저절로 맞는다 — 병합 코드가 따로 필요 없다.
 */
export function createSpeakerIdentityResolver(speakers: SpeakerIdentitySource[]) {
  const byLabel = new Map(speakers.map((speaker) => [speaker.label, speaker]));

  return (label: string | null | undefined): SpeakerIdentity | null => {
    if (!label) return null;
    const speaker = byLabel.get(label);
    const name = speaker?.assignedName ?? null;
    // 「참석자 아님」으로 확정한 화자도 `화자 A` 로 남는다. 그 사람이 누구인지 우리가
    // 모른다는 것이 사실이고, 다른 말로 꾸미면 거짓이 된다.
    const displayName = name ?? `화자 ${label}`;

    return {
      displayName,
      tint: SPEAKER_TINTS[hash(name ?? label) % SPEAKER_TINTS.length],
      initial: [...displayName][0] ?? "?",
      imageUrl: speaker?.image ?? null,
      unassigned: !speaker?.confirmed,
    };
  };
}
