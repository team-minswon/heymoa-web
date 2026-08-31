import type { DiarizationSpeaker } from "@/lib/transcription/presentation";

/**
 * 파스텔 다섯. `DESIGN.md` 가 이 색들을 **배경으로만** 쓰라고 못박는다 —
 * 「never as button fills, never as text colors」. 그래서 이니셜 칩의 바탕으로만 쓰고
 * 글자는 기존 전경색을 그대로 둔다.
 *
 * **새 색을 만들지 않는다.** 브랜드 팔레트가 다섯이고, 여섯째 화자를 위해 여기서 색을
 * 하나 지어내면 그때부터 이 파일이 디자인 시스템의 두 번째 원본이 된다. 대신 같은
 * 다섯을 옅게 한 번 더 돌려 **열 자리**를 만든다.
 */
const SPEAKER_HUES = [
  "var(--el-gradient-sky)",
  "var(--el-gradient-peach)",
  "var(--el-gradient-mint)",
  "var(--el-gradient-lavender)",
  "var(--el-gradient-rose)",
] as const;

/**
 * 열 자리. 앞 다섯은 원색, 뒤 다섯은 흰색을 섞어 옅게 한 것이다.
 *
 * **여섯 명이 넘는 회의는 드물다.** 그보다 흔한 것은 서넛인데, 거기서 색이 겹치거나
 * 비슷해 보이는 것이 실제 불만이었다 — 그건 아래 순번 배정이 푼다.
 */
const SPEAKER_TINTS = [
  ...SPEAKER_HUES,
  ...SPEAKER_HUES.map((hue) => `color-mix(in srgb, ${hue}, white 45%)`),
] as const;

/**
 * `A`→0, `B`→1 … `Z`→25, `AA`→26. 서버의 라벨 생성(`SpeakerLabel`)과 정확히 뒤집는 짝이다.
 *
 * **순번으로 배정해야 색이 갈린다.** 예전에는 이름을 해싱했는데, 다섯 색에 화자 넷이면
 * 생일 문제로 겹치기 쉽고 실제로 이웃한 두 화자가 같은 계열로 나왔다.
 *
 * @returns 글자 라벨이 아니면 `null`. 업체가 모르는 모양을 줬을 때다
 */
function indexOfLabel(label: string) {
  if (!/^[A-Z]+$/.test(label)) return null;
  let index = 0;
  for (const character of label) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** FNV-1a. 짧고 결정적이면 된다 — 암호용이 아니다. */
function hash(value: string) {
  let h = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 이름으로 색을 고른다. **드롭다운이 이걸 쓴다** — 거기서는 아직 라벨이 없고 사람만 있다.
 * 붙고 나면 [speakerTintOfLabel] 이 라벨로 고르므로 색이 바뀌는데, 드롭다운은 「이 사람이
 * 누구인가」를 보는 자리라 얼굴(사진·이니셜)이 알아보는 단서이고 색은 거들 뿐이다.
 */
export function speakerTint(key: string) {
  return SPEAKER_TINTS[hash(key) % SPEAKER_TINTS.length];
}

/**
 * 얼굴에 넣을 글자.
 *
 * **이름이 없으면 라벨을 그대로 쓴다.** 예전에는 화면 이름(`화자 A`)의 첫 글자를 잘라
 * 썼는데, 그러면 이름 없는 화자가 **전부 「화」**가 되어 얼굴이 서로를 못 가린다 —
 * 정작 가려 주는 글자는 뒤에 붙은 `A` 쪽이다.
 */
function initialOf(name: string | null, label: string) {
  if (name) return [...name][0] ?? "?";
  // `AA` 같은 두 자리도 있다. 20px 칩에 두 자는 들어간다
  return label.slice(0, 2) || "?";
}

/**
 * 라벨 순번으로 색을 고른다. **이름이 붙어도 색이 안 바뀐다** — 예전에는 이름을 해싱해서
 * 「화자 A」에 이름을 다는 순간 색이 딴 것으로 튀었다.
 *
 * 열을 넘으면 되돌아 쓴다. 그때는 색이 겹치지만, 이름이 함께 있으므로 색만으로 가려야 할
 * 일은 아니다.
 */
export function speakerTintOfLabel(label: string) {
  const index = indexOfLabel(label);
  // 글자 라벨이 아니면 순번을 못 매긴다. 그때만 해싱으로 돌아간다
  if (index === null) return speakerTint(label);
  return SPEAKER_TINTS[index % SPEAKER_TINTS.length];
}

export type SpeakerIdentity = {
  /** 화면에 쓸 이름. 연결 안 됐으면 `화자 A`. */
  displayName: string;
  /** 칩 바탕. 배경으로만 쓴다. */
  tint: string;
  /** 프로필 사진이 없을 때 그릴 글자. 이름이 있으면 그 첫 글자, 없으면 라벨. */
  initial: string;
  /** 계정이 연결됐으면 사진 URL. */
  imageUrl: string | null;
  /** 아직 아무도 안 본 화자. 점을 찍어 이름을 붙일 이유를 만든다. */
  unassigned: boolean;
};

export type SpeakerIdentitySource = DiarizationSpeaker & {
  assignedParticipantId?: string | null;
  confirmed?: boolean;
  image?: string | null;
};

/**
 * 얼굴을 들고 있는 쪽. **계약의 `speakers[]` 에는 사진이 없다** — 붙은 사람의 식별자만 준다.
 * 사진은 같은 응답의 참석자 목록에 있고, 그 둘을 여기서 잇는다.
 *
 * **잇는 열쇠가 `participantId`다** (APP-491). 계정으로 이으면 계정 없는 임시 참여자는
 * 그 값이 없어 전부 한 칸에 뭉치고, 남의 사진이 실릴 수 있다.
 */
export type SpeakerFace = {
  participantId: string;
  /** 발화 단위 지정이 이 이름을 쓴다 — 그 줄에는 라벨의 이름 대신 이 사람이 선다. */
  name?: string | null;
  image?: string | null;
};

/**
 * 화자에게 얼굴을 준다. **아무것도 저장하지 않는다** — 렌더 시점에 계산한다.
 *
 * 저장하면 팔레트를 바꿀 때 옛 회의만 옛 색으로 남고, 화자 수가 팔레트보다 많으면 어차피
 * 겹치므로 안정성을 약속할 수도 없다.
 *
 * **색은 라벨이 정한다.** 이름이 아니라 라벨이라 이름을 붙여도 색이 안 바뀐다.
 *
 * V31 부터 **한 사람이 여러 화자를 맡을 수 있다.** 그래도 색을 사람 기준으로 안 바꾼다 —
 * 색은 「이 목소리 덩어리」의 표시이고 이름과는 별개다. 그래서 화자 A·B 를 둘 다 한 사람으로
 * 두면 같은 이름이 두 색으로 나오는데, 그것이 실제로 일어난 일(목소리는 둘로 나뉘었고
 * 사람은 하나다)에 가깝다. 얼굴(사진·이니셜)이 같아서 알아보는 데는 그쪽이 단서다.
 *
 * 발화 단위 지정도 같은 규칙이다 — 그 줄은 **이름과 얼굴만** 바뀌고 색은 라벨 것을 쓴다.
 */
export function createSpeakerIdentityResolver(
  speakers: SpeakerIdentitySource[],
  participants: SpeakerFace[] = []
) {
  const byLabel = new Map(speakers.map((speaker) => [speaker.label, speaker]));
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

  return (
    label: string | null | undefined,
    /**
     * 이 발화에만 붙은 참여 기록. 있으면 **라벨의 이름을 이긴다** — 더 좁은 범위를 사람이
     * 나중에 골랐다는 뜻이라서다.
     *
     * 목록에 없는 참여 기록이면 무시하고 라벨을 따른다. 참석자에서 빠진 사람이 전사에
     * 이름만 남는 것보다, 라벨의 답으로 돌아가는 편이 덜 틀린다.
     */
    overriddenParticipantId?: string | null
  ): SpeakerIdentity | null => {
    if (!label) return null;
    const overriddenName = overriddenParticipantId
      ? (nameOf.get(overriddenParticipantId) ?? null)
      : null;
    if (overriddenName) {
      return {
        displayName: overriddenName,
        // **색은 그대로 라벨 것이다.** 이 줄도 여전히 목소리 덩어리 A 에 속한다 —
        // 우리가 고친 것은 거기 붙일 이름뿐이다.
        tint: speakerTintOfLabel(label),
        initial: initialOf(overriddenName, label),
        imageUrl: faceOf.get(overriddenParticipantId!) ?? null,
        // 사람이 이 줄을 콕 집어 골랐다. 「아직 아무도 안 본 화자」가 아니다
        unassigned: false,
      };
    }
    const speaker = byLabel.get(label);
    const name = speaker?.assignedName ?? null;
    // 「참석자 아님」으로 확정한 화자도 `화자 A` 로 남는다. 그 사람이 누구인지 우리가
    // 모른다는 것이 사실이고, 다른 말로 꾸미면 거짓이 된다.
    const displayName = name ?? `화자 ${label}`;

    return {
      displayName,
      tint: speakerTintOfLabel(label),
      initial: initialOf(name, label),
      // **사람이면 사진이 먼저다.** 고를 때 얼굴로 알아본 사람이 붙는 순간 글자로 바뀌면
      // 같은 사람인지 다시 확인하게 된다. 파스텔은 사진이 없을 때의 대체일 뿐이다
      imageUrl:
        speaker?.image ??
        (speaker?.assignedParticipantId
          ? (faceOf.get(speaker.assignedParticipantId) ?? null)
          : null),
      unassigned: !speaker?.confirmed,
    };
  };
}
